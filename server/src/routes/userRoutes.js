// Example inside server/src/routes/userRoutes.js (mounted at app.use("/api", userRoutes))
import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.get("/me", async (req, res) => {
  try {
    // Support Clerk auth middleware (req.auth.userId) or header/query fallback
    const clerkId = req.auth?.userId || req.headers["x-clerk-user-id"] || req.query.clerkId;
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized: Missing Clerk user ID" });
    }

    let user = await User.findOne({ clerkId });

    // Auto-create user with 10 starter credits if Clerk webhook hasn't synced yet
    if (!user) {
      user = await User.create({
        clerkId,
        email: `${clerkId}@placeholder.local`,
        username: `user_${clerkId.slice(-6)}`,
        photo: "https://placehold.co/200x200",
        creditBalance: 10,
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;