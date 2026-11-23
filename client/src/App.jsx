import { useEffect, useState, useCallback } from "react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/react";
import puter from "@heyputer/puter.js";
import {
  Sparkles,
  CheckCircle2,
  Coins,
  Upload,
  Wand2,
  Download,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { useApi } from "./lib/useApi";
import BeforeAfterSlider from "./components/BeforeAfterSlider";

const MODES = [
  { value: "textToImage", label: "Text to Image (Puter AI)", needsFile: false },
  { value: "aiEdit", label: "AI Prompt Edit (Puter AI)", needsFile: true },
  { value: "restore", label: "AI Restore", needsFile: true },
  { value: "removeBackground", label: "Remove Background", needsFile: true },
  { value: "fill", label: "Generative Fill", needsFile: true },
  { value: "remove", label: "Object Remove", needsFile: true },
  { value: "recolor", label: "AI Recolor", needsFile: true },
];

const STYLE_PRESETS = [
  {
    id: "custom",
    label: "Custom",
    suffix: "",
  },
  {
    id: "cinematic-dark",
    label: "Cinematic Dark",
    suffix:
      "dark cinematic lighting, deep shadows, rich contrast, generous negative space, high-craft editorial finish",
  },
  {
    id: "90s-film",
    label: "90s Film",
    suffix:
      "authentic 1990s analog film photography, subtle grain, warm nostalgic highlights, natural candid look",
  },
  {
    id: "studio-product",
    label: "Studio Product",
    suffix:
      "clean commercial studio lighting, crisp edges, balanced highlights, sharp focus, high-end product photography",
  },
  {
    id: "editorial-arch",
    label: "Editorial Arch",
    suffix:
      "architectural digest editorial aesthetic, balanced lines, natural ambient light, refined tactile textures",
  },
];

const PUTER_MODELS = [
  { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1 Schnell (Fast)" },
  { id: "gpt-image-1", label: "GPT Image 1" },
  { id: "gemini-2.5-flash-image-preview", label: "Nano Banana" },
];

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const imgElementToBlob = async (imgEl) => {
  const res = await fetch(imgEl.src);
  return await res.blob();
};

export default function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();

  const [apiStatus, setApiStatus] = useState("checking");
  const [profile, setProfile] = useState(null);
  const [images, setImages] = useState([]);

  const [title, setTitle] = useState("");
  const [transformationType, setTransformationType] = useState("textToImage");
  const [puterModel, setPuterModel] = useState(PUTER_MODELS[0].id);
  const [stylePreset, setStylePreset] = useState("cinematic-dark");
  const [prompt, setPrompt] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [latestResult, setLatestResult] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const currentMode =
    MODES.find((m) => m.value === transformationType) || MODES[0];
  const isPuterMode =
    transformationType === "textToImage" || transformationType === "aiEdit";

  useEffect(() => {
    api
      .get("/health")
      .then((res) => {
        if (res.data?.success) setApiStatus("online");
      })
      .catch(() => setApiStatus("offline"));
  }, [api]);

  const loadAccountData = useCallback(async () => {
    try {
      const [meRes, imgsRes] = await Promise.all([
        api.get("/users/me"),
        api.get("/images"),
      ]);
      setProfile(meRes.data.user);
      setImages(imgsRes.data.images || []);
    } catch (err) {
      console.error("Failed to load account data:", err);
    }
  }, [api]);

  useEffect(() => {
    if (!isSignedIn) {
      setProfile(null);
      setImages([]);
      setLatestResult(null);
      return;
    }
    loadAccountData();
  }, [isSignedIn, loadAccountData]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusNote("");

    if (currentMode.needsFile && !file) {
      setErrorMsg("Please upload a source image first.");
      return;
    }

    if (transformationType === "textToImage" && !prompt.trim()) {
      setErrorMsg("Please enter a prompt describing the image to generate.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title || `${currentMode.label} Creation`);
      formData.append("transformationType", transformationType);
      formData.append("stylePreset", stylePreset);
      formData.append("prompt", prompt);
      formData.append("color", color);
      formData.append("aspectRatio", aspectRatio);

      if (isPuterMode) {
        const presetObj = STYLE_PRESETS.find((p) => p.id === stylePreset);
        const fullPrompt = [prompt.trim(), presetObj?.suffix]
          .filter(Boolean)
          .join(". ");

        setStatusNote("Generating via Puter AI (first run may ask to sign into Puter)...");

        const puterOptions = {
          model: puterModel,
        };

        if (transformationType === "aiEdit" && file) {
          const base64Data = await fileToBase64(file);
          puterOptions.input_image = base64Data;
          puterOptions.input_image_mime_type = file.type || "image/png";
        }

        const generatedImgEl = await puter.ai.txt2img(fullPrompt, puterOptions);
        setStatusNote("Saving generated result to Cloudinary & MongoDB...");

        const generatedBlob = await imgElementToBlob(generatedImgEl);
        formData.append("provider", "puter");
        formData.append("image", generatedBlob, "puter-generated.png");

        if (file) {
          formData.append("originalImage", file);
        }
      } else {
        formData.append("provider", "cloudinary");
        formData.append("image", file);
      }

      const { data } = await api.post("/images/transform", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data.success) {
        setLatestResult(data.image);
        setProfile((prev) =>
          prev ? { ...prev, creditBalance: data.creditBalance } : prev
        );
        setImages((prev) => [data.image, ...prev]);
        setTitle("");
        setPrompt("");
      }
    } catch (err) {
      console.error("Generation error:", err);
      setErrorMsg(
        err.response?.data?.message ||
          err.message ||
          "Generation failed. Please try again."
      );
    } finally {
      setSubmitting(false);
      setStatusNote("");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/images/${id}`);
      setImages((prev) => prev.filter((item) => item._id !== id));
      if (latestResult?._id === id) setLatestResult(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Loading authentication...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Vision Forge
              </h1>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span
                  className={
                    apiStatus === "online" ? "text-emerald-400" : "text-zinc-400"
                  }
                >
                  {apiStatus === "online"
                    ? "Puter AI + Cloudinary Studio Ready"
                    : "Checking API..."}
                </span>
              </p>
            </div>
          </div>

          {!isSignedIn ? (
            <div className="flex items-center gap-3">
              <SignInButton mode="modal">
                <button className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-sm font-medium cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white cursor-pointer">
                  Sign Up (10 Free Credits)
                </button>
              </SignUpButton>
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2">
              <div className="text-right">
                <p className="text-xs text-zinc-400">{profile?.email}</p>
                <p className="text-sm font-semibold text-amber-400 flex items-center justify-end gap-1">
                  <Coins className="h-4 w-4" />
                  {profile ? `${profile.creditBalance} Credits` : "Syncing..."}
                </p>
              </div>
              <UserButton />
            </div>
          )}
        </header>

        {!isSignedIn ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center space-y-3">
            <h2 className="text-lg font-medium">
              Sign in to create and transform visuals
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Generate images with FLUX, GPT Image, and Nano Banana via Puter
              AI, compare before & after, and save every creation to your
              gallery.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Controls */}
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5"
              >
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-indigo-400" />
                  Creative Studio (1 Credit)
                </h2>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Night Concrete Workspace"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Studio Mode
                    </label>
                    <select
                      value={transformationType}
                      onChange={(e) => setTransformationType(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isPuterMode ? (
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                        AI Model
                      </label>
                      <select
                        value={puterModel}
                        onChange={(e) => setPuterModel(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {PUTER_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                        Aspect Ratio
                      </label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="4:3">4:3 (Classic)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Style Presets */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">
                    Style Preset
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_PRESETS.map((preset) => {
                      const active = stylePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setStylePreset(preset.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition ${
                            active
                              ? "bg-indigo-600/25 border-indigo-500 text-indigo-200"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prompt Input */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Prompt / Edit Instruction
                  </label>
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      transformationType === "textToImage"
                        ? "Minimalist modern workspace at night with warm desk lamp glow and architectural concrete walls..."
                        : "Describe what to change, restyle, or transform..."
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {transformationType === "recolor" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Target Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-9 w-14 rounded cursor-pointer bg-transparent border border-zinc-800"
                      />
                      <span className="text-xs text-zinc-400">{color}</span>
                    </div>
                  </div>
                )}

                {currentMode.needsFile && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Source Image (Max 15MB)
                    </label>
                    <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-950/70 p-5 cursor-pointer transition">
                      <Upload className="h-5 w-5 text-zinc-400 mb-1.5" />
                      <span className="text-xs text-zinc-300">
                        {file ? file.name : "Click to upload source image"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {statusNote && (
                  <p className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2">
                    {statusNote}
                  </p>
                )}

                {errorMsg && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || (profile?.creditBalance ?? 0) < 1}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white cursor-pointer transition"
                >
                  {submitting
                    ? "Generating..."
                    : `Run ${currentMode.label} (-1 Credit)`}
                </button>
              </form>

              {/* Right: Interactive Before / After Preview */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col justify-between space-y-4">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-emerald-400" />
                  Before / After Canvas
                </h2>

                <div className="flex-1 min-h-[320px] rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center overflow-hidden p-3">
                  {latestResult ? (
                    <BeforeAfterSlider
                      beforeUrl={latestResult.originalUrl}
                      afterUrl={latestResult.transformedUrl}
                      alt={latestResult.title}
                    />
                  ) : previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="max-h-[360px] w-auto rounded-lg object-contain opacity-85"
                    />
                  ) : (
                    <p className="text-xs text-zinc-500 text-center max-w-xs">
                      Choose a model and preset, enter your prompt, and run a
                      generation or edit.
                    </p>
                  )}
                </div>

                {latestResult && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-zinc-400 truncate">
                      {latestResult.title} • {latestResult.stylePreset}
                    </span>
                    <a
                      href={latestResult.transformedUrl}
                      download={`${latestResult.title}.png`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Saved Gallery */}
            <section className="space-y-4">
              <h2 className="text-base font-semibold">
                Saved Creations ({images.length})
              </h2>

              {images.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No creations yet. Run your first prompt above.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {images.map((img) => (
                    <div
                      key={img._id}
                      onClick={() => setLatestResult(img)}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex flex-col cursor-pointer hover:border-zinc-700 transition"
                    >
                      <div className="h-48 bg-zinc-950 flex items-center justify-center overflow-hidden">
                        <img
                          src={img.transformedUrl}
                          alt={img.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {img.title}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {img.transformationType} • {img.stylePreset}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(img._id);
                          }}
                          className="p-2 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 cursor-pointer shrink-0"
                          title="Delete creation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
