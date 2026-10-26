import { cn } from "@/lib/utils";
import { Edit3 } from 'lucide-react';

// Clapperboard icon from Tabler Icons (tabler.io/icons, MIT)
const IconClapperboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M4 4a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-16z" />
    <path d="M4 8h16" />
    <path d="M8 4l4 4" />
    <path d="M14 4l4 4" />
    <path d="M2 4l2 0" />
  </svg>
);

const EmptyState = ({ mode }: {
  mode: 'generate' | 'edit',
  onPromptSelect: (prompt: string) => void
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
    <div className={cn(
      "w-12 h-12 rounded-xl border flex items-center justify-center mb-4",
      mode === 'generate'
        ? "bg-zinc-800/60 border-zinc-700/50 text-zinc-300"
        : "bg-zinc-800/60 border-zinc-700/50 text-zinc-300"
    )}>
      {mode === 'generate' ? <IconClapperboard /> : <Edit3 className="w-5 h-5" />}
    </div>
    <h3 className="text-sm font-semibold text-white mb-2">
      {mode === 'generate' ? 'Generate a video' : 'Edit a video'}
    </h3>
    <p className="text-xs text-zinc-400 mb-6 max-w-[240px] leading-relaxed">
      {mode === 'generate'
        ? 'Describe what you want to explain. Chess games, physics simulations, algorithms, molecules — type it in plain language.'
        : 'Drag a generated video from the Asset Stash into the box below, then describe the change you want.'
      }
    </p>
  </div>
);

export default EmptyState;
