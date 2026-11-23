import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = Number(process.env.PORT) || 5001;

connectDB().then(() => {
  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`Vision Forge server running on http://127.0.0.1:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("Server listen error:", err);
  });
});
