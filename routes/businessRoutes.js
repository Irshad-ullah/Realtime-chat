const express = require("express");
const { body } = require("express-validator");
const { register, login, getById } = require("../controllers/businessController");

const router = express.Router();

const registerValidation = [
  body("name").trim().notEmpty().withMessage("Business name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.get("/:id", getById);

module.exports = router;
