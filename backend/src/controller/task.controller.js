const mongoose = require('mongoose');
const taskModel = require('../model/task.model');
const workspaceModel = require('../model/workspace.model');

// 🔥 Helper function to verify workspace membership
async function verifyWorkspaceAccess(req, res, workspaceId) {
    try {
        const workspace = await workspaceModel.findById(workspaceId);
        if (!workspace) {
            res.status(404).json({ message: "Workspace not found" });
            return null;
        }

        const isMember = workspace.members.some(
            m => m.user.toString() === req.user.id.toString()
        );

        if (!isMember) {
            res.status(403).json({ message: "Access denied - not a workspace member" });
            return null;
        }

        return workspace;
    } catch (error) {
        console.error("Workspace Access Error:", error.message);
        res.status(500).json({ message: "Internal server error" });
        return null;
    }
}

async function createTask(req, res) {
    try {
        const { workspaceId } = req.params;
        let { title, description, status, assignedTo, dueDate, isImportant, isUrgent } = req.body;

        title = title?.trim();
        description = description?.trim();

        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }

        const workspace = await verifyWorkspaceAccess(req, res, workspaceId);
        if (!workspace) return;

        if (assignedTo !== undefined && assignedTo !== null) {
            if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                return res.status(400).json({ message: "Invalid assigned user ID" });
            }
            const isValidMember = workspace.members.some(
                m => m.user.toString() === assignedTo.toString()
            );
            if (!isValidMember) {
                return res.status(400).json({ message: "Assigned user not in workspace" });
            }
        }

        const newTask = new taskModel({
            title,
            description,
            status: status || "todo",
            assignedTo,
            dueDate,
            workspaceId,
            isImportant: isImportant || false,
            isUrgent: isUrgent || false,
            createdBy: req.user.id
        });

        await newTask.save();
        await newTask.populate('createdBy', 'username email');
        await newTask.populate('assignedTo', 'username email');

        if (req.io) {
            req.io.to(workspaceId).emit("taskEvent", {
                type: "TASK_CREATED",
                data: newTask
            });
        }

        console.log(`[AUDIT] User ${req.user.id} created task ${newTask._id} in workspace ${workspaceId}`);

        res.status(201).json({
            message: "Task created successfully",
            task: newTask
        });
    } catch (error) {
        console.error("Create Task Error:", error.message);
        const statusCode = error.name === 'ValidationError' ? 400 : 500;
        res.status(statusCode).json({
            message: statusCode === 400 ? error.message : "Internal server error"
        });
    }
}

async function getTasksByWorkspace(req, res) {
    try {
        const { workspaceId } = req.params;
        const { status, assignedTo, isImportant, isUrgent } = req.query;

        const workspace = await verifyWorkspaceAccess(req, res, workspaceId);
        if (!workspace) return;

        const filter = { workspaceId };
        if (status) filter.status = status;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (isImportant !== undefined) filter.isImportant = isImportant === 'true';
        if (isUrgent !== undefined) filter.isUrgent = isUrgent === 'true';

        const tasks = await taskModel.find(filter)
            .populate('createdBy', 'username email')
            .populate('assignedTo', 'username email')
            .sort({ priorityScore: -1, dueDate: 1, createdAt: -1 });

        res.status(200).json({
            message: "Tasks retrieved successfully",
            count: tasks.length,
            tasks
        });
    } catch (error) {
        console.error("Get Tasks Error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function getTaskById(req, res) {
    try {
        const { taskId, workspaceId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
            return res.status(400).json({ message: "Invalid workspace ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: "Invalid task ID" });
        }

        const workspace = await verifyWorkspaceAccess(req, res, workspaceId);
        if (!workspace) return;

        const task = await taskModel.findOne({ _id: taskId, workspaceId })
            .populate('createdBy', 'username email')
            .populate('assignedTo', 'username email')
            .populate('lastEditedBy', 'username email');

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json({
            message: "Task retrieved successfully",
            task
        });
    } catch (error) {
        console.error("Get Task Error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

async function updateTask(req, res) {
    try {
        const { taskId, workspaceId } = req.params;
        let { title, description, status, assignedTo, dueDate, isImportant, isUrgent } = req.body;

        if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
            return res.status(400).json({ message: "Invalid workspace ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: "Invalid task ID" });
        }

        title = title?.trim();
        description = description?.trim();

        const workspace = await verifyWorkspaceAccess(req, res, workspaceId);
        if (!workspace) return;

        const task = await taskModel.findOne({ _id: taskId, workspaceId });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null) {
                task.assignedTo = null;
            } else {
                if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                    return res.status(400).json({ message: "Invalid assigned user ID" });
                }
                const isValidMember = workspace.members.some(
                    m => m.user.toString() === assignedTo.toString()
                );
                if (!isValidMember) {
                    return res.status(400).json({ message: "Assigned user not in workspace" });
                }
                task.assignedTo = assignedTo;
            }
        }

        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (status !== undefined) {
            const validStatuses = ['todo', 'in-progress', 'done'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: "Invalid status" });
            }
            task.status = status;
        }
        if (dueDate !== undefined) task.dueDate = dueDate;
        if (isImportant !== undefined) task.isImportant = isImportant;
        if (isUrgent !== undefined) task.isUrgent = isUrgent;

        task.lastEditedBy = req.user.id;
        await task.save();

        await task.populate('createdBy', 'username email');
        await task.populate('assignedTo', 'username email');
        await task.populate('lastEditedBy', 'username email');

        if (req.io) {
            req.io.to(workspaceId).emit("taskEvent", {
                type: "TASK_UPDATED",
                data: task
            });
        }

        console.log(`[AUDIT] User ${req.user.id} updated task ${task._id} in workspace ${workspaceId}`);

        res.status(200).json({
            message: "Task updated successfully",
            task
        });
    } catch (error) {
        console.error("Update Task Error:", error.message);
        const statusCode = error.name === 'ValidationError' ? 400 : 500;
        res.status(statusCode).json({
            message: statusCode === 400 ? error.message : "Internal server error"
        });
    }
}

async function deleteTask(req, res) {
    try {
        const { taskId, workspaceId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
            return res.status(400).json({ message: "Invalid workspace ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: "Invalid task ID" });
        }

        const workspace = await verifyWorkspaceAccess(req, res, workspaceId);
        if (!workspace) return;

        const task = await taskModel.findOneAndDelete({ _id: taskId, workspaceId });

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        if (req.io) {
            req.io.to(workspaceId).emit("taskEvent", {
                type: "TASK_DELETED",
                data: task
            });
        }

        console.log(`[AUDIT] User ${req.user.id} deleted task ${task._id} in workspace ${workspaceId}`);

        res.status(200).json({
            message: "Task deleted successfully",
            task
        });
    } catch (error) {
        console.error("Delete Task Error:", error.message);
        const statusCode = error.name === 'ValidationError' ? 400 : 500;
        res.status(statusCode).json({
            message: statusCode === 400 ? error.message : "Internal server error"
        });
    }
}

// 🔥 AI-ready: Recommend the single best task to work on right now
async function recommendTask(req, res) {
    try {
        const { workspaceId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
            return res.status(400).json({ message: "Invalid workspace ID" });
        }

        const workspace = await verifyWorkspaceAccess(req, res, workspaceId);
        if (!workspace) return;

        // Find the best non-done task using priority score, then due date
        const task = await taskModel
            .findOne({ workspaceId, status: { $ne: 'done' } })
            .populate('createdBy', 'username email')
            .populate('assignedTo', 'username email')
            .sort({ priorityScore: -1, dueDate: 1, createdAt: 1 });

        if (!task) {
            return res.status(200).json({
                message: "No pending tasks found",
                task: null,
                reasoning: "All tasks are done or no tasks exist yet. Great job!"
            });
        }

        // Build a human-readable reasoning string (placeholder for real AI)
        const quadrant = task.isImportant && task.isUrgent
            ? "urgent and important (Do First)"
            : task.isImportant && !task.isUrgent
            ? "important but not urgent (Schedule)"
            : task.isUrgent && !task.isImportant
            ? "urgent but less important (Delegate)"
            : "low priority (Eliminate)";

        const dueText = task.dueDate
            ? ` It's due on ${new Date(task.dueDate).toLocaleDateString()}.`
            : "";

        const reasoning = `This task is ${quadrant} with a priority score of ${task.priorityScore}.${dueText}`;

        res.status(200).json({
            message: "Task recommended",
            task,
            reasoning
        });
    } catch (error) {
        console.error("Recommend Task Error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
}

module.exports = {
    createTask,
    getTasksByWorkspace,
    getTaskById,
    updateTask,
    deleteTask,
    recommendTask
};