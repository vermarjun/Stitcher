// src/components/dashboard/footer.dashboard.tsx
import { cn } from "@/lib/utils"
import { GitBranch, CircleDot, MessageCircleWarning, FolderSyncIcon, Bell } from "lucide-react"
import { Button } from "../ui/button"

function Footer() {
  return (
    <footer className={cn(
      "h-6 flex items-center justify-between px-3 text-xs",
      "bg-zinc-950/80 border-t border-zinc-800/50",
      "text-zinc-400 font-medium"
    )}>
      {/* Left side - Status indicators */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 px-2 gap-1 hover:bg-zinc-800/50 hover:text-zinc-200"
        >
          <GitBranch className="h-3 w-3" />
          <span>main</span>
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 px-2 gap-1 hover:bg-zinc-800/50 hover:text-zinc-200"
        >
          <CircleDot className="h-3 w-3 text-green-500" />
          <span>Production</span>
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 px-2 gap-1 hover:bg-zinc-800/50 hover:text-zinc-200"
        >
          <MessageCircleWarning className="h-3 w-3 text-yellow-500" />
          <span>0</span>
        </Button>
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 w-5 p-0 hover:bg-zinc-800/50 hover:text-zinc-200"
          title="Sync"
        >
          <FolderSyncIcon className="h-3 w-3" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-5 w-5 p-0 hover:bg-zinc-800/50 hover:text-zinc-200"
          title="Notifications"
        >
          <Bell className="h-3 w-3" />
        </Button>

        <div className="text-xs px-2">
          UTF-8
        </div>

        <div className="text-xs px-2">
          TypeScript
        </div>

        <div className="text-xs px-2">
          Spaces: 2
        </div>
      </div>
    </footer>
  )
}

export default Footer