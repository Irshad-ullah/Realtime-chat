const { validationResult } = require("express-validator");
const Message = require("../models/Message");
const {
  getCachedMessages,
  cacheMessages,
  appendMessageToCache,
} = require("../services/redisService");
const AppError = require("../utils/AppError");

/**
 * GET /api/chat/:receiverId
 * Retrieve conversation between the logged-in user and a receiver.
 *
 * Cache flow:
 *   1. Try Redis (fast, last N messages)
 *   2. On cache miss → query MongoDB → re-populate Redis cache
 */
const getConversation = async (req, res, next) => {
  try {
    const senderId = req.user._id.toString();
    const { receiverId } = req.params;
    const businessId = (req.user.business._id || req.user.business).toString();
    const limit = parseInt(req.query.limit) || parseInt(process.env.RECENT_MESSAGES_COUNT) || 20;

    // 1. Try cache first
    const cached = await getCachedMessages(senderId, receiverId);
    if (cached && cached.length > 0) {
      return res.json({
        success: true,
        source: "cache",
        data: { messages: cached.slice(-limit) },
      });
    }

    // 2. Cache miss — query MongoDB
    const messages = await Message.find({
      business: businessId,
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .lean();

    const ordered = messages.reverse(); // oldest first

    // 3. Populate cache for future reads
    if (ordered.length > 0) {
      await cacheMessages(senderId, receiverId, ordered);
    }

    res.json({
      success: true,
      source: "database",
      data: { messages: ordered },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chat/send
 * Send a message via REST (Socket.IO is the primary path; this is a fallback).
 */
const sendMessage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }

    const { receiverId, content } = req.body;
    const senderId = req.user._id.toString();
    const businessId = (req.user.business._id || req.user.business).toString();

    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      business: businessId,
      content,
    });

    const populated = await message.populate([
      { path: "sender", select: "name email" },
      { path: "receiver", select: "name email" },
    ]);

    // Append to Redis cache
    await appendMessageToCache(senderId, receiverId, populated.toObject());

    res.status(201).json({ success: true, data: { message: populated } });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConversation, sendMessage };
