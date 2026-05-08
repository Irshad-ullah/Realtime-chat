const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const User = require("../models/User");

/**
 * Passport configuration.
 * Uses Local Strategy: username/password stored in MongoDB.
 * serialize/deserialize keeps only the user._id in the session,
 * so each request does a lightweight DB lookup by ID.
 */
module.exports = (passport) => {
  // ── Strategy ────────────────────────────────────────────────────────────────
  passport.use(
    "user-local",
    new LocalStrategy(
      { usernameField: "email", passReqToCallback: true },
      async (req, email, password, done) => {
        try {
          const { businessId } = req.body;

          if (!businessId) {
            return done(null, false, { message: "businessId is required" });
          }

          const user = await User.findOne({
            email: email.toLowerCase(),
            business: businessId,
          }).select("+password");

          if (!user) {
            return done(null, false, { message: "Invalid credentials" });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: "Invalid credentials" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // ── Serialize: store only user._id in session ────────────────────────────────
  passport.serializeUser((user, done) => {
    done(null, user._id.toString());
  });

  // ── Deserialize: fetch full user on every authenticated request ───────────────
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).populate("business", "name");
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
