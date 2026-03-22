const express = require('express');
const router = express.Router();
const {
    createTask,
    getTasksByWorkspace,
    getTaskById,
    updateTask,
    deleteTask,
    recommendTask
} = require('../controller/task.controller');

const authMiddleware = require('../middleware/auth.middleware');

// All task routes require authentication
router.use(authMiddleware.authUser);

// 🔥 GET: Recommend the single best task to start right now (BEFORE /:taskId routes)
router.get('/:workspaceId/tasks/recommend', recommendTask);

// POST: Create new task
router.post('/:workspaceId/tasks', createTask);

// GET: Get all tasks in workspace (with filtering)
// ?status=todo&assignedTo=userId&isImportant=true
router.get('/:workspaceId/tasks', getTasksByWorkspace);

// GET: Get specific task
router.get('/:workspaceId/tasks/:taskId', getTaskById);

// PUT: Update task (partial update supported)
router.put('/:workspaceId/tasks/:taskId', updateTask);

// DELETE: Delete task
router.delete('/:workspaceId/tasks/:taskId', deleteTask);

module.exports = router;
