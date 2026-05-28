import { useNavigate } from "react-router-dom";
import type { Project } from "@/State/Types";
import RecentProjects from "./RecentProjects.home";
import GettingStarted from "./GettingStarted.home";
import QuickActions from "./QuickActions.home";
import RecentNotifications from "./RecentNotifications.home";
import CollabSections from "./CollabSections.home";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { FEATURES } from "@/config/features";
// import ProfileProgress from "./ProfileCompleteProgressbar.home";

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
    <div className="relative w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 h-32 md:h-40">
       <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>
       <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
       
       <div className="relative z-10 p-6 md:p-8 flex items-center justify-between h-full">
         <div className="space-y-1.5 max-w-xl">
           <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 tracking-tight">
             Welcome back, {username}
           </h1>
           <p className="text-zinc-400 text-xs md:text-sm font-light max-w-sm md:max-w-none">
             Ready to create your next masterpiece?
           </p>
         </div>

         {/* Images added back as requested, positioned for theme */}
         <div className="hidden md:flex items-center space-x-4 absolute right-0 top-0 h-full opacity-40 pointer-events-none fade-in mask-image-gradient">
            <img
              className="h-full object-cover mix-blend-screen"
              src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760094972/image-removebg-preview_fshtui.png"
              alt="math-theme-1"
            />
            <div className="h-full w-px bg-gradient-to-b from-transparent via-zinc-700 to-transparent"></div>
            <img
              className="h-full object-cover mix-blend-screen pr-4"
              src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760094545/LqaDfYdr-removebg-preview_fvjrsm.png"
              alt="math-theme-2"
            />
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
    <div className="min-h-screen bg-black p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <TopDesign />
        <QuickActions navigate={navigate} onNavigate={onNavigate} />
        
        {/* Mobile: Upgrade Banner */}
        <button 
          onClick={() => onNavigate("pricing")}
          className="w-full bg-emerald-900/10 border border-emerald-500/20 p-2.5 rounded-lg flex items-center justify-between group md:hidden active:scale-[0.98] transition-all"
        >
          <span className="text-xs font-medium text-emerald-400">Upgrade to premium and create unrestricted</span>
          <ArrowUpRight size={14} className="text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>

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

        {FEATURES.community && <RecentNotifications onNavigate={onNavigate} />}

        {/* Collaboration: invitations + shared-with-me (not gated by FEATURES.community) */}
        <CollabSections />

        {/* <ProfileProgress
          progress={60}
          missingFields={["Add a profile photo", "Verify your email"]}
          onContinue={() => navigate("/settings")}
        /> */}
        <GettingStarted onNavigate={onNavigate} />
        
        {/* Bottom Nav Spacer */}
        <div className="h-20 md:hidden"></div>
      </div>
    </div>
  );
};

export default Dashboard;
