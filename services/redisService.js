/**
 * redisService.js — in-memory replacement (no Redis dependency).
 *
 * Online presence is tracked in a plain Map for the lifetime of the process.
 * This is fine for a single-container deployment.
 * Message caching functions are no-ops; chatController falls back to MongoDB.
 */

// Map<businessId, Set<userId>>
const onlineUsers = new Map();

const addOnlineUser = async (businessId, userId) => {
  if (!onlineUsers.has(businessId)) onlineUsers.set(businessId, new Set());
  onlineUsers.get(businessId).add(userId);
};

const removeOnlineUser = async (businessId, userId) => {
  onlineUsers.get(businessId)?.delete(userId);
};

const getOnlineUsers = async (businessId) => {
  return Array.from(onlineUsers.get(businessId) || []);
};

const isUserOnline = async (businessId, userId) => {
  return onlineUsers.get(businessId)?.has(userId) ?? false;
};

// Cache stubs — chatController already has MongoDB as fallback
const getCachedMessages = async () => null;
const cacheMessages = async () => {};
const appendMessageToCache = async () => {};
const invalidateCache = async () => {};

module.exports = {
  addOnlineUser,
  removeOnlineUser,
  getOnlineUsers,
  isUserOnline,
  getCachedMessages,
  cacheMessages,
  appendMessageToCache,
  invalidateCache,
};
