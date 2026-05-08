const { Server } = require("socket.io");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const Message = require("../models/Message");
const {
  addOnlineUser,
  removeOnlineUser,
  getOnlineUsers,
  appendMessageToCache,
} = require("./redisService");

let io; // module-level reference so other services can emit if needed

/**
 * initSocket — called once in server.js with the HTTP server instance.
 *
 * Socket.IO flow:
 *   1. Client connects → middleware shares the Express session (Passport user)
 *   2. "join_business" → user joins their business room
 *   3. "send_message" → save to DB, cache in Redis, emit to receiver's private room
 *   4. disconnect → remove from online set, broadcast updated list
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    // Use websocket + polling fallback
    transports: ["websocket", "polling"],
  });

  // ── Share Express session with Socket.IO middleware ────────────────────────
  const sessionMiddleware = session({
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  });

  io.use((socket, next) => sessionMiddleware(socket.request, {}, next));
  io.use((socket, next) => {
    // Reuse Passport.initialize and passport.session as middleware
    passport.initialize()(socket.request, {}, next);
  });
  io.use((socket, next) => {
    passport.session()(socket.request, {}, next);
  });

  // ── Auth guard: reject unauthenticated sockets ─────────────────────────────
  io.use((socket, next) => {
    if (socket.request.user) return next();
    next(new Error("Unauthorized — please log in first"));
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const user = socket.request.user;
    const businessId = (user.business._id || user.business).toString();
    const userId = user._id.toString();

    console.log(`🔌 Socket connected: ${user.name} (${userId})`);

    // ── Mark online + join private room ─────────────────────────────────────
    await addOnlineUser(businessId, userId);

    // Each user joins their own private room for targeted messages
    socket.join(`user:${userId}`);
    // Also join the business room for broadcasts (online list updates)
    socket.join(`business:${businessId}`);

    // Broadcast updated online list to the whole business
    const onlineIds = await getOnlineUsers(businessId);
    io.to(`business:${businessId}`).emit("online_users", onlineIds);

    // ── send_message ─────────────────────────────────────────────────────────
    // Payload: { receiverId: string, content: string }
    socket.on("send_message", async ({ receiverId, content }) => {
      try {
        if (!receiverId || !content?.trim()) {
          return socket.emit("error", { message: "receiverId and content are required" });
        }

        if (content.length > 2000) {
          return socket.emit("error", { message: "Message too long (max 2000 chars)" });
        }

        // 1. Persist to MongoDB
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          business: businessId,
          content: content.trim(),
        });

        const populated = await Message.findById(message._id)
          .populate("sender", "name email")
          .populate("receiver", "name email")
          .lean();

        // 2. Cache in Redis (non-blocking; errors are swallowed inside)
        await appendMessageToCache(userId, receiverId, populated);

        // 3. Deliver to receiver's private room (even if on another socket)
        io.to(`user:${receiverId}`).emit("new_message", populated);

        // 4. Echo back to sender (confirms delivery + gives server timestamp)
        socket.emit("message_sent", populated);
      } catch (err) {
        console.error("send_message error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ── typing indicators ────────────────────────────────────────────────────
    socket.on("typing_start", ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit("user_typing", {
        userId,
        name: user.name,
      });
    });

    socket.on("typing_stop", ({ receiverId }) => {
      io.to(`user:${receiverId}`).emit("user_stopped_typing", { userId });
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      await removeOnlineUser(businessId, userId);
      console.log(`🔌 Socket disconnected: ${user.name}`);

      const updatedOnlineIds = await getOnlineUsers(businessId);
      io.to(`business:${businessId}`).emit("online_users", updatedOnlineIds);
      io.to(`business:${businessId}`).emit("user_offline", { userId });
    });
  });

  return io;
};

/** Expose io for use in controllers if needed (e.g. push notifications). */
const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};

module.exports = { initSocket, getIO };
