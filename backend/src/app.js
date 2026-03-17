const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();

// routes
const authRoutes = require("./routes/auth.routes");
const workspaceRoutes = require("./routes/workspace.routes");

// Middleware
app.use(express.json());
app.use(cookieParser());

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);

module.exports = app;