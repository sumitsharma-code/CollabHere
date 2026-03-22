const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    action: {
        type: String,
        enum: [
            "created_workspace",
            "added_member",
            "removed_member",
            "left_workspace",
            "transferred_ownership",
            "created_document",
            "updated_document",
            "saved_document",
            "deleted_document"
        ],
        required: true
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    targetDocument: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document"
    },
    description: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Activity", activitySchema);
