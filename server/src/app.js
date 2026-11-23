import express from "express";

import { clerkMiddleware } from "@clerk/express";
import healthRoutes from "./routes/healthRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";

const app = express();

import cors from "cors";

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

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/images", imageRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: err.message || "Server Error" });
});

app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Vision Forge API is running", health: "/api/health" });
});

export default app;
