const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const passport = require("passport");
const path = require("path");

const passportConfig = require("./config/passport");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");

// Routes
const businessRoutes = require("./routes/businessRoutes");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(requestLogger);

// ─── Session (backed by Redis for performance) ────────────────────────────────
// WHY SESSIONS over JWT:
//   - Easier invalidation (just delete the session key in Redis)
//   - No token refresh complexity
//   - Server-side control; fine for same-origin web apps
//   - Redis store makes it fast and horizontally scalable
app.use(
  session({
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24h
    },
  })
);

// ─── Passport ─────────────────────────────────────────────────────────────────
passportConfig(passport);
app.use(passport.initialize());
app.use(passport.session());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/business", businessRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
