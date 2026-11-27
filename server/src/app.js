import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import healthRoutes from "./routes/healthRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";
import { protectRoute } from "./middleware/authMiddleware.js";
import { getCurrentUser } from "./controllers/userController.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://vision-forge-mu.vercel.app",
  process.env.CLIENT_URL,
]
  .filter(Boolean)
  .map((url) => url.replace(/\/+$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(clerkMiddleware());

app.get(["/", "/api"], (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "Vision Forge API",
    health: "/api/health",
  });
});

app.use("/api/health", healthRoutes);
app.get("/api/me", protectRoute, getCurrentUser);
app.use("/api/users", userRoutes);
app.use("/api/images", imageRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: err.message || "Server Error" });
});

export default app;
