const activityModel = require("../model/activity.model");

// Helper function to log activity
async function logActivity(workspaceId, userId, action, targetUser = null, targetDocument = null, description = "") {
    try {
        const activity = new activityModel({
            workspaceId,
            userId,
            action,
            targetUser,
            targetDocument,
            description
        });
        await activity.save();
    } catch (err) {
        console.error("Error logging activity:", err.message);
    }
}

// Get activity logs for a workspace with pagination
async function getActivityLogs(req, res) {
    const workspaceId = req.params.workspaceId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    try {
        // Validate pagination parameters
        if (page < 1 || limit < 1) {
            return res.status(400).json({ message: "Page and limit must be positive integers" });
        }

        const skip = (page - 1) * limit;

        // Get total count of activities
        const totalActivities = await activityModel.countDocuments({ workspaceId });

        // Get paginated activities with populated references
        const activities = await activityModel
            .find({ workspaceId })
            .populate('userId', 'name email')
            .populate('targetUser', 'name email')
            .populate('targetDocument', 'title')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Calculate total pages
        const totalPages = Math.ceil(totalActivities / limit);

        res.status(200).json({
            message: "Activity logs retrieved successfully",
            data: {
                activities,
                pagination: {
                    currentPage: page,
                    limit,
                    totalActivities,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            }
        });
    } catch (err) {
        console.error("Get Activity Logs Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = {
    logActivity,
    getActivityLogs
};
