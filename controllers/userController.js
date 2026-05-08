const passport = require("passport");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const Business = require("../models/Business");
const { removeOnlineUser, getOnlineUsers } = require("../services/redisService");
const AppError = require("../utils/AppError");

/**
 * POST /api/users/register
 * Register a new user under a specific business.
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }

    const { name, email, password, businessId } = req.body;

    // Verify the business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return next(new AppError("Business not found", 404));
    }

    // Check duplicate email within same business
    const existing = await User.findOne({ email, business: businessId });
    if (existing) {
      return next(new AppError("Email already registered in this business", 409));
    }

    const user = await User.create({
      name,
      email,
      password,
      business: businessId,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/login
 * Authenticate via Passport local strategy; creates a server-side session.
 */
const login = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 400));
  }

  passport.authenticate("user-local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return next(new AppError(info?.message || "Invalid credentials", 401));

    req.logIn(user, (err) => {
      if (err) return next(err);
      res.json({
        success: true,
        message: "Logged in successfully",
        data: { user },
      });
    });
  })(req, res, next);
};

/**
 * POST /api/users/logout
 * Destroy session and remove from online users in Redis.
 */
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await removeOnlineUser(req.user.business.toString(), req.user._id.toString());
    }

    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Logged out successfully" });
      });
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/me
 * Return the currently authenticated user.
 */
const me = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

/**
 * GET /api/users
 * List all users in the same business (for building the contact list in the UI).
 */
const listByBusiness = async (req, res, next) => {
  try {
    const businessId = req.user.business._id || req.user.business;
    const users = await User.find({
      business: businessId,
      _id: { $ne: req.user._id }, // exclude self
    }).select("name email");

    // Enrich with online status from Redis
    const onlineIds = await getOnlineUsers(businessId.toString());
    const onlineSet = new Set(onlineIds);

    const enriched = users.map((u) => ({
      ...u.toJSON(),
      online: onlineSet.has(u._id.toString()),
    }));

    res.json({ success: true, data: { users: enriched } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, me, listByBusiness };
