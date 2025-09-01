import {cn} from "@/lib/utils"
import { 
  Video,
  Edit3,
} from 'lucide-react';
import { Badge } from "@/Components/ui/badge";

// Empty State Component
const EmptyState = ({ mode, onPromptSelect }: {
  mode: 'generate' | 'edit',
  onPromptSelect: (prompt: string) => void
}) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
    <div className={cn(
      "w-10 h-10 rounded-lg border flex items-center justify-center mb-3",
      mode === 'generate'
        ? "bg-green-500/10 border-green-500/20"
        : "bg-blue-500/10 border-blue-500/20"
    )}>
      {mode === 'generate' ? (
        <Video className="w-4 h-4 text-green-400" />
      ) : (
        <Edit3 className="w-4 h-4 text-blue-400" />
      )}
    </div>
    <h3 className="text-xs font-semibold text-white mb-1.5">
      {mode === 'generate' ? 'Generate Videos with AI' : 'Edit Videos with AI'}
    </h3>
    <p className="text-[10px] text-zinc-500 mb-4 max-w-44 leading-relaxed">
      {mode === 'generate' 
        ? 'Describe the video you want to create and I\'ll generate it for you'
        : 'Tell me how you want to modify your timeline and I\'ll make the changes'
      }
    </p>
    <div className="flex flex-wrap gap-1.5 justify-center">
      {mode === 'generate' ? (
        <>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 h-auto font-normal"
            onClick={() => onPromptSelect("Create a 30-second product showcase video")}
          >
            Product demo
          </Badge>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 h-auto font-normal"
            onClick={() => onPromptSelect("Generate an engaging social media video")}
          >
            Social media
          </Badge>
        </>
      ) : (
        <>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 h-auto font-normal"
            onClick={() => onPromptSelect("Add smooth transitions between all clips")}
          >
            Add transitions
          </Badge>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 h-auto font-normal"
            onClick={() => onPromptSelect("Apply color grading for cinematic look")}
          >
            Color grade
          </Badge>
        </>
      )}
    </div>
  </div>
);

export default EmptyState