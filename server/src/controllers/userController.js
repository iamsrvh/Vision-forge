import Image from "../models/Image.js";

export const getCurrentUser = async (req, res) => {
  try {
    const totalImages = await Image.countDocuments({ author: req.user._id });
    res.status(200).json({
      success: true,
      user: req.user,
      stats: { totalImages },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
