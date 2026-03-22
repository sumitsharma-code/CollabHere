const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "workspace",
            required: true,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        content: {
            type: String,
            required: true,
            maxlength: 2000,
            trim: true,
        },
        // future-proof: 'text' | 'image' | 'file'
        messageType: {
            type: String,
            enum: ["text"],
            default: "text",
        },
    },
    { timestamps: true }
);

// Compound index for paginated workspace chat
messageSchema.index({ workspaceId: 1, createdAt: -1 });

const messageModel = mongoose.model("message", messageSchema);

module.exports = messageModel;
