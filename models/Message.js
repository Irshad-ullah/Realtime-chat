const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Denormalized for fast querying — avoids a join to the User collection
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Message content cannot be empty"],
      trim: true,
      maxlength: [2000, "Message too long"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt acts as the message timestamp
  }
);

// Compound index for fast conversation retrieval
// Fetches all messages between two users in one query regardless of direction
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ business: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
