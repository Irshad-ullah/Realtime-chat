const AppError = require("../utils/AppError");

/**
 * Global Express error handler.
 * All errors passed to next(err) land here.
 * Differentiates between operational errors (AppError) and unexpected bugs.
 */
const errorHandler = (err, req, res, next) => {
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    err = new AppError(`Duplicate value for field: ${field}`, 409);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    err = new AppError(messages.join(", "), 400);
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    err = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  const statusCode = err.statusCode || 500;
  const status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    return res.status(statusCode).json({
      success: false,
      status,
      message: err.message,
      stack: err.stack,
    });
  }

  // Production: hide internal details for non-operational errors
  if (err.isOperational) {
    return res.status(statusCode).json({
      success: false,
      status,
      message: err.message,
    });
  }

  console.error("Unexpected error:", err);
  res.status(500).json({
    success: false,
    status: "error",
    message: "Something went wrong. Please try again later.",
  });
};

module.exports = errorHandler;
