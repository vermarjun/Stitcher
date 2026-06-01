import { Crown, Rocket, Zap } from "lucide-react";
import { Badge } from "@/Components/ui/badge";

interface PlanBadgeProps {
  plan?: string;
  className?: string;
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  const normalized = (plan ?? "").toLowerCase();

  if (normalized === "max") {
    return (
      <Badge
        variant="secondary"
        className={`bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-cyan-300 border-cyan-500/30 ${className ?? ""}`}
      >
        <Rocket className="w-3 h-3 mr-1 text-cyan-300" />
        Max Tier
      </Badge>
    );
  }

  if (normalized === "plus") {
    return (
      <Badge
        variant="secondary"
        className={`bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-purple-300 border-purple-500/30 ${className ?? ""}`}
      >
        <Crown className="w-3 h-3 mr-1 text-purple-300" />
        Plus Tier
      </Badge>
    );
  }

  if (normalized === "basic") {
    return (
      <Badge
        variant="secondary"
        className={`bg-gradient-to-r from-blue-500/20 to-sky-500/20 text-blue-300 border-blue-500/30 ${className ?? ""}`}
      >
        <Zap className="w-3 h-3 mr-1 text-blue-300" />
        Basic Tier
      </Badge>
    );
  }

  // free or unknown
  return (
    <Badge
      variant="outline"
      className={`bg-gradient-to-r from-zinc-700/30 to-zinc-800/20 text-zinc-300 border-zinc-600/40 ${className ?? ""}`}
    >
      <Crown className="w-3 h-3 mr-1 text-zinc-400" />
      Free Tier
    </Badge>
  );
}
