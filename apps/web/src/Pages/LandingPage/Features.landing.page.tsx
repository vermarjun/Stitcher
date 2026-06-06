import { motion } from "framer-motion";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AgentCloud } from "./Agents.landing.page";

// Same gradient assets ("shaders") used by the ruixen.ui/about-page component.
const R2 = "https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev";

// Hide an <img> if its source is missing, so a card degrades to its background
// instead of showing a broken icon.
const hideOnError = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = "none";
};

// Lightweight, minimal-glow spotlight card (inspired by easemize/spotlight-card,
// toned right down): a subtle border, the shared hover-scale, and a faint white
// radial that follows the cursor and fades in only on hover.
const SpotlightCard = ({
  className,
  children,
  scale = 1.03,
  spotlightSize = 240,
}: {
  className?: string;
  children: ReactNode;
  scale?: number;
  spotlightSize?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      whileHover={{ scale }}
      transition={{ type: "spring", stiffness: 250, damping: 20 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/10 shadow-lg",
        className,
      )}
    >
      {children}
      {/* minimal hover spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${spotlightSize}px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.08), transparent 70%)`,
        }}
      />
    </motion.div>
  );
};

const Features = () => {
  return (
    <section className="relative overflow-hidden py-20 md:py-28 bg-black text-white">
      {/* Section background gradient + dark scrim for text/card readability. */}
      <img
        src="/hue-flow-01.png"
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-16 px-4 md:px-6">

        {/* ---------------- HEADER (about-page two-column style) ---------------- */}
        <div className="grid gap-6 text-center md:grid-cols-2 md:gap-12 md:text-left">
          <h1 className="text-3xl md:text-5xl font-semibold text-white">
            Everything you need to{" "}
            <span className="text-neutral-400">Stitch-it!</span>
          </h1>
          <p className="text-neutral-400">
            Stitcher turns a single prompt into a finished, narrated math
            animation — generate it, refine it in natural language, and export
            1080p video straight from your browser.
          </p>
        </div>

        {/* Cluster of 3 + the wide banner kept at gap-6 so the banner reads as
            part of the same group (not a detached section). */}
        <div className="flex flex-col gap-6">

          {/* ---------------- CARD GRID (exact about-page layout) ---------------- */}
          <div className="flex flex-col md:flex-row gap-6">

            {/* LEFT BIG CARD — Give your agents the power to make videos */}
            <SpotlightCard className="md:flex-1">
              <img
                src="/shade-shifters-11.png"
                alt=""
                loading="lazy"
                onError={hideOnError}
                className="rounded-xl object-cover w-full h-[300px] sm:h-[360px] md:h-full"
              />
              {/* the scattered agent logo cloud, over the same background */}
              <div className="absolute inset-0 flex items-center justify-center pb-28">
                <AgentCloud className="scale-110 sm:scale-125" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                <h3 className="text-2xl font-bold">
                  Give your agents the power to make videos
                </h3>
                <p className="mt-2 text-sm text-gray-200 max-w-md">
                  Connect Stitcher once, and any agent can turn a prompt into a
                  fully-furnished, narrated video — no rendering pipeline to
                  build, no Manim to learn.
                </p>
              </div>
            </SpotlightCard>

            {/* RIGHT TWO CARDS */}
            <div className="flex flex-col gap-6 md:flex-1">

              {/* FIRST CARD — Collaborators */}
              <SpotlightCard className="bg-black text-white">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.4 }}
                  className="relative h-60 sm:h-64 md:h-48 w-full overflow-hidden"
                >
                  <img
                    src={`${R2}/ruixen_moon.png`}
                    alt=""
                    loading="lazy"
                    onError={hideOnError}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-0 h-32 w-full bg-gradient-to-t from-black via-black/70 to-transparent" />
                </motion.div>
                <div className="p-6">
                  <h3 className="text-xl font-bold">Collaborators</h3>
                  <p className="mt-2 text-sm text-gray-300">
                    Invite your team and build together — many people can work on
                    the same project at once.
                  </p>
                  <img
                    src="/collaborators.png"
                    alt="Project collaborators"
                    onError={hideOnError}
                    className="mt-4 w-full max-w-xs rounded-lg border border-white/10 shadow-lg shadow-black/40 transition-transform duration-300 group-hover:-translate-y-1"
                  />
                </div>
              </SpotlightCard>

              {/* SECOND CARD — Animation Generation */}
              <SpotlightCard className="bg-neutral-900">
                <img
                  src={`${R2}/ruixen_hero_gradient.jpg`}
                  alt=""
                  loading="lazy"
                  onError={hideOnError}
                  className="h-full w-full object-cover min-h-[220px] sm:min-h-[240px] md:min-h-[220px]"
                />
                {/* generation flow screenshot, floating in the upper area away
                    from the heading at the bottom */}
                <div className="absolute inset-x-0 top-0 flex justify-center p-4">
                  <img
                    src="/animation-generation.png"
                    alt="Generating an animation in Stitcher"
                    onError={hideOnError}
                    className="w-[44%] max-w-[170px] rounded-lg border border-white/10 shadow-2xl shadow-black/50 transition-transform duration-300 group-hover:-translate-y-1"
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/60 to-transparent text-white">
                  <h3 className="text-xl font-bold">Animation Generation</h3>
                  <p className="mt-2 text-sm text-gray-200">
                    Turn prompts like "explain binary search" or "plot India's
                    GDP" into multi-scene animations, then refine with natural
                    language.
                  </p>
                </div>
              </SpotlightCard>
            </div>
          </div>

          {/* ---------------- BOTTOM BANNER — AI Animation Editing ---------------- */}
          {/* Same banner shell + background; the agent cloud is gone and the wide
              timeline screenshot peeks up from the bottom, away from the copy. */}
          <SpotlightCard
            scale={1.01}
            spotlightSize={460}
            className="w-full border-white/15 min-h-[260px] md:h-[340px]"
          >
            <img
              src="/homepage.png"
              alt=""
              loading="lazy"
              onError={hideOnError}
              className="absolute inset-0 h-full w-full object-cover object-bottom"
            />
            {/* Top-down scrim: darkens the top (keeping the heading readable) while
                leaving the bright glow at the bottom of the image visible. */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="p-4 md:p-8">
                <h3 className="text-xl font-bold text-white md:text-3xl">
                  AI Animation Editing
                </h3>
                <p className="mt-2 max-w-xl text-sm text-gray-200">
                  A full timeline-based editor. Stitch clips, trim scenes, add
                  text and audio, and fine-tune every frame — then export 1080p
                  video, all in the browser.
                </p>
              </div>
              <div className="mt-4 md:mt-auto px-4 md:px-10">
                <img
                  src="/timeline.png"
                  alt="Stitcher timeline editor"
                  loading="lazy"
                  onError={hideOnError}
                  className="w-full translate-y-3 rounded-t-xl border border-white/10 shadow-2xl shadow-black/60 transition-transform duration-300 group-hover:translate-y-0"
                />
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
};

export default Features;
