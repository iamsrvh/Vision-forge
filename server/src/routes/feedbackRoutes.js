import express from "express";
import { protectRoute } from "../middleware/authMiddleware.js";
import Feedback from "../models/Feedback.js";

const router = express.Router();

// Get all feedback (newest first)
router.get("/", protectRoute, async (req, res) => {
  try {
    const items = await Feedback.find()
      .populate("user", "email firstName lastName")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: items.length, feedback: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Submit new feedback
router.post("/", protectRoute, async (req, res) => {
  try {
    const { rating, category = "generation", message = "" } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Please select a rating (1-5)." });
    }
    if (!message.trim()) {
      return res.status(400).json({ success: false, message: "Please enter a feedback message." });
    }

    const feedback = await Feedback.create({
      user: req.user._id,
      email: req.user.email || "",
      rating: Number(rating),
      category,
      message: message.trim(),
    });

    return res.status(201).json({ success: true, feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
