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

async function generateServerImageBuffer({ prompt, model }) {
  if (process.env.GEMINI_API_KEY) {
    const geminiModel = model?.startsWith("imagen-")
      ? model
      : "imagen-3.0-generate-002";
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:predict?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1 },
        }),
      }
    );
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || "Gemini image generation failed.");
    }
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new Error("Gemini returned no image bytes.");
    return Buffer.from(b64, "base64");
  }

  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  const fallbackResp = await fetch(
    `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true`
  );
  if (!fallbackResp.ok) {
    throw new Error("Image generator is temporarily busy. Please try again.");
  }
  const arrayBuffer = await fallbackResp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const runImagePipeline = async ({
  file,
  originalFile,
  provider = "cloudinary",
  transformationType = "",
  stylePreset = "custom",
  prompt = "",
  model = "",
  color = "",
  aspectRatio = "1:1",
}) => {
  const composedPrompt = composePrompt(prompt, stylePreset);
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedType = String(transformationType || "").trim().toLowerCase();

  const isServerAiRequest =
    normalizedProvider === "ai" ||
    normalizedProvider === "puter" ||
    normalizedType === "texttoimage" ||
    normalizedType === "text-to-image" ||
    (!file && !originalFile && Boolean(prompt?.trim()));

  if (isServerAiRequest) {
    let originalUrl = "";
    const sourceUpload = originalFile || file;
    if (sourceUpload) {
      const uploadedOrig = await uploadBufferToCloudinary(
        sourceUpload.buffer,
        "vision-forge/originals"
      );
      originalUrl = uploadedOrig.secure_url;
    }

    const generatedBuffer =
      normalizedProvider === "puter" && file && !originalFile
        ? file.buffer
        : await generateServerImageBuffer({ prompt: composedPrompt, model });

    const uploadedGenerated = await uploadBufferToCloudinary(
      generatedBuffer,
      "vision-forge/generated"
    );

    return {
      mode: originalUrl ? "edit" : "generate",
      publicId: uploadedGenerated.public_id,
      originalUrl,
      transformedUrl: uploadedGenerated.secure_url,
      width: uploadedGenerated.width,
      height: uploadedGenerated.height,
      composedPrompt,
    };
  }

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
    prompt: composedPrompt,
    color,
  });

  return {
    mode: "edit",
    publicId: uploadedOriginal.public_id,
    originalUrl: uploadedOriginal.secure_url,
    transformedUrl,
    width: uploadedOriginal.width,
    height: uploadedOriginal.height,
    composedPrompt,
  };
};
