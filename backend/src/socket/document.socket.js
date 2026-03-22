function documentSocket(io) {
    const documentUsers = {};
    const pendingChanges = {};
    // userId → socketId map for direct 1-to-1 call routing
    const userSocketMap = new Map();

    io.on("connection", (socket) => {
        console.log("User connected: " + socket.id);

        // User joins a document room
        socket.on("joinDocument", ({ documentId, userName, userId }) => {
            // Validate input
            if (!documentId || typeof documentId !== 'string' || !userName || typeof userName !== 'string' || !userId || typeof userId !== 'string') {
                socket.emit("error", { message: "Invalid documentId, userName, or userId" });
                return;
            }

            // Set userId on socket for disconnect handling
            socket.userId = userId;

            // Leave previous document if any
            const previousRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
            previousRooms.forEach(room => {
                socket.leave(room);
                // Remove user from previous document's presence list
                if (documentUsers[room]) {
                    documentUsers[room] = documentUsers[room].filter(user => user.socketId !== socket.id);
                    // Only broadcast if room still has users after removal
                    if (documentUsers[room].length > 0) {
                        io.to(room).emit("presenceUpdate", documentUsers[room]);
                    } else {
                        // Clean up empty rooms
                        delete documentUsers[room];
                    }
                }
            });

            // Initialize document users list if not exists
            if (!documentUsers[documentId]) {
                documentUsers[documentId] = [];
            }

            // Check if user already exists in this document (prevent duplicates)
            const existingUserIndex = documentUsers[documentId].findIndex(user => user.socketId === socket.id);

            if (existingUserIndex !== -1) {
                // Update existing user's info (e.g., reconnection case)
                documentUsers[documentId][existingUserIndex] = {
                    socketId: socket.id,
                    userName: userName,
                    userId: userId,
                    joinedAt: documentUsers[documentId][existingUserIndex].joinedAt
                };
            } else {
                // Add new user to the document
                documentUsers[documentId].push({
                    socketId: socket.id,
                    userName: userName,
                    userId: userId,
                    joinedAt: new Date()
                });
            }

            // Join the new document room
            socket.join(documentId);
            console.log(`User ${userName} (${socket.id}) joined document: ${documentId}`);

            // Broadcast updated presence to all users in the document
            io.to(documentId).emit("presenceUpdate", documentUsers[documentId]);
        });

        // Handle document changes with throttling
        socket.on("documentChange", ({ documentId, content, userId }) => {
            // Validate input
            if (!documentId || typeof documentId !== 'string' || !userId || typeof userId !== 'string') {
                socket.emit("error", { message: "Invalid documentId or userId" });
                return;
            }

            // Validate content (basic check - should be string)
            if (typeof content !== 'string') {
                socket.emit("error", { message: "Content must be a string" });
                return;
            }

            // Store the latest change for this document
            if (!pendingChanges[documentId]) {
                pendingChanges[documentId] = {
                    content: content,
                    userId: userId,
                    timestamp: new Date(),
                    timer: null
                };

                // Set up throttled broadcast (every 50ms)
                pendingChanges[documentId].timer = setTimeout(() => {
                    const change = pendingChanges[documentId];
                    io.to(documentId).emit("documentUpdate", {
                        content: change.content,
                        userId: change.userId,
                        timestamp: change.timestamp
                    });
                    delete pendingChanges[documentId];
                }, 50);
            } else {
                // Update pending change with latest content
                pendingChanges[documentId].content = content;
                pendingChanges[documentId].timestamp = new Date();
            }
        });

        // Handle cursor movements for real-time collaboration
        socket.on("cursorMove", ({ documentId, position, userId }) => {
            // Validate input
            if (!documentId || typeof documentId !== 'string' || !userId || typeof userId !== 'string') {
                socket.emit("error", { message: "Invalid documentId or userId" });
                return;
            }

            socket.to(documentId).emit("cursorUpdate", {
                userId,
                position,
                timestamp: new Date()
            });
        });

        // 🔥 Handle typing indicator
        socket.on("typing", ({ documentId, userId, userName }) => {
            // Validate input
            if (!documentId || typeof documentId !== 'string' || !userId || typeof userId !== 'string') {
                socket.emit("error", { message: "Invalid documentId or userId" });
                return;
            }

            // Broadcast to other users in the document (not to sender)
            socket.to(documentId).emit("typing", {
                userId,
                userName,
                timestamp: new Date()
            });
        });

        // 🔥 Handle stop typing
        socket.on("stopTyping", ({ documentId, userId }) => {
            // Validate input
            if (!documentId || typeof documentId !== 'string' || !userId || typeof userId !== 'string') {
                socket.emit("error", { message: "Invalid documentId or userId" });
                return;
            }

            // Broadcast to other users in the document
            socket.to(documentId).emit("stopTyping", {
                userId,
                timestamp: new Date()
            });
        });

        // Handle user disconnect
        socket.on("disconnect", () => {
            // Clear any pending changes for this user only
            Object.keys(pendingChanges).forEach(documentId => {
                // Only clear if this user's change is pending
                if (pendingChanges[documentId].userId === socket.userId) {
                    if (pendingChanges[documentId].timer) {
                        clearTimeout(pendingChanges[documentId].timer);
                    }
                    delete pendingChanges[documentId];
                }
            });

            // Remove user from all document presence lists
            Object.keys(documentUsers).forEach(documentId => {
                documentUsers[documentId] = documentUsers[documentId].filter(user => user.socketId !== socket.id);

                // Broadcast updated presence
                if (documentUsers[documentId].length > 0) {
                    io.to(documentId).emit("presenceUpdate", documentUsers[documentId]);
                } else {
                    // Clean up empty rooms
                    delete documentUsers[documentId];
                }
            });

            console.log("User disconnected: " + socket.id);
        });

        // ══════════════════════════════════════════════════
        //  CHAT EVENTS
        // ══════════════════════════════════════════════════
        const messageModel = require("../model/message.model");

        // Client joins their workspace chat room
        socket.on("joinWorkspaceChat", ({ workspaceId, userId, userName }) => {
            if (!workspaceId) return;
            const room = `workspace:${workspaceId}`;
            socket.join(room);
            socket.data.currentWorkspace = workspaceId;
            socket.data.chatUserId = userId;
            socket.data.chatUserName = userName;
            // Register for 1-to-1 call routing
            if (userId) userSocketMap.set(userId, socket.id);
        });

        // ── SIGNALING HELPERS ──────────────────────────────────
        function routeTo(targetUserId, event, payload) {
            const sid = userSocketMap.get(targetUserId);
            if (sid) {
                io.to(sid).emit(event, payload);
                return true;
            }
            return false;
        }

        // ── CALL SIGNALING EVENTS ──────────────────────────────
        socket.on("call:request", ({ targetUserId, callerId, callerName, workspaceId }) => {
            const sent = routeTo(targetUserId, "call:incoming", { callerId, callerName, workspaceId });
            if (!sent) socket.emit("call:error", { message: "User is not online" });
        });

        socket.on("call:accept", ({ callerId, accepterId, accepterName }) => {
            routeTo(callerId, "call:accepted", { accepterId, accepterName });
        });

        socket.on("call:reject", ({ callerId }) => {
            routeTo(callerId, "call:rejected", {});
        });

        socket.on("call:offer", ({ targetUserId, offer }) => {
            const callerId = socket.data.chatUserId;
            routeTo(targetUserId, "call:offer", { offer, callerId });
        });

        socket.on("call:answer", ({ targetUserId, answer }) => {
            routeTo(targetUserId, "call:answer", { answer });
        });

        socket.on("call:ice-candidate", ({ targetUserId, candidate }) => {
            routeTo(targetUserId, "call:ice-candidate", { candidate });
        });

        socket.on("call:end", ({ targetUserId }) => {
            routeTo(targetUserId, "call:ended", {});
        });

        // Client sends a chat message
        socket.on("sendChatMessage", async ({ workspaceId, content, userId, userName }) => {
            if (!workspaceId || !content?.trim() || !userId) return;

            try {
                // Persist to DB
                const msg = await messageModel.create({
                    workspaceId,
                    sender: userId,
                    content: content.trim(),
                });

                // Populate sender for the broadcast payload
                await msg.populate("sender", "username email");

                const payload = {
                    _id: msg._id,
                    sender: msg.sender,
                    content: msg.content,
                    createdAt: msg.createdAt,
                };

                // Broadcast to everyone in the workspace room (including sender)
                io.to(`workspace:${workspaceId}`).emit("chatMessage", payload);
            } catch (err) {
                console.error("Chat save error:", err.message);
                socket.emit("chatError", { message: "Failed to send message" });
            }
        });

        // Typing indicators for chat
        socket.on("chatTyping", ({ workspaceId, userId, userName }) => {
            if (!workspaceId) return;
            socket.to(`workspace:${workspaceId}`).emit("chatUserTyping", { userId, userName });
        });

        socket.on("chatStopTyping", ({ workspaceId, userId }) => {
            if (!workspaceId) return;
            socket.to(`workspace:${workspaceId}`).emit("chatUserStopTyping", { userId });
        });

        socket.on("disconnect", () => {
            // Remove from 1-to-1 call routing map
            if (socket.data.chatUserId) {
                userSocketMap.delete(socket.data.chatUserId);
            }
            console.log("User disconnected: " + socket.id);
        });

    });
}

module.exports = documentSocket;

