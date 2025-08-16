import { 
  Sparkles, 
  Video,
  Edit3,
  Wand2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Quick Prompts Component
const QuickPrompts = ({ mode, onPromptSelect }: {
  mode: 'generate' | 'edit',
  onPromptSelect: (prompt: string) => void
}) => {
  const generatePrompts = [
    { icon: Video, text: "Product demo", prompt: "Create a 30-second product demo video" },
    { icon: Sparkles, text: "Social media", prompt: "Generate an engaging social media video" },
    { icon: Wand2, text: "Tutorial intro", prompt: "Create a tutorial introduction video" }
  ];

  const editPrompts = [
    { icon: Edit3, text: "Add transitions", prompt: "Add smooth transitions between all clips" },
    { icon: Sparkles, text: "Apply effects", prompt: "Apply cinematic effects to the video" },
    { icon: Wand2, text: "Adjust timing", prompt: "Adjust the timing and pace of clips" }
  ];

  const prompts = mode === 'generate' ? generatePrompts : editPrompts;

  return (
    <div className="px-4 py-3 bg-neutral-950">
      <div className="grid gap-2">
        {prompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onPromptSelect(prompt.prompt)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all duration-200 text-left group",
              "bg-neutral-800/40 hover:bg-neutral-800/60",
              mode === 'generate' 
                ? "hover:border-emerald-500/20 hover:bg-emerald-500/5" 
                : "hover:border-blue-500/20 hover:bg-blue-500/5"
            )}
          >
            <prompt.icon className={cn(
              "w-3 h-3 transition-colors duration-200",
              mode === 'generate'
                ? "text-neutral-400 group-hover:text-emerald-400"
                : "text-neutral-400 group-hover:text-blue-400"
            )} />
            <span className="text-neutral-300 group-hover:text-neutral-200">{prompt.text}</span>
            <ChevronRight className="w-3 h-3 text-neutral-500 ml-auto group-hover:text-neutral-400" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickPrompts