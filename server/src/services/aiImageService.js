import cloudinary, { buildTransformedUrl, ensureCloudinaryConfigured } from "../config/cloudinary.js";

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
    try {
      ensureCloudinaryConfigured();
    } catch (cfgErr) {
      return reject(cfgErr);
    }
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

async function generateWithGemini({ prompt, model }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const geminiModel =
    model && model.startsWith("gemini-") && model.includes("image")
      ? model
      : "gemini-2.5-flash-image";

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
        },
      }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || "Gemini image generation failed.");
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const inlineImagePart = parts.find((part) => part?.inlineData?.data);
  if (!inlineImagePart?.inlineData?.data) {
    throw new Error("Gemini returned no image data in response.");
  }

  return Buffer.from(inlineImagePart.inlineData.data, "base64");
}

async function generateWithFallback({ prompt }) {
  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);

  const endpoints = [
    `https://gen.pollinations.ai/image/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true`,
  ];

  let lastError = null;
  for (const url of endpoints) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        lastError = new Error(`Fallback generator returned HTTP ${resp.status}`);
        continue;
      }
      const arrayBuffer = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      if (buf.length > 0) return buf;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Image generator is temporarily busy. Please try again.");
}

async function generateServerImageBuffer({ prompt, model }) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateWithGemini({ prompt, model });
    } catch (geminiErr) {
      console.warn(
        "Gemini image generation unavailable/quota-limited, falling back to server image generator:",
        geminiErr.message
      );
      return await generateWithFallback({ prompt });
    }
  }

  return await generateWithFallback({ prompt });
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
