import cloudinary from "../config/cloudinary.js";
import { runImagePipeline } from "../services/aiImageService.js";
import Image from "../models/Image.js";
import User from "../models/User.js";

const CREDIT_COST = 1;

export const transformImage = async (req, res) => {
  try {
    const {
      title = "Untitled Creation",
      provider = "cloudinary",
      transformationType = "aiEdit",
      stylePreset = "custom",
      prompt = "",
      color = "",
      aspectRatio = "1:1",
    } = req.body;

    const mainFile = req.files?.image?.[0] || null;
    const origFile = req.files?.originalImage?.[0] || null;

    const currentUser = await User.findById(req.user._id);
    if (!currentUser || currentUser.creditBalance < CREDIT_COST) {
      return res.status(402).json({
        success: false,
        message: "Insufficient credits. Each generation/edit requires 1 credit.",
      });
    }

    const pipelineResult = await runImagePipeline({
      file: mainFile,
      originalFile: origFile,
      provider,
      transformationType,
      stylePreset,
      prompt,
      color,
      aspectRatio,
    });

    const imageRecord = await Image.create({
      title: title.trim() || `${transformationType} creation`,
      mode: pipelineResult.mode,
      transformationType,
      stylePreset,
      publicId: pipelineResult.publicId,
      originalUrl: pipelineResult.originalUrl,
      transformedUrl: pipelineResult.transformedUrl,
      width: pipelineResult.width,
      height: pipelineResult.height,
      aspectRatio,
      prompt: pipelineResult.composedPrompt,
      color,
      author: req.user._id,
    });

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, creditBalance: { $gte: CREDIT_COST } },
      { $inc: { creditBalance: -CREDIT_COST } },
      { new: true }
    );

    res.status(201).json({
      success: true,
      image: imageRecord,
      creditBalance: updatedUser
        ? updatedUser.creditBalance
        : currentUser.creditBalance,
    });
  } catch (error) {
    console.error("Transform Image Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process image request.",
    });
  }
};

export const getUserImages = async (req, res) => {
  try {
    const images = await Image.find({ author: req.user._id }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const image = await Image.findOneAndDelete({
      _id: req.params.id,
      author: req.user._id,
    });

    if (!image) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found." });
    }

    if (image.publicId) {
      await cloudinary.uploader.destroy(image.publicId).catch(() => {});
    }

    res.status(200).json({ success: true, message: "Image deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
