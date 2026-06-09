import { useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { X, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowCard } from "@/Components/ui/spotlight-card";

const VIDEO_URLS: Record<string, string> = {
  chess:     "https://res.cloudinary.com/dodlenepk/video/upload/v1780397868/stitcher/final/6a1eb22933e26be4a040188c/wwtb6fswizzwh5qvnzcl.mp4",
  physics:   "https://res.cloudinary.com/dodlenepk/video/upload/v1780398196/stitcher/final/6a1eb22933e26be4a040188c/didvwytsit18ida38emi.mp4",
  chemistry: "https://res.cloudinary.com/dodlenepk/video/upload/v1780398373/stitcher/final/6a1eb22933e26be4a040188c/x7kvskuyiv3xwizz142e.mp4",
  ml:        "https://res.cloudinary.com/dodlenepk/video/upload/v1780398116/stitcher/final/6a1eb22933e26be4a040188c/drsklmi5kwcoersxazcd.mp4",
  dsa:       "https://res.cloudinary.com/dodlenepk/video/upload/v1780398059/stitcher/final/6a1eb22933e26be4a040188c/kqonslglgwrf66rlfich.mp4",
  astronomy: "https://res.cloudinary.com/dodlenepk/video/upload/v1780335694/stitcher/final/6a176455c847e74ccebd974b/mmmxnnhuyfyddl2vsgz0.mp4",
};

// Icons sourced from Tabler Icons (tabler.io/icons, MIT license)
const IconChessKnight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M8 16l-1.447 .724a1 1 0 0 0 -.553 .894v2.382h12v-2.382a1 1 0 0 0 -.553 -.894l-1.447 -.724h-8" />
    <path d="M9 3l1 3l-3.491 2.148a1 1 0 0 0 .524 1.852h2.967l-2.073 6h7.961l.112 -5c0 -3 -1.09 -5.983 -4 -7c-1.94 -.678 -2.94 -1.011 -3 -1" />
  </svg>
);

const IconWaveSine = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M21 12h-2c-.894 0 -1.662 -.857 -1.761 -2c-.296 -3.45 -.749 -6 -2.749 -6s-2.5 3.582 -2.5 8s-.5 8 -2.5 8s-2.452 -2.547 -2.749 -6c-.1 -1.147 -.867 -2 -1.763 -2h-2" />
  </svg>
);

const IconAtom = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M12 21l0 .01" />
    <path d="M3 9l0 .01" />
    <path d="M21 9l0 .01" />
    <path d="M8 20.1a9 9 0 0 1 -5 -7.1" />
    <path d="M16 20.1a9 9 0 0 0 5 -7.1" />
    <path d="M6.2 5a9 9 0 0 1 11.4 0" />
  </svg>
);

const IconChartDots = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M3 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M14 15a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
    <path d="M15 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M3 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    <path d="M9 17l5 -1.5" />
    <path d="M6.5 8.5l7.81 5.37" />
    <path d="M7 7l8 -1" />
  </svg>
);

const IconBinaryTree = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M6 20a2 2 0 1 0 -4 0a2 2 0 0 0 4 0" />
    <path d="M16 4a2 2 0 1 0 -4 0a2 2 0 0 0 4 0" />
    <path d="M16 20a2 2 0 1 0 -4 0a2 2 0 0 0 4 0" />
    <path d="M11 12a2 2 0 1 0 -4 0a2 2 0 0 0 4 0" />
    <path d="M21 12a2 2 0 1 0 -4 0a2 2 0 0 0 4 0" />
    <path d="M5.058 18.306l2.88 -4.606" />
    <path d="M10.061 10.303l2.877 -4.604" />
    <path d="M10.065 13.705l2.876 4.6" />
    <path d="M15.063 5.7l2.881 4.61" />
  </svg>
);

const IconPlanet = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M18.816 13.58c2.292 2.138 3.546 4 3.092 4.9c-.745 1.46 -5.783 -.259 -11.255 -3.838c-5.47 -3.579 -9.304 -7.664 -8.56 -9.123c.464 -.91 2.926 -.444 5.803 .805" />
    <path d="M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
  </svg>
);

