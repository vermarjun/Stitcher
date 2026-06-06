import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedShinyText } from "@/Components/magicui/animated-shiny-text";

// Mobile-only: plays the video only while it's in the viewport so all 7 never
// play (or buffer) simultaneously. Each video manages its own muted state;
// `unmuted` prop drives it from the parent so only one plays with sound at once.
function MobilePluginVideo({
  plugin,
  unmuted,
  onUnmute,
}: {
  plugin: Plugin;
  unmuted: boolean;
  onUnmute: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !plugin.videoSrc) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [plugin.videoSrc]);

  // Sync muted state imperatively (React doesn't re-apply the muted attribute)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !unmuted;
  }, [unmuted]);

  if (!plugin.videoSrc) {
    return (
      <img
        src={plugin.imageSrc}
        alt={plugin.domain}
        loading="lazy"
        className="w-full h-full object-cover"
        style={{ filter: "brightness(0.45) saturate(1.1)" }}
      />
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={plugin.videoSrc}
        loop
        muted
        playsInline
        preload="none"
        poster={plugin.imageSrc}
        className="w-full h-full object-cover"
      />
      {/* Per-video unmute button — centered overlay, only visible when muted */}
      {!unmuted && (
        <button
          onClick={onUnmute}
          className="absolute inset-0 flex items-center justify-center group"
          aria-label="Unmute video"
        >
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 backdrop-blur-sm transition-all group-active:scale-95">
            <VolumeX size={13} className="text-white/70" />
            <span className="text-[11px] font-medium text-white/80">Unmute</span>
          </div>
        </button>
      )}
      {/* Mute button shown when this video is already unmuted */}
      {unmuted && (
        <button
          onClick={onUnmute}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 backdrop-blur-sm"
          aria-label="Mute video"
        >
          <Volume2 size={11} className="text-white/70" />
          <span className="text-[10px] font-medium text-white/70">Mute</span>
        </button>
      )}
    </>
  );
}

type Plugin = {
  domain: string;
  tag: string;
  headline: string;
  description: string;
  prompts: string[];
  videoSrc: string | null;
  imageSrc: string;
  accent: string;
};

