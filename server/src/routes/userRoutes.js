import { Router } from "express";
import { protectRoute } from "../middleware/authMiddleware.js";
import { getCurrentUser } from "../controllers/userController.js";

const router = Router();
router.get("/me", protectRoute, getCurrentUser);

export default router;
