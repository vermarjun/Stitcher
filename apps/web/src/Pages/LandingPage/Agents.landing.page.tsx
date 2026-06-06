import React from "react";
import { cn } from "@/lib/utils";

// efferd "Integrations" component (21st.dev) used verbatim — only the heading
// text, the paragraph, and the `tiles` logos are changed. The component's
// classes rely on shadcn dark-theme tokens (text-foreground, bg-card, …), so
// the section is wrapped in `dark` to make them resolve correctly on the
// black landing page (which itself isn't in a dark context).

type LogoType = {
  src: string;
  alt: string;
  isInvertable?: boolean;
};

type TileData = {
  row: number;
  col: number;
  logo?: LogoType;
  // Fallback for agents with no brand logo (OpenClaw, Hermes).
  Icon?: React.ComponentType<{ className?: string }>;
};

// `embedded` renders a transparent, compact variant meant to overlay the
// gradient banner at the bottom of the Features section (no bg, smaller type,
// glassy tiles). Default (false) keeps the original full-section look.
const Agents: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  return (
    <div
      className={cn(
        "dark w-full text-foreground",
        embedded ? "px-2 py-12 md:px-6 md:py-0" : "bg-black py-16 md:py-24",
      )}
    >
      <div
        className={cn(
          "mx-auto grid max-w-5xl grid-cols-1 p-4 md:grid-cols-2 md:items-center",
          embedded ? "gap-8 md:gap-10" : "gap-12",
        )}
      >
        {/* Left Content */}
        <div className="max-w-xl space-y-5">
          <h2
            className={cn(
              "font-medium text-foreground tracking-tight",
              embedded
                ? "text-2xl sm:text-3xl md:text-4xl"
                : "text-3xl sm:text-4xl md:text-5xl",
            )}
          >
            Give your agents the power to make videos
          </h2>
          <p
            className={cn(
              "text-muted-foreground",
              embedded ? "text-sm leading-7 md:text-base" : "text-lg leading-8",
            )}
          >
            Connect Stitcher once, and any agent can turn a prompt into a
            fully-furnished, narrated video — no rendering pipeline to build, no
            Manim to learn.
          </p>
        </div>

        {/* Right Content - Visual */}
        <div className="place-items-end">
          <div
            className={cn(
              "[mask-image:radial-gradient(ellipse_at_center,black,black,transparent)] relative",
              embedded ? "size-70" : "size-90",
            )}
          >
            {tiles.map((tile) => (
              <IntegrationCard
                key={`${tile.row}_${tile.col}`}
                {...tile}
                embedded={embedded}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function IntegrationCard({
  row,
  col,
  logo,
  Icon,
  embedded,
}: TileData & { embedded?: boolean }) {
  const cell = embedded ? 56 : 72; // px pitch between tiles
  // In the banner, the scattered empty placeholder squares flicker gently.
  const flicker = embedded && !logo && !Icon;
  return (
    <div
      className={cn(
        "absolute flex items-center justify-center rounded-md border",
        embedded ? "size-14" : "size-18",
        embedded
          ? logo || Icon
            ? "border-black/10 bg-white shadow-sm" // white chip so every logo shows in its true colours
            : "animate-flicker border-white/10 bg-white/5" // faint, flickering empty tiles
          : logo || Icon
            ? "bg-card shadow-xs dark:bg-card/60"
            : "bg-secondary/30 dark:bg-background", // Styling for empty tiles
      )}
      style={{
        left: col * cell,
        top: row * cell,
        ...(flicker
          ? {
              animationDelay: `${((row + col) % 5) * 0.5}s`,
              animationDuration: `${3 + ((row * 2 + col) % 4) * 0.6}s`,
            }
          : {}),
      }}
    >
      {logo && (
        <img
          alt={logo.alt}
          className={cn(
            "pointer-events-none select-none object-contain p-1",
            embedded ? "size-7" : "size-8",
          )}
          height={40}
          src={logo.src}
          width={40}
        />
      )}
      {!logo && Icon && (
        <Icon
          className={cn(
            "pointer-events-none select-none text-foreground",
            embedded ? "size-5" : "size-6",
          )}
        />
      )}
    </div>
  );
}

// Coordinate mapping follows efferd's "scattered" 5×5 pattern.
// Logos swapped for AI agents; colorful marks stay in color, monochrome marks
// invert to white in dark mode (isInvertable), exactly like efferd's originals.
const tiles: TileData[] = [
  // Row 0
  { row: 0, col: 1 },
  {
    row: 0,
    col: 3,
    logo: { src: "/agent-logos/claude.svg", alt: "Claude Code" },
  },

  // Row 1
  { row: 1, col: 0 }, // Empty
  {
    row: 1,
    col: 2,
    logo: { src: "/agent-logos/openai.svg", alt: "OpenAI Codex" },
  },
  {
    row: 1,
    col: 4,
    logo: { src: "/agent-logos/gemini.svg", alt: "Google Antigravity" },
  },

  // Row 2
  {
    row: 2,
    col: 1,
    logo: { src: "/agent-logos/opencode.svg", alt: "OpenCode" },
  },
  {
    row: 2,
    col: 3,
    logo: { src: "/agent-logos/openclaw.svg", alt: "OpenClaw" }, // colourful lobster mark
  },

  // Row 3
  { row: 3, col: 0 }, // Empty
  {
    row: 3,
    col: 2,
    logo: { src: "/agent-logos/cursor.svg", alt: "Cursor" },
  },
  {
    row: 3,
    col: 4,
    logo: { src: "/agent-logos/hermes.png", alt: "Hermes" },
  },

  // Row 4
  {
    row: 4,
    col: 1,
    logo: { src: "/agent-logos/copilot.svg", alt: "GitHub Copilot" },
  },
  {
    row: 4,
    col: 3,
    logo: { src: "/agent-logos/mcp.png", alt: "MCP" },
  },
];

// Just the scattered, masked tile cloud (embedded glassy styling + flickering
// empties) — the same visual the banner used, reusable inside the large left
// feature card. Sizing/scaling is controlled via className.
export const AgentCloud = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "[mask-image:radial-gradient(ellipse_at_center,black,black,transparent)] relative size-70",
      className,
    )}
  >
    {tiles.map((tile) => (
      <IntegrationCard key={`${tile.row}_${tile.col}`} {...tile} embedded />
    ))}
  </div>
);

export default Agents;