const PLUGINS: Plugin[] = [
  {
    domain: "Chess",
    tag: "Strategy",
    headline: "Move by Move.",
    description:
      "From openings to endgames, Stitcher handles board geometry. One prompt animates any tactic.",
    prompts: [
      "Show the Sicilian Defense opening",
      "Explain the pin tactic with arrows",
      "Animate a mate-in-3 puzzle",
    ],
    videoSrc:
      "https://res.cloudinary.com/dloh4tkp5/video/upload/v1780397868/stitcher/final/6a1eb22933e26be4a040188c/wwtb6fswizzwh5qvnzcl.mp4",
    imageSrc: "/landing-assets/plugins/chess.png",
    accent: "#F0B429",
  },
  {
    domain: "Data Structures & Algorithms",
    tag: "Computer Science",
    headline: "See the Algorithm.",
    description:
      "Watch exactly how any algorithm runs through its data. Nodes, edges, swaps and all.",
    prompts: [
      "Animate depth first traversal on a graph",
      "Show merge sort step by step",
      "Animate BFS on a binary tree",
    ],
    videoSrc:
      "https://res.cloudinary.com/dloh4tkp5/video/upload/v1780398059/stitcher/final/6a1eb22933e26be4a040188c/kqonslglgwrf66rlfich.mp4",
    imageSrc: "/landing-assets/plugins/data-structures.png",
    accent: "#10B981",
  },
  {
    domain: "Graphs, Calculus & Geometry",
    tag: "Mathematics",
    headline: "Math Made Tangible.",
    description:
      "Type any function and see it come alive. Integrals, 3D surfaces, moving tangent lines.",
    prompts: [
      "Plot sin(x)·e^(−x/4) and shade the integral",
      "Show a tangent line moving along a curve",
      "Animate a convex 3D surface",
    ],
    videoSrc:
      "https://res.cloudinary.com/dloh4tkp5/video/upload/v1780512287/stitcher/final/6a1f388d3972ea8b005badd1/d7409hootysefzzg0run.mp4",
    imageSrc: "/landing-assets/plugins/core-math.png",
    accent: "#8B5CF6",
  },
  {
    domain: "Machine Learning",
    tag: "AI & ML",
    headline: "Open the Box.",
    description:
      "From forward passes to attention heads, make neural networks legible to any audience.",
    prompts: [
      "Visualize word embeddings in 3D space",
      "Animate a neural net forward pass",
      "Show how a CNN processes an image",
    ],
    videoSrc:
      "https://res.cloudinary.com/dloh4tkp5/video/upload/v1780398116/stitcher/final/6a1eb22933e26be4a040188c/drsklmi5kwcoersxazcd.mp4",
    imageSrc: "/landing-assets/plugins/neural-network.png",
    accent: "#EC4899",
  },
  {
    domain: "Physics",
    tag: "Physics",
    headline: "See the Invisible.",
    description:
      "Field lines, wave patterns, pendulums gone chaotic. Physics made instantly intuitive.",
    prompts: [
      "Show an electric dipole field",
      "Animate a double pendulum going chaotic",
      "Visualize wave interference patterns",
    ],
    videoSrc:
      "https://res.cloudinary.com/dloh4tkp5/video/upload/v1780398196/stitcher/final/6a1eb22933e26be4a040188c/didvwytsit18ida38emi.mp4",
    imageSrc: "/landing-assets/plugins/physics.png",
    accent: "#F97316",
  },
  {
    domain: "Chemistry",
    tag: "Chemistry",
    headline: "Atoms Up Close.",
    description:
      "From combustion to electron orbitals, any reaction animated from a single description.",
    prompts: [
      "Show the Bohr model of carbon",
      "Animate combustion of methane",
      "Show electron orbitals of oxygen",
    ],
    videoSrc:
      "https://res.cloudinary.com/dloh4tkp5/video/upload/v1780398373/stitcher/final/6a1eb22933e26be4a040188c/x7kvskuyiv3xwizz142e.mp4",
    imageSrc: "/landing-assets/plugins/chemistry.png",
    accent: "#06B6D4",
  },
  {
    domain: "Astronomy",
    tag: "Astronomy",
    headline: "The Cosmos, Rendered.",
    description:
      "Orbital paths, star lifecycles, planetary rings. The solar system on command.",
    prompts: [
      "Show the inner solar system orbits",
      "Animate a gas giant with rings and moons",
      "Show a star's lifecycle",
    ],
    videoSrc:
      "https://res.cloudinary.com/dloh4tkp5/video/upload/v1780335694/stitcher/final/6a176455c847e74ccebd974b/mmmxnnhuyfyddl2vsgz0.mp4",
    imageSrc: "/landing-assets/plugins/astronomy.png",
    accent: "#6366F1",
  },
];

// Cycles through prompts with a fade+slide transition and a blinking cursor
function PromptCycler({
  prompts,
  accent,
}: {
  prompts: string[];
  accent: string;
}) {
  const [idx, setIdx] = useState(0);

  // Reset to 0 when domain changes (prompts array reference changes)
  useEffect(() => {
    setIdx(0);
  }, [prompts]);

  useEffect(() => {
    const t = setTimeout(
      () => setIdx((i) => (i + 1) % prompts.length),
      3200
    );
    return () => clearTimeout(t);
  }, [idx, prompts.length]);

  return (
    <div className="mt-8">
      <p
        className="text-[10px] uppercase tracking-[0.22em] mb-3 font-semibold"
        style={{ color: accent + "99" }}
      >
        Try it
      </p>

      {/* Single cycling prompt */}
      <div className="relative h-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${prompts[0]}-${idx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center gap-2"
          >
            <span
              className="font-mono text-[12px] shrink-0 select-none"
              style={{ color: accent }}
            >
              /
            </span>
            <span className="font-mono text-[13px] text-neutral-200 leading-none truncate">
              {prompts[idx]}
            </span>
            <span
              className="w-[2px] h-3.5 shrink-0 rounded-full"
              style={{
                background: accent + "cc",
                animation: "pulse 1.1s ease-in-out infinite",
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mini progress track */}
      <div className="flex gap-1.5 mt-3.5">
        {prompts.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-[3px] rounded-full transition-all duration-400",
              i === idx ? "w-5" : "w-[3px] bg-neutral-800"
            )}
            style={i === idx ? { background: accent } : {}}
          />
        ))}
      </div>
    </div>
  );
}