interface CardData {
  key: string;
  icon: ReactNode;
  heading: string;
  desc: string;
}

const CARDS: CardData[] = [
  {
    key: "chess",
    icon: <IconChessKnight />,
    heading: "Chess",
    desc: "Explain openings, tactics, or full games. The pieces actually move on the board.",
  },
  {
    key: "physics",
    icon: <IconWaveSine />,
    heading: "Physics",
    desc: "Pendulums, fields, waves. Describe a concept and watch it play out.",
  },
  {
    key: "chemistry",
    icon: <IconAtom />,
    heading: "Chemistry",
    desc: "Molecules, Bohr models, orbital diagrams. Drawn from scratch in 2D and 3D.",
  },
  {
    key: "ml",
    icon: <IconChartDots />,
    heading: "Machine Learning",
    desc: "Data flowing through layers, pooling, and embeddings. One step at a time.",
  },
  {
    key: "dsa",
    icon: <IconBinaryTree />,
    heading: "Data Structures & Algorithms",
    desc: "DFS, Dijkstra, sorting. Watch each step move through the structure.",
  },
  {
    key: "astronomy",
    icon: <IconPlanet />,
    heading: "Astronomy",
    desc: "Orbits, scale, spacetime. The kind of thing that's hard to explain without motion.",
  },
];

function PluginVideo({ pluginKey, icon }: { pluginKey: string; icon: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = VIDEO_URLS[pluginKey];

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-inset ring-zinc-800">
      {src && !failed ? (
        <>
          <video
            ref={videoRef}
            src={src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
          <button
            onClick={toggleMute}
            className="absolute inset-0 flex items-center justify-center group focus:outline-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all duration-200 group-hover:bg-black/70 group-hover:scale-110">
              {muted ? <VolumeX size={18} strokeWidth={1.8} /> : <Volume2 size={18} strokeWidth={1.8} />}
            </div>
          </button>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800/80 via-zinc-900 to-zinc-950">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/70 text-zinc-500 ring-1 ring-zinc-700/60 [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </span>
          <span className="text-[11px] font-medium text-zinc-600">Preview coming soon</span>
        </div>
      )}
    </div>
  );
}

interface PossibilitiesDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function PossibilitiesDialog({ open, onClose }: PossibilitiesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        overlayClassName="z-[100]"
        showCloseButton={false}
        style={{ width: "85vw", maxWidth: "none" }}
        className={cn(
          "z-[100] max-h-[90vh] overflow-y-auto",
          "bg-zinc-950 border border-zinc-800 p-0"
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600 focus:outline-none"
        >
          <X size={14} strokeWidth={2.5} />
        </button>

        <div className="px-6 sm:px-8 pt-7 pb-4">
          <DialogHeader className="gap-0 text-left space-y-0">
            <DialogTitle className="text-2xl sm:text-[26px] font-bold tracking-tight text-white leading-tight">
              What you can make
            </DialogTitle>
            <DialogDescription asChild>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-xl">
                Type a prompt. Stitcher turns it into a precise animated explainer. Clean mathematical motion, in the spirit of 3Blue1Brown.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5">
            <p className="text-xs text-zinc-400">
              <strong className="text-zinc-200 font-medium">Free tier:</strong> 30-second videos, open-source models.{" "}
              <span className="text-zinc-600">Upgrade for longer videos, voiceover, and frontier models.</span>
            </p>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {CARDS.map((card) => (
              <GlowCard
                key={card.key}
                customSize
                glowColor="blue"
                className="w-full rounded-2xl"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700">
                      {card.icon}
                    </span>
                    <h3 className="text-[14px] font-semibold text-white leading-snug">
                      {card.heading}
                    </h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-zinc-400">
                    {card.desc}
                  </p>
                  <PluginVideo pluginKey={card.key} icon={card.icon} />
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
