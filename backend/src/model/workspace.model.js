const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        minlength: 3,
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        role: {
            type: String,
            enum: ["owner", "admin", "member"],
            default: "member"
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    }
},
    {
        timestamps: true
    });

module.exports = mongoose.model("Workspace", workspaceSchema);
