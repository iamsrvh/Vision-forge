import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    mode: {
      type: String,
      enum: ["edit", "generate"],
      default: "edit",
    },
    transformationType: {
      type: String,
      required: true,
      enum: [
        "aiEdit",
        "textToImage",
        "restore",
        "removeBackground",
        "fill",
        "remove",
        "recolor",
      ],
    },
    stylePreset: { type: String, default: "custom" },
    publicId: { type: String, required: true },
    originalUrl: { type: String, default: "" },
    transformedUrl: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    aspectRatio: { type: String, default: "1:1" },
    prompt: { type: String, default: "" },
    color: { type: String, default: "" },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Image", imageSchema);
