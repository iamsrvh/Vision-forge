import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    photo: { type: String, default: "" },
    creditBalance: { type: Number, default: 10 },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
