import { useEffect, useState, useCallback } from "react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/react";
import {
  MotionConfig,
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
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

const APPLE_EASE = [0.22, 1, 0.36, 1];

const MODES = [
  { value: "textToImage", label: "Text to Image", needsFile: false },
  { value: "aiEdit", label: "AI Prompt Edit", needsFile: true },
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

const AI_MODELS = [
  { id: "imagen-3.0-generate-002", label: "Imagen 3 (Studio Fast)" },
  { id: "gemini-2.5-flash-image", label: "Gemini Flash Image" },
];

const ASPECT_RATIOS = ["1:1", "4:3", "16:9", "3:4", "9:16"];

export default function App() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();

  const { scrollY } = useScroll();
  const heroGlowY = useTransform(scrollY, [0, 500], [0, -70]);
  const heroGlowOpacity = useTransform(scrollY, [0, 450], [0.42, 0.14]);

  const [profile, setProfile] = useState(null);
  const [images, setImages] = useState([]);
  const [latestResult, setLatestResult] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const [title, setTitle] = useState("");
  const [transformationType, setTransformationType] = useState("textToImage");
  const [stylePreset, setStylePreset] = useState("cinematic-dark");
  const [prompt, setPrompt] = useState("");
  const [aiModel, setAiModel] = useState(AI_MODELS[0].id);
  const [color, setColor] = useState("#6366f1");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const currentMode =
    MODES.find((m) => m.value === transformationType) || MODES[0];
  const isAiGenerationMode =
    transformationType === "textToImage" || transformationType === "aiEdit";

  const loadWorkspace = useCallback(async () => {
    if (!isSignedIn) return;
    setLoadingData(true);
    setErrorMsg("");
    try {
      const [meRes, listRes] = await Promise.all([
        api.get("/me"),
        api.get("/images"),
      ]);
      setProfile(meRes.data.user);
      setImages(listRes.data.images || []);
    } catch (err) {
      console.error("Workspace load error:", err);
      setErrorMsg(
        err.response?.data?.message ||
          "Could not load workspace data from server."
      );
    } finally {
      setLoadingData(false);
    }
  }, [isSignedIn, api]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadWorkspace();
    }
  }, [isLoaded, isSignedIn, loadWorkspace]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setFile(selected || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isAiGenerationMode && !file) {
      setErrorMsg("Please upload a source image for this transformation.");
      return;
    }
    if (transformationType === "textToImage" && !prompt.trim()) {
      setErrorMsg("Please enter a prompt for Text to Image.");
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

      if (isAiGenerationMode) {
        const presetObj = STYLE_PRESETS.find((p) => p.id === stylePreset);
        const fullPrompt = [prompt.trim(), presetObj?.suffix]
          .filter(Boolean)
          .join(". ");

        setStatusNote("Generating image via Vision Forge Studio...");
        formData.append("provider", "ai");
        formData.append("model", aiModel);
        if (fullPrompt) {
          formData.set("prompt", fullPrompt);
        }
        if (file) {
          formData.append("originalImage", file);
        }
      } else {
        setStatusNote("Processing transformation on server...");
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
      setErrorMsg("Failed to delete image.");
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip bg-[#07080a] text-[#f4f6fa]">
        {/* Ambient Apple-style radial spotlight with scroll depth */}
        <motion.div
          aria-hidden="true"
          style={{ y: heroGlowY, opacity: heroGlowOpacity }}
          className="pointer-events-none fixed inset-x-0 -top-36 z-0 mx-auto h-[420px] w-[820px] rounded-full bg-indigo-500/20 blur-[135px]"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Top Navigation Bar */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="apple-glass apple-hairline mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 8, scale: 1.04 }}
                transition={{ duration: 0.25, ease: APPLE_EASE }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/30"
              >
                <Sparkles className="h-5 w-5 text-indigo-400" />
              </motion.div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  Vision Forge
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Vision Forge Studio Ready
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isLoaded ? (
                <div className="h-8 w-24 animate-pulse rounded-full bg-zinc-800/80" />
              ) : isSignedIn ? (
                <>
                  {profile?.email && (
                    <span className="hidden text-xs text-zinc-400 sm:inline">
                      {profile.email}
                    </span>
                  )}
                  <motion.div
                    key={profile?.creditBalance ?? "credits"}
                    initial={{ scale: 0.94, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.28, ease: APPLE_EASE }}
                    className="flex items-center gap-1.5 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-indigo-200"
                  >
                    <Coins className="h-3.5 w-3.5 text-indigo-400" />
                    <span>
                      {loadingData
                        ? "Loading..."
                        : `${profile?.creditBalance ?? 0} Credits`}
                    </span>
                  </motion.div>
                  <UserButton afterSignOutUrl="/" />
                </>
              ) : (
                <div className="flex items-center gap-2.5">
                  <SignInButton mode="modal">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.16, ease: APPLE_EASE }}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                    >
                      Sign In
                    </motion.button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.16, ease: APPLE_EASE }}
                      className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
                    >
                      Get Started
                    </motion.button>
                  </SignUpButton>
                </div>
              )}
            </div>
          </motion.header>

          {!isSignedIn && isLoaded ? (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: APPLE_EASE }}
              className="apple-glass apple-hairline mx-auto max-w-xl rounded-3xl p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-400/30">
                <Sparkles className="h-6 w-6 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Craft studio visuals with fluid precision
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
                Sign in once to generate images, apply editorial style presets,
                compare before-and-after results, and manage your saved studio
                creations.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <SignInButton mode="modal">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.16, ease: APPLE_EASE }}
                    className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
                  >
                    Sign In to Studio
                  </motion.button>
                </SignInButton>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {/* Main Studio Split */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left: Controls */}
                <motion.form
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.06, ease: APPLE_EASE }}
                  className="apple-glass apple-hairline space-y-5 rounded-3xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                >
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
                    <Wand2 className="h-4 w-4 text-indigo-400" />
                    Creative Studio (1 Credit)
                  </h2>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Night Concrete Workspace"
                      className="w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Studio Mode
                      </label>
                      <select
                        value={transformationType}
                        onChange={(e) => setTransformationType(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 py-2.5 text-sm text-white transition focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {MODES.map((m) => (
                          <option
                            key={m.value}
                            value={m.value}
                            className="bg-zinc-900"
                          >
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        AI Model
                      </label>
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 py-2.5 text-sm text-white transition focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {AI_MODELS.map((m) => (
                          <option
                            key={m.id}
                            value={m.id}
                            className="bg-zinc-900"
                          >
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Apple-style segmented style preset selector */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-zinc-400">
                      Style Preset
                    </label>
                    <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/8 bg-zinc-950/60 p-1.5">
                      {STYLE_PRESETS.map((preset) => {
                        const active = stylePreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setStylePreset(preset.id)}
                            className={`relative rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                              active ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="activeStylePresetPill"
                                transition={{
                                  type: "spring",
                                  stiffness: 420,
                                  damping: 34,
                                }}
                                className="absolute inset-0 rounded-xl bg-indigo-600/90 shadow-sm"
                              />
                            )}
                            <span className="relative z-10">{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                      Prompt / Edit Instruction
                    </label>
                    <textarea
                      rows={3}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Minimalist modern workspace at night with warm desk lamp glow and architectural concrete walls..."
                      className="w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 transition focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  {transformationType === "fill" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Aspect Ratio
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ASPECT_RATIOS.map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setAspectRatio(ratio)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                              aspectRatio === ratio
                                ? "bg-indigo-600 text-white"
                                : "border border-white/10 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {transformationType === "recolor" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Target Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                        />
                        <span className="text-xs text-zinc-300">{color}</span>
                      </div>
                    </div>
                  )}

                  {currentMode.needsFile && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Source Image
                      </label>
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-zinc-950/50 px-4 py-5 text-center transition hover:border-indigo-400/50 hover:bg-zinc-900/50">
                        <Upload className="mb-1.5 h-5 w-5 text-zinc-400" />
                        <span className="text-xs font-medium text-zinc-300">
                          {file ? file.name : "Choose an image file"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      {previewUrl && (
                        <motion.img
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: APPLE_EASE }}
                          src={previewUrl}
                          alt="Source preview"
                          className="mt-3 max-h-40 rounded-xl border border-white/10 object-cover"
                        />
                      )}
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {statusNote && (
                      <motion.div
                        key="status-note"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25, ease: APPLE_EASE }}
                        className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3.5 py-2.5 text-xs text-indigo-200"
                      >
                        {statusNote}
                      </motion.div>
                    )}

                    {errorMsg && (
                      <motion.div
                        key="error-msg"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25, ease: APPLE_EASE }}
                        className="rounded-xl border border-rose-500/30 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-200"
                      >
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileHover={{ scale: submitting ? 1 : 1.012 }}
                    whileTap={{ scale: submitting ? 1 : 0.98 }}
                    transition={{ duration: 0.18, ease: APPLE_EASE }}
                    className="w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(79,70,229,0.38)] transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? "Generating..."
                      : `Run ${currentMode.label} (-1 Credit)`}
                  </motion.button>
                </motion.form>

                {/* Right: Before / After Canvas */}
                <motion.section
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.12, ease: APPLE_EASE }}
                  className="apple-glass apple-hairline flex flex-col rounded-3xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
                      <ImageIcon className="h-4 w-4 text-indigo-400" />
                      Before / After Canvas
                    </h2>
                    {latestResult?.transformedUrl && (
                      <a
                        href={latestResult.transformedUrl}
                        download={`${latestResult.title || "vision-forge"}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    )}
                  </div>

                  <div className="flex min-h-[380px] flex-1 items-center justify-center rounded-2xl border border-white/8 bg-zinc-950/60 p-4">
                    <AnimatePresence mode="wait">
                      {submitting ? (
                        <motion.div
                          key="generating-state"
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.35, ease: APPLE_EASE }}
                          className="flex flex-col items-center gap-3 text-center"
                        >
                          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
                          <p className="text-xs text-zinc-400">
                            {statusNote || "Rendering your creation..."}
                          </p>
                        </motion.div>
                      ) : latestResult?.transformedUrl ? (
                        <motion.div
                          key={latestResult._id || latestResult.transformedUrl}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.45, ease: APPLE_EASE }}
                          className="w-full space-y-3"
                        >
                          {latestResult.originalUrl ? (
                            <BeforeAfterSlider
                              beforeUrl={latestResult.originalUrl}
                              afterUrl={latestResult.transformedUrl}
                            />
                          ) : (
                            <img
                              src={latestResult.transformedUrl}
                              alt={latestResult.title || "Generated result"}
                              className="max-h-[420px] w-full rounded-xl object-contain"
                            />
                          )}
                          <div className="flex items-center justify-between pt-1 text-xs text-zinc-400">
                            <span className="font-medium text-zinc-200">
                              {latestResult.title}
                            </span>
                            <span>{latestResult.transformationType}</span>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.p
                          key="empty-canvas"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3, ease: APPLE_EASE }}
                          className="max-w-xs text-center text-xs leading-relaxed text-zinc-500"
                        >
                          Choose a model and preset, enter your prompt, and run
                          a generation or edit.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.section>
              </div>

              {/* Saved Creations Gallery */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: "some" }}
                transition={{ duration: 0.55, ease: APPLE_EASE }}
                className="space-y-4"
              >
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Saved Creations ({images.length})
                </h2>

                {images.length === 0 ? (
                  <div className="apple-glass apple-hairline rounded-2xl p-8 text-center text-xs text-zinc-500">
                    No creations saved yet. Run your first generation above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {images.map((item, idx) => (
                      <motion.article
                        key={item._id}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: "some" }}
                        transition={{
                          duration: 0.45,
                          delay: Math.min(idx * 0.05, 0.25),
                          ease: APPLE_EASE,
                        }}
                        whileHover={{ y: -4 }}
                        onClick={() => setLatestResult(item)}
                        className="apple-glass apple-hairline group cursor-pointer overflow-hidden rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition hover:border-white/20"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-950">
                          <img
                            src={item.transformedUrl || item.originalUrl}
                            alt={item.title || "Saved creation"}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 p-4">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium text-white">
                              {item.title || "Untitled"}
                            </h3>
                            <p className="text-xs text-zinc-400">
                              {item.transformationType || "textToImage"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item._id);
                            }}
                            aria-label="Delete creation"
                            className="rounded-lg p-2 text-zinc-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </motion.section>
            </div>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}
