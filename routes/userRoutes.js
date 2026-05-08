const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  logout,
  me,
  listByBusiness,
} = require("../controllers/userController");
const { isAuthenticated } = require("../middlewares/auth");

const router = express.Router();

const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("businessId").notEmpty().withMessage("businessId is required"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  body("businessId").notEmpty().withMessage("businessId is required"),
];

router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.post("/logout", isAuthenticated, logout);
router.get("/me", isAuthenticated, me);
router.get("/", isAuthenticated, listByBusiness);

module.exports = router;
