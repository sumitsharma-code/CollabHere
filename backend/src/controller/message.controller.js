const messageModel = require("../model/message.model");
const workspaceModel = require("../model/workspace.model");

// GET /api/workspaces/:workspaceId/messages?page=1&limit=50
async function getMessages(req, res) {
    const { workspaceId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    try {
        // Fetch newest-first, then reverse for display
        const messages = await messageModel
            .find({ workspaceId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sender", "username email")
            .lean();

        const total = await messageModel.countDocuments({ workspaceId });

        res.status(200).json({
            messages: messages.reverse(), // oldest-first for chat display
            pagination: {
                page,
                limit,
                total,
                hasMore: skip + messages.length < total,
            },
        });
    } catch (err) {
        console.error("Get Messages Error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = { getMessages };
