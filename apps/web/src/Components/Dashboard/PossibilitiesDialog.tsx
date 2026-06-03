import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import {
  Crown,
  Atom,
  FlaskConical,
  Brain,
  GitBranch,
  Telescope,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CardData {
  key: string;
  icon: ReactNode;
  heading: string;
  desc: string;
}

const CARDS: CardData[] = [
  {
    key: "chess",
    icon: <Crown className="w-4 h-4" />,
    heading: "Create chess videos",
    desc: 'Teach openings, tactics, or whole games — say "explain the London System" and watch the pieces actually move on the board.',
  },
  {
    key: "physics",
    icon: <Atom className="w-4 h-4" />,
    heading: "Visualize physics",
    desc: "Pendulums, electric & magnetic fields, waves, and optics — describe a concept and watch the simulation play out.",
  },
  {
    key: "chemistry",
    icon: <FlaskConical className="w-4 h-4" />,
    heading: "Explain chemistry",
    desc: "2D & 3D molecules, the periodic table, Bohr models, and electron orbitals — clear structure and reaction explainers.",
  },
  {
    key: "ml",
    icon: <Brain className="w-4 h-4" />,
    heading: "Animate neural networks",
    desc: "Feed-forward nets, CNNs, pooling, and embeddings — show data flowing layer by layer through a model.",
  },
  {
    key: "dsa",
    icon: <GitBranch className="w-4 h-4" />,
    heading: "Teach data structures & algorithms",
    desc: "Arrays, stacks, trees (DFS/BFS) and graphs (Dijkstra, Prim) — animate each step an algorithm takes.",
  },
  {
    key: "astronomy",
    icon: <Telescope className="w-4 h-4" />,
    heading: "Explore astronomy",
    desc: "Stars, planets, telescopes, and spacetime curvature — bring scale and orbital motion to life.",
  },
];

function PluginVideo({
  pluginKey,
  icon,
}: {
  pluginKey: string;
  icon: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-inset ring-zinc-800">
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800/80 via-zinc-900 to-zinc-950">
          <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_40%,white,transparent_60%)]" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/70 text-zinc-500 ring-1 ring-zinc-700/60 [&_svg]:h-6 [&_svg]:w-6">
            {icon}
          </span>
          <span className="relative text-[11px] font-medium tracking-wide text-zinc-500">
            Preview coming soon
          </span>
        </div>
      ) : (
        <video
          src={`/plugin-demos/${pluginKey}.mp4`}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

interface PossibilitiesDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function PossibilitiesDialog({
  open,
  onClose,
}: PossibilitiesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        // z-[100] lifts the modal above the app chrome (navbar z-70, right sidebar
        // z-60) so it covers the COMPLETE screen; overlayClassName lifts the dimmed
        // backdrop with it so the whole screen darkens behind the dialog.
        overlayClassName="z-[100]"
        // Width via inline style so it can't be clamped by the shadcn default
        // `sm:max-w-lg` class (tailwind-merge keeps responsive variants, so a
        // class-based max-w override wouldn't win). 95vw = full screen width with
        // small margins; maxWidth:none removes the cap.
        style={{ width: "85vw", maxWidth: "none" }}
        className={cn(
          "z-[100] max-h-[90vh] overflow-y-auto",
          "bg-zinc-950 border border-zinc-800 p-0"
        )}
      >
        {/* Header section */}
        <div className="px-6 sm:px-8 pt-7 pb-5">
          <DialogHeader className="gap-0 text-left space-y-0">
            <DialogTitle className="text-2xl sm:text-[28px] font-bold tracking-tight text-white leading-tight">
              Here's what you can create with Stitcher
            </DialogTitle>
            <DialogDescription asChild>
              <p className="mt-2 text-sm sm:text-[15px] text-zinc-400 leading-relaxed max-w-2xl">
                Stitcher turns your prompt into a precise, animated explainer with Manim —
                clean, mathematical motion graphics in the spirit of 3Blue1Brown. Think
                diagrams that move, not cartoon characters.
              </p>
            </DialogDescription>
          </DialogHeader>

          {/* Free-tier callout */}
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-3.5 py-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs sm:text-[13px] text-zinc-300 leading-relaxed">
              You're on the{" "}
              <strong className="text-white font-semibold">Free</strong> tier —
              videos are capped at{" "}
              <strong className="text-white font-semibold">30 seconds</strong>,
              minimal effort,{" "}
              <strong className="text-white font-semibold">open-source models only</strong>.
              Upgrade for longer videos, natural voiceover, and frontier thinking models.
            </p>
          </div>
        </div>

        {/* Cards section */}
        <div className="px-6 sm:px-8 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {CARDS.map((card) => (
              <div
                key={card.key}
                className="group flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all duration-200 hover:border-emerald-500/30 hover:bg-zinc-900/70"
              >
                {/* Icon + heading row */}
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                    {card.icon}
                  </span>
                  <h3 className="text-[15px] font-semibold text-white leading-snug">
                    {card.heading}
                  </h3>
                </div>

                {/* Description */}
                <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">
                  {card.desc}
                </p>

                {/* Looping video (or placeholder) */}
                <div className="mt-4">
                  <PluginVideo pluginKey={card.key} icon={card.icon} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
