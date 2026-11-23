import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import healthRoutes from "./routes/healthRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
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
