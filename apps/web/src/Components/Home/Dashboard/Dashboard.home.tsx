import { useNavigate } from "react-router-dom";
import type { Project } from "@/State/Types";
import RecentProjects from "./RecentProjects.home";
import QuickActions from "./QuickActions.home";
import { ChevronDown } from "lucide-react";

interface Props {
  recentProjects: Project[];
  fecthRecentProjects: () => void;
  onNavigate: (itemKey: string) => void;
}

const TopDesign = () => {
  function capitalizeFirstLetter(username: string): string {
    if (!username) return "";
    return username.charAt(0).toUpperCase() + username.slice(1);
  }
  const user = JSON.parse(localStorage.getItem("user") || "");
  const username = capitalizeFirstLetter(user.username) || "Guest";
  
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 h-28 md:h-40">
       <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>
       <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

       <div className="relative z-10 p-4 md:p-8 flex items-center justify-between h-full">
         <div className="space-y-1 md:space-y-1.5 max-w-xl">
           <h1 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight">
             Welcome back, {username}
           </h1>
           <p className="text-zinc-400 text-xs md:text-sm font-light max-w-sm md:max-w-none">
             Ready to create your next masterpiece?
           </p>
         </div>

       </div>
    </div>
  );
};
const Dashboard = ({
  recentProjects,
  fecthRecentProjects,
  onNavigate,
}: Props) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <TopDesign />
        <QuickActions navigate={navigate} onNavigate={onNavigate} />
        
        <RecentProjects
          projectsToDisplay={recentProjects.slice(-2, recentProjects.length)}
          navigate={navigate}
          fecthRecentProjects={fecthRecentProjects}
        />

        {/* Mobile: All Projects Button */}
        <button
          onClick={() => onNavigate("projects")}
          className="flex items-center justify-center gap-2 w-full py-2 group md:hidden -mt-2 mb-2"
        >
            <div className="h-px bg-zinc-800 flex-1"></div>
            <span className="text-xs text-zinc-500 group-hover:text-white transition-colors whitespace-nowrap">View All Projects</span>
            <ChevronDown size={14} className="text-zinc-500 group-hover:text-white transition-colors group-hover:translate-y-0.5 transform" />
            <div className="h-px bg-zinc-800 flex-1"></div>
        </button>

        {/* Bottom Nav Spacer — handled by pb-24 on outer container */}
      </div>
    </div>
  );
};

export default Dashboard;
