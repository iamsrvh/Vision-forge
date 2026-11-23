import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const buildTransformedUrl = ({
  publicId,
  transformationType,
  width = 1024,
  height = 1024,
  aspectRatio = "1:1",
  prompt = "",
  color = "",
}) => {
  const baseOptions = {
    secure: true,
    quality: "auto",
    fetch_format: "auto",
  };

  let transformation;

  switch (transformationType) {
    case "restore":
      transformation = [{ effect: "gen_restore" }, baseOptions];
      break;

    case "removeBackground":
      transformation = [{ effect: "background_removal" }, baseOptions];
      break;

    case "fill":
      transformation = [
        {
          aspect_ratio: aspectRatio || "1:1",
          crop: "pad",
          background: "gen_fill",
          width,
          height,
        },
        baseOptions,
      ];
      break;

    case "remove":
      transformation = [
        prompt
          ? { effect: `gen_remove:prompt_${encodeURIComponent(prompt.trim())}` }
          : { effect: "gen_remove" },
        baseOptions,
      ];
      break;

    case "recolor":
      transformation = [
        {
          effect:
            prompt && color
              ? `gen_recolor:prompt_${encodeURIComponent(prompt.trim())};to-color_${encodeURIComponent(color.replace(/^#/, "").trim())}`
              : "gen_restore",
        },
        baseOptions,
      ];
      break;

    default:
      transformation = [baseOptions];
  }

  return cloudinary.url(publicId, {
    transformation,
    secure: true,
  });
};

export default cloudinary;
