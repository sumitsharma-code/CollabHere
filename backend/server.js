require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

// DB
const connectDB = require("./src/db/db");
connectDB();

// main app
const app = require("./src/app");

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
        methods: ["GET", "POST"],
        credentials: true,
    },
});

const documentSocket = require("./src/socket/document.socket");
documentSocket(io);

server.listen(process.env.PORT, () => {
    console.log("Server Connected 🎊");
});