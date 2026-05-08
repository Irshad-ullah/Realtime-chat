require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/database");
const { initSocket } = require("./services/socketService");

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Create HTTP server (needed to attach Socket.IO)
const server = http.createServer(app);

// Initialize Socket.IO on the same server
initSocket(server);

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => process.exit(0));
});
