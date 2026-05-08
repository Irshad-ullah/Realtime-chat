const express = require("express");
const { body } = require("express-validator");
const { getConversation, sendMessage } = require("../controllers/chatController");
const { isAuthenticated } = require("../middlewares/auth");

const router = express.Router();

// All chat routes require authentication
router.use(isAuthenticated);

router.get("/:receiverId", getConversation);

router.post(
  "/send",
  [
    body("receiverId").notEmpty().withMessage("receiverId is required"),
    body("content").trim().notEmpty().withMessage("Message content is required"),
  ],
  sendMessage
);

module.exports = router;
