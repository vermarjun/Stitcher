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
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <div className={cn(
      "w-12 h-12 rounded-xl border flex items-center justify-center mb-4",
      mode === 'generate'
        ? "bg-purple-500/10 border-purple-500/20"
        : "bg-blue-500/10 border-blue-500/20"
    )}>
      {mode === 'generate' ? (
        <Video className="w-6 h-6 text-purple-400" />
      ) : (
        <Edit3 className="w-6 h-6 text-blue-400" />
      )}
    </div>
    <h3 className="text-sm font-medium text-neutral-200 mb-2">
      {mode === 'generate' ? 'Generate Videos with AI' : 'Edit Videos with AI'}
    </h3>
    <p className="text-xs text-neutral-500 mb-6 max-w-48 leading-relaxed">
      {mode === 'generate' 
        ? 'Describe the video you want to create and I\'ll generate it for you'
        : 'Tell me how you want to modify your timeline and I\'ll make the changes'
      }
    </p>
    <div className="flex flex-wrap gap-2 justify-center">
      {mode === 'generate' ? (
        <>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-neutral-800/50 hover:bg-neutral-800/70 text-neutral-300"
            onClick={() => onPromptSelect("Create a 30-second product showcase video")}
          >
            Product demo
          </Badge>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-neutral-800/50 hover:bg-neutral-800/70 text-neutral-300"
            onClick={() => onPromptSelect("Generate an engaging social media video")}
          >
            Social media
          </Badge>
        </>
      ) : (
        <>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-neutral-800/50 hover:bg-neutral-800/70 text-neutral-300"
            onClick={() => onPromptSelect("Add smooth transitions between all clips")}
          >
            Add transitions
          </Badge>
          <Badge 
            variant="secondary" 
            className="cursor-pointer bg-neutral-800/50 hover:bg-neutral-800/70 text-neutral-300"
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