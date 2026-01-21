import {cn} from "@/lib/utils"
import { 
  Video,
  Edit3,
} from 'lucide-react';

// Empty State Component
const EmptyState = ({ mode, }: {
  mode: 'generate' | 'edit',
  onPromptSelect: (prompt: string) => void
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
    <div className={cn(
      "w-12 h-12 rounded-xl border flex items-center justify-center mb-4 transition-all duration-300",
      mode === 'generate'
        ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]"
        : "bg-blue-500/10 border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]"
    )}>
      {mode === 'generate' ? (
        <Video className="w-5 h-5 text-emerald-400" />
      ) : (
        <Edit3 className="w-5 h-5 text-blue-400" />
      )}
    </div>
    <h3 className="text-sm font-semibold text-white mb-2">
      {mode === 'generate' ? 'Generate Animations' : 'Edit Templates'}
    </h3>
    <p className="text-xs text-zinc-400 mb-6 max-w-[240px] leading-relaxed">
      {mode === 'generate' 
        ? 'Describe the math-based animation or pattern you want to create and I\'ll generate the code for you.'
        : 'You can edit templates by importing them to assets sidebar, then dragging and dropping them into the message box below.'
      }
    </p>
  </div>
);

export default EmptyState