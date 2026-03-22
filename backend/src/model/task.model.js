const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: ""
    },

    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    // 🔥 Eisenhower Matrix fields
    isImportant: {
        type: Boolean,
        default: false
    },

    isUrgent: {
        type: Boolean,
        default: false
    },

    // Status tracking
    status: {
        type: String,
        enum: ["todo", "in-progress", "done"],
        default: "todo"
    },

    dueDate: {
        type: Date,
        default: null
    },

    // For sorting / AI logic
    priorityScore: {
        type: Number,
        default: 0
    },

    lastEditedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

// 🔥 PRE-SAVE HOOK: Auto-calculate priority score
taskSchema.pre("save", function(next) {
    let score = 0;

    // Base importance
    if (this.isImportant) score += 3;
    if (this.isUrgent) score += 2;

    // Time-based urgency
    if (this.dueDate) {
        const hoursLeft = (new Date(this.dueDate) - new Date()) / (1000 * 60 * 60);
        if (hoursLeft < 24) score += 2; // Due within 24 hours
        if (hoursLeft < 6) score += 3;  // Due within 6 hours (total with 24h = up to 5)
    }

    this.priorityScore = score;
    next();
});

// 🔥 DATABASE INDEXES for performance
taskSchema.index({ workspaceId: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ priorityScore: -1 });

module.exports = mongoose.model("Task", taskSchema);