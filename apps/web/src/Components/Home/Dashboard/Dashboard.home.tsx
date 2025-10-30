import { useNavigate } from "react-router-dom";
import type { Project } from "@/State/Types";
import RecentProjects from "./RecentProjects.home";
import GettingStarted from "./GettingStarted.home";
import QuickActions from "./QuickActions.home";

interface Props {
  recentProjects: Project[];
  fecthRecentProjects: () => void;
  onNavigate: (itemKey:string)=>void,
}

const TopDesign = () => {
  function capitalizeFirstLetter(username: string): string {
    if (!username) return "";
    return username.charAt(0).toUpperCase() + username.slice(1);
  }
  const user = JSON.parse(localStorage.getItem("user") || "");
  const username =  capitalizeFirstLetter(user.username) || "Guest";
  return (
    <div className="w-full max-h-40 overflow-hidden bg-gradient-to-b from-green-950/80 to-green-950/30 px-4 md:px-6 rounded-lg flex justify-center items-center">
      <img className="max-h-fit max-w-52" src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760094972/image-removebg-preview_fshtui.png" alt="" />
        <div className="w-full">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2 text-center">
          Welcome, {username}
        </h1>
        <p className="text-sm md:text-base text-gray-200 truncate text-center">
          Start creating animations that Explain, Convert and just WORK!
        </p>
        </div>
      <img className="max-h-fit max-w-52" src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760094545/LqaDfYdr-removebg-preview_fvjrsm.png" alt="" />
    </div>
  );
};
const Dashboard = ({ recentProjects, fecthRecentProjects, onNavigate }: Props) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <TopDesign/>
        <QuickActions navigate={navigate} onNavigate={onNavigate}/>
        <RecentProjects
          projectsToDisplay={recentProjects.slice(-2, recentProjects.length)}
          navigate={navigate}
          fecthRecentProjects={fecthRecentProjects}
        />
        <GettingStarted />
      </div>
    </div>
  );
};

export default Dashboard;