export default function PluginShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  // Mobile only: index of the single video that's playing with sound (-1 = all muted)
  const [mobileUnmutedIdx, setMobileUnmutedIdx] = useState(-1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Reliable scroll detection via capture-phase scroll listener
  useEffect(() => {
    let rafId: number;

    const findActive = () => {
      const mid = window.innerHeight / 2;
      let bestIdx = 0;
      let bestDist = Infinity;

      itemRefs.current.forEach((el, idx) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dist = Math.abs((r.top + r.bottom) / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });

      setActiveIdx(bestIdx);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(findActive);
    };

    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    findActive();

    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Play/pause + mute sync
  useEffect(() => {
    videoRefs.current.forEach((vid, idx) => {
      if (!vid) return;
      if (idx === activeIdx) {
        vid.muted = isMuted;
        vid.play().catch(() => {});
      } else {
        vid.muted = true;
        vid.pause();
      }
    });
  }, [activeIdx, isMuted]);

  const scrollToItem = (idx: number) => {
    itemRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const active = PLUGINS[activeIdx];

  return (
    <section className="relative bg-black text-white">
      {/* BgDarkGridGradient1 — subtle grid + soft radial glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]" />
        <div className="absolute left-1/2 top-[-10%] h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_400px_at_50%_300px,#fbfbfb10,#000)]" />
      </div>

      {/* Section header */}
      <div className="text-center pt-24 pb-20 px-4">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.05]">
          One tool.{" "}
          <span className="text-neutral-600">Every domain.</span>
        </h2>
      </div>

      {/* Mobile */}
      <div className="md:hidden px-5 pb-20 space-y-16">
        {PLUGINS.map((plugin, idx) => (
          <div key={plugin.domain} className="space-y-5">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-950 ring-1 ring-white/[0.07]">
              <MobilePluginVideo
                plugin={plugin}
                unmuted={mobileUnmutedIdx === idx}
                onUnmute={() => setMobileUnmutedIdx(mobileUnmutedIdx === idx ? -1 : idx)}
              />
            </div>
            <div className="pl-4 border-l-2" style={{ borderColor: plugin.accent }}>
              <p
                className="text-[10px] uppercase tracking-[0.2em] mb-2 font-semibold"
                style={{ color: plugin.accent }}
              >
                {plugin.tag}
              </p>
              <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                {plugin.headline}
              </h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                {plugin.description}
              </p>
              <PromptCycler prompts={plugin.prompts} accent={plugin.accent} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop sticky-scroll */}
      <div className="hidden md:flex items-start">

        {/* LEFT — scrollable text */}
        <div className="w-[38%] lg:w-[36%] shrink-0 pl-10 lg:pl-16 xl:pl-20">
          {PLUGINS.map((plugin, idx) => {
            const isActive = idx === activeIdx;
            return (
              <div
                key={plugin.domain}
                ref={(el) => (itemRefs.current[idx] = el)}
                className={cn(
                  "min-h-[85vh] flex items-center transition-opacity duration-500",
                  isActive ? "opacity-100" : "opacity-[0.18]"
                )}
              >
                <div
                  className={cn(
                    "pl-6 py-1 border-l-2 transition-colors duration-500",
                    isActive ? "" : "border-neutral-800"
                  )}
                  style={isActive ? { borderColor: plugin.accent } : {}}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.22em] mb-5 font-semibold"
                    style={{ color: plugin.accent }}
                  >
                    {plugin.tag}
                  </p>

                  <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-5 tracking-tight">
                    {plugin.headline}
                  </h3>

                  <p className="text-neutral-400 text-[15px] leading-[1.75] max-w-[340px]">
                    {plugin.description}
                  </p>

                  {/* Cycling prompt display */}
                  <PromptCycler prompts={plugin.prompts} accent={plugin.accent} />
                </div>
              </div>
            );
          })}
          <div className="h-[28vh]" />
        </div>

        {/* RIGHT — sticky */}
        <div className="flex-1 sticky top-0 h-screen flex flex-col justify-center gap-5 pr-10 lg:pr-16 xl:pr-20 pl-6 lg:pl-8">

          {/* Sound hint — above the player */}
          <button
            onClick={() => setIsMuted(false)}
            className="flex items-center justify-center group focus:outline-none"
          >
            <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 transition-all duration-300 group-hover:border-white/15 group-hover:bg-white/[0.07]">
              <Volume2 size={13} className="text-white/40 shrink-0" />
              <AnimatedShinyText
                shimmerWidth={160}
                className="text-[12px] font-medium text-neutral-500 max-w-none"
              >
                Turn on sound. Voiceover included in every video
              </AnimatedShinyText>
            </div>
          </button>

          {/* Video with accent glow */}
          <div className="relative">
            <motion.div
              className="absolute -inset-3 rounded-3xl blur-2xl opacity-25 pointer-events-none"
              animate={{ background: active.accent }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-950 ring-1 ring-white/[0.08] shadow-[0_32px_80px_rgba(0,0,0,0.85)]">
              {PLUGINS.map((plugin, idx) => (
                <div
                  key={plugin.domain}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-700",
                    idx === activeIdx ? "opacity-100 z-10" : "opacity-0 z-0"
                  )}
                >
                  {plugin.videoSrc ? (
                    <video
                      ref={(el) => (videoRefs.current[idx] = el)}
                      src={plugin.videoSrc}
                      loop
                      muted
                      playsInline
                      preload="none"
                      poster={plugin.imageSrc}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <img
                        src={plugin.imageSrc}
                        alt={plugin.domain}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        style={{ filter: "brightness(0.45) saturate(1.15)" }}
                      />
                      <div className="absolute inset-0 bg-black/25" />
                    </>
                  )}
                </div>
              ))}

              {active.videoSrc && (
                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-white/60 backdrop-blur-sm transition-all hover:bg-black/70 hover:text-white focus:outline-none"
                >
                  {isMuted ? <VolumeX size={12} strokeWidth={2} /> : <Volume2 size={12} strokeWidth={2} />}
                  <span className="text-[11px] font-medium">{isMuted ? "Unmute" : "Mute"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Numbered progress pills */}
          <div className="flex items-center justify-center gap-2">
            {PLUGINS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => scrollToItem(idx)}
                aria-label={`Go to ${PLUGINS[idx].domain}`}
                className={cn(
                  "rounded-full transition-all duration-300 focus:outline-none font-mono font-bold flex items-center justify-center text-[11px]",
                  idx === activeIdx
                    ? "w-7 h-7 text-black scale-110 shadow-lg"
                    : "w-6 h-6 bg-neutral-900 text-neutral-500 border border-neutral-700 hover:border-neutral-500 hover:text-neutral-300"
                )}
                style={
                  idx === activeIdx
                    ? { background: active.accent, boxShadow: `0 0 12px ${active.accent}66` }
                    : {}
                }
              >
                {idx + 1}
              </button>
            ))}
          </div>

        </div>
      </div>

    </section>
  );
}
