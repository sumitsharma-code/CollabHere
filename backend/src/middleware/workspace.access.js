const workspaceModel = require("../model/workspace.model");

async function checkWorkspaceAccess(req, res, next) {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    try {
        const workspace = await workspaceModel.findOne({
            _id: workspaceId,
            "members.user": userId
        });

        if (!workspace) {
            return res.status(404).json({
                message: "Workspace not found"
            });
        }

        req.workspace = workspace;
        req.userRole = workspace.members.find(m => m.user.toString() === userId).role;
        next();
    } catch (error) {
        console.error("Error checking workspace access:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
}

// Check if user is the owner
function checkOwnerAccess(req, res, next) {
    const userRole = req.userRole;
    if (userRole !== "owner") {
        return res.status(403).json({
            message: "Only the workspace owner can perform this action"
        });
    }
    next();
}

// Document permissions based on role
function checkDocumentPermission(permission) {
    return (req, res, next) => {
        const userRole = req.userRole;

        const permissions = {
            owner: ['create', 'read', 'update', 'delete'],
            admin: ['read', 'update', 'delete'], // admin can read, update, delete but not create
            member: ['read', 'update'] // member can only read and update
        };

        if (!permissions[userRole] || !permissions[userRole].includes(permission)) {
            return res.status(403).json({
                message: `Access denied. ${userRole}s cannot perform this action.`
            });
        }

        next();
    };
}

module.exports = {
    checkWorkspaceAccess,
    checkOwnerAccess,
    checkDocumentPermission
};