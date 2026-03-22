const express = require("express");
const router  = express.Router();
const { getMessages } = require("../controller/message.controller");
const authMiddleware   = require("../middleware/auth.middleware");
const workspaceValidation = require("../middleware/workspace.validation");
const { checkWorkspaceAccess } = require("../middleware/workspace.access");

// GET /api/workspaces/:workspaceId/messages
router.get(
    "/:workspaceId/messages",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    getMessages
);

module.exports = router;
