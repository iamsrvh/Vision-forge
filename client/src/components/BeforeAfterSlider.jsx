import { useState } from "react";
import { MoveHorizontal } from "lucide-react";

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  alt = "Comparison",
}) {
  const [position, setPosition] = useState(50);

  if (!beforeUrl) {
    return (
      <img
        src={afterUrl}
        alt={alt}
        className="max-h-[380px] w-auto rounded-lg object-contain"
      />
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="relative w-full h-[340px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 select-none">
        {/* After (Transformed) Base */}
        <img
          src={afterUrl}
          alt={`${alt} transformed`}
          className="absolute inset-0 h-full w-full object-contain"
        />

        {/* Before (Original) Clipped */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={beforeUrl}
            alt={`${alt} original`}
            className="h-full w-full object-contain"
          />
        </div>

        {/* Divider Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 pointer-events-none"
          style={{ left: `${position}%` }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-zinc-900 border border-indigo-400 text-indigo-300 flex items-center justify-center shadow-lg">
            <MoveHorizontal className="h-4 w-4" />
          </div>
        </div>

        <span className="absolute top-2.5 left-2.5 text-[11px] px-2 py-0.5 rounded bg-zinc-950/80 text-zinc-200 border border-zinc-800">
          Original
        </span>
        <span className="absolute top-2.5 right-2.5 text-[11px] px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-200 border border-indigo-500/40">
          Result
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label="Before and after comparison slider"
        className="w-full accent-indigo-500 cursor-pointer"
      />
    </div>
  );
}
