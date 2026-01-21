import { 
  Activity,
  Flower,
  Circle,
  ArrowRight,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Quick Prompts Component
const QuickPrompts = ({ mode, onPromptSelect }: {
  mode: 'generate' | 'edit',
  onPromptSelect: (prompt: string) => void
}) => {
  if (mode !== 'generate') return null;

  const creativePrompts = [
    { 
      icon: Circle, 
      title: "Flower of Life", 
      description: "Geometric harmony",
      prompt: "Create a flower of life pattern by drawing overlapping circles that form the sacred geometry symbol",
      gradient: "from-rose-500/20 via-pink-500/20 to-orange-500/20",
      accent: "group-hover:text-rose-400",
      border: "group-hover:border-rose-500/50",
      iconBg: "bg-rose-500/10 text-rose-400"
    },
    { 
      icon: Activity, 
      title: "Lissajous Curve", 
      description: "Physics simulation",
      prompt: "Create a lissajous curve by plotting parametric equations with two different frequency sine waves",
      gradient: "from-cyan-500/20 via-blue-500/20 to-indigo-500/20",
      accent: "group-hover:text-cyan-400",
      border: "group-hover:border-cyan-500/50",
      iconBg: "bg-cyan-500/10 text-cyan-400"
    },
    { 
      icon: Flower, 
      title: "Golden Mandala", 
      description: "Mathematical beauty",
      prompt: "Create a mandala pattern that draws itself from center outward with symmetrical petals and geometric patterns in gold and purple",
      gradient: "from-amber-500/20 via-yellow-500/20 to-orange-500/20",
      accent: "group-hover:text-amber-400",
      border: "group-hover:border-amber-500/50",
      iconBg: "bg-amber-500/10 text-amber-400"
    }
  ];

  return (
    <div className="px-5 pb-6">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/20" />
        <span className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Quick Start</span>
      </div>
      
      <div className="space-y-3">
        {creativePrompts.map((item, index) => (
          <button
            key={index}
            onClick={() => onPromptSelect(item.prompt)}
            className="group relative w-full text-left"
          >
            {/* Gradient Glow Background */}
            <div className={cn(
              "absolute -inset-0.5 rounded-xl bg-gradient-to-r opacity-0 blur transition duration-500 group-hover:opacity-100",
              item.gradient
            )} />
            
            {/* Main Card Content */}
            <div className="relative flex items-center gap-4 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/50 hover:border-zinc-700/50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-zinc-900/50">
              {/* Icon Container with Glass Effect */}
              <div className={cn(
                "relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border border-white/5 shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                item.iconBg
              )}>
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
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

              {/* Arrow Interaction */}
              <div className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900/50 text-zinc-600 transition-all duration-300 group-hover:bg-zinc-800 group-hover:text-zinc-300",
                "group-hover:translate-x-0.5"
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