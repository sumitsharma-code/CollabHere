const express = require("express");
const router = express.Router();

const workspaceController = require("../controller/workspace.controller");
const activityController = require("../controller/activity.controller");

const authMiddleware = require("../middleware/auth.middleware");
const workspaceValidation = require("../middleware/workspace.validation");
const { checkWorkspaceAccess, checkOwnerAccess, checkDocumentPermission } = require("../middleware/workspace.access");

// Create a new workspace
router.post(
    "/",
    authMiddleware.authUser,
    workspaceValidation.createWorkspaceValidation,
    workspaceController.createWorkspace,
);
// Get all workspaces for the authenticated user
router.get(
    "/", 
    authMiddleware.authUser,
    workspaceController.getWorkspaces
);
// Get a specific workspace by ID
router.get(
    "/:workspaceId",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    workspaceController.getWorkspaceById,
);
// Add a member to a workspace
router.post(
    "/:workspaceId/members",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    workspaceController.addMember,
);
// Remove a member from a workspace
router.delete(
    "/:workspaceId/members/:memberId",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    workspaceController.removeMember,
);
// Transfer workspace ownership
router.patch(
    "/:workspaceId/owner",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    checkOwnerAccess,
    workspaceController.transferOwnership,
);
// Leave a workspace
router.delete(
    "/:workspaceId/leave",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    workspaceController.leaveWorkspace,
);
// add document to a workspace
router.post(
    "/:workspaceId/documents",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    checkDocumentPermission('create'),
    workspaceController.addDocument,
);
// Get all documents in a workspace
router.get(
    "/:workspaceId/documents",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    checkDocumentPermission('read'),
    workspaceController.getDocuments,
);
// get a specific document in a workspace
router.get(
    "/:workspaceId/documents/:documentId",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    checkDocumentPermission('read'),
    workspaceController.getDocumentById,
);
// update a specific document in a workspace
router.patch(
    "/:workspaceId/documents/:documentId",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    checkDocumentPermission('update'),
    workspaceController.updateDocument
);
// delete a specific document in a workspace
router.delete(
    "/:workspaceId/documents/:documentId",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    checkDocumentPermission('delete'),
    workspaceController.deleteDocument
);
// Get activity logs for a workspace
router.get(
    "/:workspaceId/activity",
    authMiddleware.authUser,
    workspaceValidation.validateObjectId,
    checkWorkspaceAccess,
    activityController.getActivityLogs
);

module.exports = router;
