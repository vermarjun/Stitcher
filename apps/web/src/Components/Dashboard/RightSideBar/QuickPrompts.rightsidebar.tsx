import { ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// Icons from Tabler Icons (tabler.io/icons, MIT)
const IconChessKnight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M8 16l-1.447 .724a1 1 0 0 0 -.553 .894v2.382h12v-2.382a1 1 0 0 0 -.553 -.894l-1.447 -.724h-8" />
    <path d="M9 3l1 3l-3.491 2.148a1 1 0 0 0 .524 1.852h2.967l-2.073 6h7.961l.112 -5c0 -3 -1.09 -5.983 -4 -7c-1.94 -.678 -2.94 -1.011 -3 -1" />
  </svg>
);

const IconWaveSine = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M21 12h-2c-.894 0 -1.662 -.857 -1.761 -2c-.296 -3.45 -.749 -6 -2.749 -6s-2.5 3.582 -2.5 8s-.5 8 -2.5 8s-2.452 -2.547 -2.749 -6c-.1 -1.147 -.867 -2 -1.763 -2h-2" />
  </svg>
);

const IconBinaryTree = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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

interface PromptItem {
  icon: ReactNode;
  title: string;
  description: string;
  prompt: string;
  gradient: string;
  accent: string;
  iconBg: string;
}

const PROMPTS: PromptItem[] = [
  {
    icon: <IconChessKnight />,
    title: "Scholar's Mate",
    description: "Chess opening trap",
    prompt: "Show Scholar's Mate: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7# with each piece moving on a chess board",
    gradient: "from-amber-500/20 via-yellow-500/20 to-orange-500/20",
    accent: "group-hover:text-amber-400",
    iconBg: "bg-amber-500/10 text-amber-400",
  },
  {
    icon: <IconWaveSine />,
    title: "Pendulum Wave",
    description: "Physics in sync",
    prompt: "Create a pendulum wave with 12 pendulums of slightly different lengths swinging together and slowly drifting out of phase",
    gradient: "from-blue-500/20 via-cyan-500/20 to-sky-500/20",
    accent: "group-hover:text-blue-400",
    iconBg: "bg-blue-500/10 text-blue-400",
  },
  {
    icon: <IconBinaryTree />,
    title: "Dijkstra's Algorithm",
    description: "Shortest path",
    prompt: "Animate Dijkstra's shortest path algorithm on a weighted graph with 8 nodes, highlighting the current frontier and updating distances at each step",
    gradient: "from-violet-500/20 via-purple-500/20 to-indigo-500/20",
    accent: "group-hover:text-violet-400",
    iconBg: "bg-violet-500/10 text-violet-400",
  },
];

const QuickPrompts = ({ mode, onPromptSelect }: {
  mode: 'generate' | 'edit',
  onPromptSelect: (prompt: string) => void
}) => {
  if (mode !== 'generate') return null;

  return (
    <div className="px-5 pb-6">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/20" />
        <span className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Quick Start</span>
      </div>

      <div className="space-y-3">
        {PROMPTS.map((item, index) => (
          <button
            key={index}
            onClick={() => onPromptSelect(item.prompt)}
            className="group relative w-full text-left"
          >
            <div className={cn(
              "absolute -inset-0.5 rounded-xl bg-gradient-to-r opacity-0 blur transition duration-500 group-hover:opacity-100",
              item.gradient
            )} />

            <div className="relative flex items-center gap-4 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-zinc-900/50">
              <div className={cn(
                "relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border border-white/5 shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                item.iconBg
              )}>
                {item.icon}
              </div>

              <div className="flex-1 min-w-0 py-0.5">
                <h4 className={cn(
                  "text-sm font-medium text-zinc-200 transition-colors duration-300",
                  item.accent
                )}>
                  {item.title}
                </h4>
                <p className="text-[11px] text-zinc-500 font-medium tracking-wide">
                  {item.description}
                </p>
              </div>

              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900/50 text-zinc-600 transition-all duration-300 group-hover:bg-zinc-800 group-hover:text-zinc-300 group-hover:translate-x-0.5"
              )}>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickPrompts;
