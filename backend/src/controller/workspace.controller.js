const userModel = require("../model/user.model");
const workspaceModel = require("../model/workspace.model");
const documentModel = require("../model/document.model");
const { logActivity } = require("./activity.controller");

async function createWorkspace(req, res) {
    const {name} = req.body;
    const userId = req.user.id;
    try {
        const workspace = await workspaceModel.create({
            name,
            createdBy: userId,
            members: [{ user: userId, role: "owner" }]
        });
        
        // Log activity
        await logActivity(workspace._id, userId, "created_workspace", null, null, `Created workspace: ${name}`);
        
        res.status(201).json({
            message: "Workspace created successfully",
            workspace
        });
    } catch (err) {
        console.error("Create Workspace Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function getWorkspaces(req, res) {
    const userId = req.user.id;
    try {
        const workspaces = await workspaceModel
            .find({ "members.user": userId })
            .select("name members createdAt")
            .populate("members.user", "username email")
            .sort({ createdAt: -1 });
        res.status(200).json({
            message: "Workspaces retrieved successfully",
            workspaces
        });
    } catch (err) {
        console.error("Get Workspaces Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function getWorkspaceById(req, res) {
    try {
        const workspace = await workspaceModel
            .findById(req.workspace._id)
            .populate("members.user", "username email");
        res.status(200).json({
            message: "Workspace retrieved successfully",
            workspace
        });
    } catch (err) {
        console.error("Get Workspace Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function addMember(req, res) {
    const workspaceId = req.params.workspaceId;
    const { email, role } = req.body;
    const userId = req.user.id;
    
    if(role !== "admin" && role !== "member") {
        return res.status(400).json({ message: "Invalid role. Must be 'admin' or 'member'" });
    }

    try {
        const workspace = await workspaceModel.findOne({
            _id: workspaceId,
            "members.user": userId
        })
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check if current user has permission to add members
        const currentMember = workspace.members.find(
            m => m.user.toString() === userId
        );
        if (!currentMember || (currentMember.role !== "owner" && currentMember.role !== "admin")) {
            return res.status(403).json({ message: "Not authorized to add members" });
        }

        // Find the user by email
        if(!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const userToAdd = await userModel.findOne({ email:email.trim().toLowerCase() });
        if (!userToAdd) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prevent inviting yourself
        if (userToAdd._id.toString() === userId) {
            return res.status(400).json({ message: "You cannot invite yourself" });
        }

        // Check if the user is already a member
        const isMember = workspace.members.some(member => member.user.toString() === userToAdd._id.toString());
        if (isMember) {
            return res.status(400).json({ message: "User is already a member of this workspace" });
        }

        // Add the new member
        workspace.members.push({ user: userToAdd._id, role });
        await workspace.save();

        // Log activity
        await logActivity(workspaceId, userId, "added_member", userToAdd._id, null, `Added ${userToAdd.email} as ${role}`);

        // Re-fetch with population so frontend gets names immediately
        const populatedWorkspace = await workspaceModel
            .findById(workspaceId)
            .populate("members.user", "username email");

        res.status(200).json({
            message: "Member added successfully",
            workspace: populatedWorkspace
        });
    } catch (err) {
        console.error("Add Member Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function removeMember(req, res) {
    const workspaceId = req.params.workspaceId;
    const memberId = req.params.memberId;
    const userId = req.user.id;
    try {        
        const workspace = await workspaceModel.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check if current user has permission to remove members
        const currentMember = workspace.members.find(
            m => m.user.toString() === userId
        );
        if (!currentMember || (currentMember.role !== "owner" && currentMember.role !== "admin")) {
            return res.status(403).json({ message: "Not authorized to remove members" });
        }

        // Find the member to be removed
        const memberToRemove = workspace.members.find(
            m => m.user.toString() === memberId
        );

        if (!memberToRemove) {
            return res.status(404).json({ message: "Member not found" });
        }
        if(memberToRemove.role === "owner") {
            return res.status(400).json({ message: "Cannot remove workspace owner" });
        }
        if(currentMember.role === "admin" && memberToRemove.role === "admin") {
            return res.status(403).json({ message: "Admin cannot remove another admin" });
        }
        if(memberId === userId) {
            return res.status(400).json({ message: "You cannot remove yourself. Please ask another admin or owner to remove you if you wish to leave the workspace." });
        }

        // Remove the member
        workspace.members = workspace.members.filter(
            m => m.user.toString() !== memberId
        );
        await workspace.save();

        // Log activity
        await logActivity(workspaceId, userId, "removed_member", memberId, null, "");

        res.status(200).json({
            message: "Member removed successfully",
            workspace
        });
    } catch (err) {
        console.error("Remove Member Error:", err.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

async function leaveWorkspace(req, res) {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const userRole = req.userRole;

    try {
        const workspace = await workspaceModel.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        // Check if user is the owner
        if (userRole === "owner") {
            return res.status(400).json({
                message: "Workspace owner cannot leave. Please transfer ownership to another member first."
            });
        }

        // Remove the user from the workspace
        workspace.members = workspace.members.filter(
            m => m.user.toString() !== userId
        );
        await workspace.save();

        // Log activity
        await logActivity(workspaceId, userId, "left_workspace", null, null, "");

        res.status(200).json({
            message: "Successfully left the workspace"
        });
    } catch (err) {
        console.error("Leave Workspace Error:", err.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

async function addDocument(req, res) {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

    try {
        const document = await documentModel.create({
            title: "Untitled Document",
            content: "",
            createdBy: userId,
            workspaceId: workspaceId,
            lastEditedBy: userId
        });

        // Log activity
        await logActivity(workspaceId, userId, "created_document", null, document._id, "Created new document");

        res.status(201).json({
            message: "Document created successfully",
            document
        });
    } catch (err) {
        console.error("Add Document Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function getDocuments(req, res) {
    const workspaceId = req.params.workspaceId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        // Validate pagination parameters
        if (page < 1 || limit < 1) {
            return res.status(400).json({ message: "Page and limit must be positive integers" });
        }

        const skip = (page - 1) * limit;

        // Get total count of documents
        const totalDocuments = await documentModel.countDocuments({ workspaceId: workspaceId });

        // Get paginated documents
        const documents = await documentModel
            .find({ workspaceId: workspaceId })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Calculate total pages
        const totalPages = Math.ceil(totalDocuments / limit);

        res.status(200).json({
            message: "Documents retrieved successfully",
            data: {
                documents,
                pagination: {
                    currentPage: page,
                    limit,
                    totalDocuments,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            }
        });
    } catch (err) {
        console.error("Get Documents Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function getDocumentById(req, res) {
    const workspaceId = req.params.workspaceId;
    const documentId = req.params.documentId;
    try {
        const document = await documentModel.findOne(
            { _id: documentId, workspaceId: workspaceId }
        ).select("title content createdBy updatedAt");

        if (!document) {
            return res.status(404).json({
                message: "Document not found in this workspace"
            });
        }
        res.status(200).json({
            message: "Document retrieved successfully",
            document
        });
    } catch (err) {
        console.error("Get Document Error:", err.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

async function updateDocument(req, res) {
    const workspaceId = req.params.workspaceId;
    const documentId = req.params.documentId;
    const userId = req.user.id;
    const { title, content } = req.body;

    try {
        const document = await documentModel.findOneAndUpdate(
            { _id: documentId, workspaceId: workspaceId },
            { title, content, lastEditedBy: userId },
            { new: true }
        );

        if (!document) {
            return res.status(404).json({
                message: "Document not found in this workspace"
            });
        }

        // Log activity
        await logActivity(workspaceId, userId, "updated_document", null, documentId, `Updated document: ${title || 'Untitled'}`);

        res.status(200).json({
            message: "Document updated successfully",
            document
        });
    } catch (err) {
        console.error("Update Document Error:", err.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// 🔥 New: Save document content (auto-save endpoint)
async function saveDocumentContent(req, res) {
    const workspaceId = req.params.workspaceId;
    const documentId = req.params.documentId;
    const userId = req.user.id;
    const { content } = req.body;

    // Validate required fields
    if (typeof content !== 'string') {
        return res.status(400).json({ message: "Content must be a string" });
    }

    try {
        // Find document and update content with lastEditedBy
        const document = await documentModel.findOneAndUpdate(
            { _id: documentId, workspaceId: workspaceId },
            { 
                content, 
                lastEditedBy: userId,
                updatedAt: new Date()
            },
            { new: true }
        ).select("_id title content lastEditedBy updatedAt");

        if (!document) {
            return res.status(404).json({
                message: "Document not found in this workspace"
            });
        }

        // Log activity (lighter than full update log)
        await logActivity(workspaceId, userId, "saved_document", null, documentId, `Auto-saved document`);

        res.status(200).json({
            message: "Document saved successfully",
            document: {
                _id: document._id,
                savedAt: document.updatedAt,
                lastEditedBy: document.lastEditedBy
            }
        });
    } catch (err) {
        console.error("Save Document Error:", err.message);
        return res.status(500).json({ message: "Failed to save document" });
    }
}

async function deleteDocument(req, res) {
    const workspaceId = req.params.workspaceId;
    const documentId = req.params.documentId;
    const userId = req.user.id;
    try {
        const document = await documentModel.findOneAndDelete(
            { _id: documentId, workspaceId: workspaceId }
        );
        if (!document) {
            return res.status(404).json({
                message: "Document not found in this workspace"
            });
        }

        // Log activity
        await logActivity(workspaceId, userId, "deleted_document", null, documentId, `Deleted document: ${document.title}`);

        res.status(200).json({
            message: "Document deleted successfully"
        });
    } catch (err) {
        console.error("Delete Document Error:", err.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

async function transferOwnership(req, res) {
    const workspaceId = req.params.workspaceId;
    const { userId: newOwnerId } = req.body;
    const currentUserId = req.user.id;

    try {
        // Validate userId is provided
        if (!newOwnerId) {
            return res.status(400).json({ message: "userId is required in request body" });
        }

        // Verify the workspace exists and user is the owner (already checked by middleware)
        const workspace = req.workspace;

        // Prevent transferring ownership to same user
        if (newOwnerId === currentUserId) {
            return res.status(400).json({ message: "You are already the owner of this workspace" });
        }

        // Find the new owner in the workspace members
        const newOwnerMember = workspace.members.find(
            m => m.user.toString() === newOwnerId
        );

        if (!newOwnerMember) {
            return res.status(404).json({ message: "User is not a member of this workspace" });
        }

        // Find current owner member
        const currentOwnerMember = workspace.members.find(
            m => m.user.toString() === currentUserId
        );

        // Update roles: new owner becomes owner, current owner becomes admin
        newOwnerMember.role = "owner";
        currentOwnerMember.role = "admin";

        await workspace.save();

        // Log activity
        await logActivity(workspaceId, currentUserId, "transferred_ownership", newOwnerId, null, `Transferred ownership to ${newOwnerMember.user}`);

        res.status(200).json({
            message: "Workspace ownership transferred successfully",
            workspace
        });
    } catch (err) {
        console.error("Transfer Ownership Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function deleteWorkspace(req, res) {
    const workspaceId = req.params.workspaceId;
    const userRole = req.userRole;
    try {
        if (userRole !== "owner") {
            return res.status(403).json({ message: "Only the workspace owner can delete this workspace" });
        }
        await workspaceModel.findByIdAndDelete(workspaceId);
        // Cascade deletes
        await documentModel.deleteMany({ workspaceId });
        const taskModel    = require('../model/task.model');
        const activityModel = require('../model/activity.model');
        await taskModel.deleteMany({ workspaceId });
        await activityModel.deleteMany({ workspaceId });
        res.status(200).json({ message: "Workspace deleted successfully" });
    } catch (err) {
        console.error("Delete Workspace Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = { createWorkspace, getWorkspaces, getWorkspaceById, addMember, removeMember, leaveWorkspace, addDocument, getDocuments, getDocumentById, updateDocument, saveDocumentContent, deleteDocument, transferOwnership, deleteWorkspace };