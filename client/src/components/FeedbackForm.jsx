import { useState, useEffect } from "react";
import { Star, Send, CheckCircle2, MessageSquare } from "lucide-react";

const CATEGORIES = [
  { id: "generation", label: "Image Quality" },
  { id: "ui", label: "Studio UI" },
  { id: "speed", label: "Speed" },
  { id: "feature", label: "Feature Request" },
  { id: "bug", label: "Bug Report" },
];

const ADMIN_EMAILS = [
  "sarveshmahato94@gmail.com",
  "sarveshkrmahato26@gmail.com",
];

export default function FeedbackForm({ api }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [category, setCategory] = useState("generation");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);

  const loadFeedback = async () => {
    try {
      const { data } = await api.get("/feedback");
      if (data?.feedback) setEntries(data.feedback);
    } catch {
      // Ignore if unavailable
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get("/me");
        const email = (data?.user?.email || "").toLowerCase();
        if (active && ADMIN_EMAILS.includes(email)) {
          setIsAdmin(true);
          loadFeedback();
        }
      } catch {
        // Ignore if unauthenticated
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please write a quick note before sending.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api.post("/feedback", { rating, category, message });
      setSubmitted(true);
      setMessage("");
      if (isAdmin) loadFeedback();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not send feedback. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="mt-14 border-t border-white/10 pt-10 pb-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[#12141f]/90 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Share Studio Feedback</h2>
              <p className="text-sm text-slate-400">
                Help improve Vision Forge models, presets, and canvas tools.
              </p>
            </div>

            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (hovered || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="rounded-lg p-1.5 transition hover:bg-white/5"
                  >
                    <Star
                      className={`h-5 w-5 transition ${
                        active ? "fill-amber-400 text-amber-400" : "text-slate-600"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {submitted ? (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Thanks! Your feedback was saved to Vision Forge.</span>
              </div>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-xs font-medium text-emerald-200 underline hover:text-white"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      category === item.id
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What worked well, or what should we improve next?"
                className="w-full rounded-xl border border-white/10 bg-[#0b0d14] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />

              {error && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Vision Forge Studio</span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "Sending..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          )}
        </div>

        {isAdmin && entries.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#12141f]/90 p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <span>Submitted Feedback ({entries.length})</span>
            </div>
            <div className="space-y-3">
              {entries.map((item) => (
                <div
                  key={item._id}
                  className="rounded-xl border border-white/10 bg-[#0b0d14] p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-200">
                      {item.email || item.user?.email || "User"}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="rounded bg-white/5 px-2 py-0.5 capitalize text-indigo-300">
                        {item.category}
                      </span>
                      <span className="text-amber-400">{"★".repeat(item.rating)}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-slate-300">{item.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
