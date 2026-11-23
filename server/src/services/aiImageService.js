import cloudinary, { buildTransformedUrl } from "../config/cloudinary.js";

const STYLE_PROMPTS = {
  "cinematic-dark":
    "dark cinematic lighting, deep shadows, rich contrast, generous negative space, high-craft editorial finish",
  "90s-film":
    "authentic 1990s analog film photography, subtle grain, warm nostalgic highlights, natural candid look",
  "studio-product":
    "clean commercial studio lighting, crisp edges, balanced highlights, sharp focus, high-end product photography",
  "editorial-arch":
    "architectural digest editorial aesthetic, balanced lines, natural ambient light, refined tactile textures",
  custom: "",
};

export const composePrompt = (prompt = "", stylePreset = "custom") => {
  const cleanPrompt = prompt.trim();
  const presetSuffix = STYLE_PROMPTS[stylePreset] || "";
  if (cleanPrompt && presetSuffix) return `${cleanPrompt}. ${presetSuffix}`;
  return cleanPrompt || presetSuffix || "high quality studio image enhancement";
};

export const uploadBufferToCloudinary = (
  buffer,
  folder = "vision-forge/results"
) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

export const runImagePipeline = async ({
  file,
  originalFile,
  provider = "cloudinary",
  transformationType,
  stylePreset = "custom",
  prompt = "",
  color = "",
  aspectRatio = "1:1",
}) => {
  // Handle client-rendered Puter.js outputs (Text-to-Image or Image-to-Image)
  if (provider === "puter") {
    if (!file) {
      throw new Error("Missing generated image payload from Puter.js.");
    }

    let originalUrl = "";
    if (originalFile) {
      const uploadedOrig = await uploadBufferToCloudinary(
        originalFile.buffer,
        "vision-forge/originals"
      );
      originalUrl = uploadedOrig.secure_url;
    }

    const uploadedGenerated = await uploadBufferToCloudinary(
      file.buffer,
      "vision-forge/generated"
    );

    return {
      mode: originalFile ? "edit" : "generate",
      publicId: uploadedGenerated.public_id,
      originalUrl,
      transformedUrl: uploadedGenerated.secure_url,
      width: uploadedGenerated.width,
      height: uploadedGenerated.height,
      composedPrompt: composePrompt(prompt, stylePreset),
    };
  }

  // Standard Cloudinary transformations (Restore, Remove BG, Fill, Remove, Recolor)
  if (!file) {
    throw new Error("Please upload a source image for this transformation.");
  }

  const uploadedOriginal = await uploadBufferToCloudinary(
    file.buffer,
    "vision-forge/originals"
  );

  const transformedUrl = buildTransformedUrl({
    publicId: uploadedOriginal.public_id,
    transformationType,
    width: uploadedOriginal.width || 1024,
    height: uploadedOriginal.height || 1024,
    aspectRatio,
    prompt: composePrompt(prompt, stylePreset),
    color,
  });

  return {
    mode: "edit",
    publicId: uploadedOriginal.public_id,
    originalUrl: uploadedOriginal.secure_url,
    transformedUrl,
    width: uploadedOriginal.width,
    height: uploadedOriginal.height,
    composedPrompt: composePrompt(prompt, stylePreset),
  };
};
