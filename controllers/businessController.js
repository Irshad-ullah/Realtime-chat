const Business = require("../models/Business");
const { validationResult } = require("express-validator");
const AppError = require("../utils/AppError");

/**
 * POST /api/business/register
 * Register a new business account.
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }

    const { name, email, password } = req.body;

    const existing = await Business.findOne({ email });
    if (existing) {
      return next(new AppError("Email already registered", 409));
    }

    const business = await Business.create({ name, email, password });

    res.status(201).json({
      success: true,
      message: "Business registered successfully",
      data: { business },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/business/login
 * Business login — returns the business doc (no session; business uses their
 * businessId to scope user operations).
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array()[0].msg, 400));
    }

    const { email, password } = req.body;

    const business = await Business.findOne({ email }).select("+password");
    if (!business || !(await business.comparePassword(password))) {
      return next(new AppError("Invalid credentials", 401));
    }

    res.json({
      success: true,
      message: "Login successful",
      data: { business },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/business/:id
 * Get business info (public profile).
 */
const getById = async (req, res, next) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return next(new AppError("Business not found", 404));
    }
    res.json({ success: true, data: { business } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getById };
