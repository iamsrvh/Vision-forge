import { Router } from "express";
import multer from "multer";
import { protectRoute } from "../middleware/authMiddleware.js";
import {
  transformImage,
  getUserImages,
  deleteImage,
} from "../controllers/imageController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.get("/", protectRoute, getUserImages);
router.post(
  "/transform",
  protectRoute,
  (req, res, next) => {
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "originalImage", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  transformImage
);
router.delete("/:id", protectRoute, deleteImage);

export default router;
