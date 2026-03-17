const mongoose = require("mongoose");

function createWorkspaceValidation(req, res, next) {
    const {name} = req.body;

    if(!name) {
        return res.status(400).json({ message: "Workspace name is required" });
    }

    const trimmedName = name.trim();

    if(trimmedName.length < 3) {
        return res.status(400).json({ message: "Workspace name must be at least 3 characters long" });
    }

    req.body.name = trimmedName;

    next();
}

function validateObjectId(req, res, next) {
    const id = req.params.id || req.params.workspaceId;
    
    if(!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid object ID" });
    }
    next();
}

module.exports = { createWorkspaceValidation, validateObjectId };