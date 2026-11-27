import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Vision Forge server running on http://0.0.0.0:${PORT}`);
  });
});
app.get(["/", "/api"], (req, res) => {
  res.status(200).json({ status: "ok", service: "Vision Forge API" });
});