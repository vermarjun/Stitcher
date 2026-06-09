import { useEffect, useRef, useState } from "react";

interface GenerationProgressProps {
  /** Human-readable live step, e.g. "Rendering your animation…". */
  label: string;
  /** Real percentage floor (0–100) the current pipeline phase jumped to. */
  percent: number;
  /** Upper cap the bar may slowly creep toward while this phase runs. */
  ceil: number;
  /** Canonical phase key — surfaced as a data attribute for debugging. */
  phase: string;
}

// Creep tuning: every tick, close a small fraction of the gap to `ceil`, so the
// bar decelerates as it approaches the cap and never actually reaches it until
// the next REAL phase event bumps the floor. This keeps long stages (code-gen /
// render can take 60s+) from looking frozen without ever faking real progress.
const CREEP_INTERVAL_MS = 100;
const CREEP_RATE = 0.045;
const CREEP_STOP_GAP = 0.2; // halt micro-stepping once within this of the ceil

/**
 * Live generation-progress indicator: a spinner, an animated step label, and a
 * progress bar whose position is driven entirely by the REAL backend pipeline
 * phase.
 *
 * `percent` is the real floor the current phase reached (persisted by the
 * worker, so a page reload restores it exactly). While the phase runs the bar
 * gently creeps toward `ceil`; it is strictly monotonic (never moves backward,
 * even across the debug→re-render loop where the phase floor dips).
 *
 * The label entrance is a pure-CSS blur-up (see `step-label-in` in index.css),
 * re-triggered on each phase change by re-keying the word spans. Deliberately
 * dependency-free — an earlier `motion/AnimatePresence` version crashed the
 * dashboard under Vite's React resolution, so this path carries NO animation
 * library.
 */
export default function GenerationProgress({ label, percent, ceil, phase }: GenerationProgressProps) {
  const [displayed, setDisplayed] = useState(percent);
  const ceilRef = useRef(ceil);
  ceilRef.current = ceil;

  // Snap UP to a newly-arrived phase floor (monotonic — never down). The CSS
  // width transition animates the jump smoothly.
  useEffect(() => {
    setDisplayed((d) => (percent > d ? percent : d));
  }, [percent]);

  // Decelerating forward-only creep toward the current ceil.
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayed((d) => {
        const cap = ceilRef.current;
        if (cap - d <= CREEP_STOP_GAP) return d; // at/above cap → hold
        return d + (cap - d) * CREEP_RATE;
      });
    }, CREEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const pct = Math.max(0, Math.min(100, displayed));
  const words = label.split(" ");

  return (
    <div className="flex w-full gap-3 text-sm">
      <div className="flex-shrink-0">
        <img
          src="https://res.cloudinary.com/dodlenepk/image/upload/v1760610643/loading_animation_phpia7.gif"
          alt="Generating…"
          className="w-14 h-14 rounded-full"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Live step label — pure-CSS staggered blur-up; re-animates on every
            phase change because the label-derived keys remount the spans. */}
        <div className="mb-2 min-h-[1.1rem] flex flex-wrap items-center" aria-label={label}>
          {words.map((word, i) => (
            <span
              key={`${label}-${i}`}
              aria-hidden
              className="inline-block mr-[0.28em] text-xs font-medium text-zinc-100"
              style={{
                animation: "step-label-in 0.42s ease-out both",
                animationDelay: `${i * 0.06}s`,
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* Progress bar — width reflects the real backend phase. */}
        <div className="relative w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-zinc-300 to-white transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
          {/* Faint sweeping shimmer conveys "working" without implying progress. */}
          <div
            className="absolute inset-0 -translate-x-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
              animation: "shimmer 2s infinite",
            }}
            aria-hidden
          />
        </div>

        {/* Real percentage readout. */}
        <span className="mt-1.5 text-[10px] tabular-nums text-zinc-500" data-phase={phase}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
