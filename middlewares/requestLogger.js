/**
 * Simple request logger middleware.
 * In production you'd replace this with Winston or Pino.
 */
const requestLogger = (req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      console.log(
        `${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`
      );
    });
  }
  next();
};

module.exports = requestLogger;
