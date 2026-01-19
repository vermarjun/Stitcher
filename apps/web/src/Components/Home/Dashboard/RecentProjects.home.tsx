import { toast } from "sonner";
import api from "@/api";
import {
  Edit,
  Trash2,
  UserPlus,
  FolderOpen,
  Sparkles,
  Ghost,
  Plus,
} from "lucide-react";
import type { Project } from "@/State/Types";

interface Props2 {
  projectsToDisplay: Project[];
  navigate: (path: string) => void;
  fecthRecentProjects: () => void;
}

const RecentProjects = ({
  projectsToDisplay,
  navigate,
  fecthRecentProjects,
}: Props2) => {
  function timeAgo(date: Date | string) {
    const now = new Date();
    const past = typeof date === "string" ? new Date(date) : date;
    const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    if (seconds < 60) return `${seconds} sec${seconds !== 1 ? "s" : ""} ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? "s" : ""} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? "s" : ""} ago`;
  }

  const handleDeleteProject = async (
    projectName: string,
    projectId: string
  ) => {
    try {
      await api.delete(`/project/${projectId}`);
      toast.success(`Project ${projectName} deleted successfully`);
      fecthRecentProjects();
    } catch (error) {
      toast.error(`Error! Project: ${projectName} not deleted`);
    }
  };

  const handleResumeProject = (projectId: string) => {
    navigate(`/dashboard/${projectId}`);
  };

  const handleAddCollaborators = () => {
    toast.success(`Hang tight, Feature coming super soooon!`);
  };

  // THIS PLACE HOLDER SHOULD ACT AS LOADING SKELETON THAT IS TO BE DISPLAYED WHILE THE PROJECTS ARE BEING LAODED (no isloading variable just the logic that project.lenght === 0 means it is loading rightnow!)
  const GhostPlaceholder = () => (
    <>
      {[1, 2, 3].map((index) => (
        <tr
          key={index}
          className="border-b border-zinc-800 last:border-b-0 animate-pulse relative"
        >
          {/* Project Name */}
          <td className="py-4 px-6">
            <div className="flex items-center space-x-3">
              <Ghost className="w-4 h-4 text-zinc-700 animate-float flex-shrink-0" />
              <div
                className="h-3 bg-gradient-to-r from-zinc-800 to-zinc-700 rounded blur-[0.5px] opacity-50"
                style={{ width: `${100 + index * 25}px` }}
              ></div>
            </div>
          </td>

          {/* Status */}
          <td className="py-4 px-6">
            <div className="h-6 w-20 bg-gradient-to-r from-zinc-800 to-zinc-700 rounded-full blur-[0.5px] opacity-50"></div>
          </td>

          {/* Last Updated */}
          <td className="py-4 px-6">
            <div
              className="h-3 bg-gradient-to-r from-zinc-800 to-zinc-700 rounded blur-[0.5px] opacity-50"
              style={{ width: `${70 + index * 12}px` }}
            ></div>
          </td>

          {/* Actions */}
          <td className="py-4 px-6">
            <div className="flex space-x-2">
              <div className="h-8 w-20 bg-gradient-to-r from-blue-900/30 to-blue-800/30 rounded blur-[0.5px] opacity-40"></div>
              <div className="h-8 w-16 bg-gradient-to-r from-green-900/30 to-green-800/30 rounded blur-[0.5px] opacity-40"></div>
              <div className="h-8 w-8 bg-gradient-to-r from-red-900/30 to-red-800/30 rounded blur-[0.5px] opacity-40"></div>
            </div>
          </td>
        </tr>
      ))}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-3 left-16 animate-bounce delay-300">
          <Sparkles className="w-2 h-2 text-zinc-600 opacity-30" />
        </div>
        <div className="absolute top-10 right-28 animate-bounce delay-700">
          <Sparkles className="w-1.5 h-1.5 text-zinc-600 opacity-25" />
        </div>
        <div className="absolute bottom-5 left-32 animate-bounce delay-1000">
          <Sparkles className="w-1.5 h-1.5 text-zinc-600 opacity-35" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-transparent">
          <div className="bg-black/5 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-4 mt-10 shadow-2xl text-center">
            {/* Plus Button */}
            <button className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full p-2 flex items-center justify-center mx-auto mb-4 transition-colors duration-200 hover:scale-110 pointer-events-auto">
              <Plus className="w-8 h-8 text-white/90" />
            </button>

            {/* Text */}
            <p className="text-zinc-400 text-sm font-light max-w-[240px] mx-auto">
              You don't have any recent projects, start with creating your first
              project.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  if (projectsToDisplay.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-white">Recent Projects</h2>
            <p className="text-zinc-400 text-sm">Loading your recent projects...</p>
          </div>
        </div>

        {/* Loading Table */}
        <div className="bg-black border border-zinc-800 rounded-lg shadow-2xl relative">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                    Project Name
                  </th>
                  <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                    Status
                  </th>
                  <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                    Last Updated
                  </th>
                  <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <GhostPlaceholder />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
          <p className="text-zinc-400 text-[10px] sm:text-xs">
            {projectsToDisplay.length === 0
              ? "Your projects will appear here once you create them"
              : "Continue working on your recent projects"}
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-black border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left py-2.5 px-4 text-zinc-400 text-[10px] uppercase tracking-wider font-medium">
                  Recent Projects
                </th>
                <th className="text-left py-2.5 px-4 text-zinc-400 text-[10px] uppercase tracking-wider font-medium">
                  Status
                </th>
                <th className="text-left py-2.5 px-4 text-zinc-400 text-[10px] uppercase tracking-wider font-medium">
                  Last Updated
                </th>
                <th className="text-center py-2.5 px-4 text-zinc-400 text-[10px] uppercase tracking-wider font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {projectsToDisplay.map((project, index) => (
                <tr
                  key={project._id}
                  className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900/50 transition-colors duration-200 animate-in fade-in slide-in-from-left-4"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <td className="py-2.5 px-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:border-zinc-700 transition-colors">
                        <FolderOpen className="w-4 h-4 text-zinc-400" />
                      </div>
                      <span className="text-white text-xs font-medium">
                        {project.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        project.status === "completed"
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : project.status === "processing"
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          : project.status === "error"
                          ? "bg-red-500/10 text-red-500 border-red-500/20"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {project.status || "draft"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-zinc-400 text-xs">
                    {timeAgo(project.updatedAt)}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex justify-center items-center gap-1.5">
                      <button
                        onClick={() => handleResumeProject(project._id)}
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                        title="Resume"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleAddCollaborators}
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                        title="Add Collaborators"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteProject(project.name, project._id)
                        }
                        className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {projectsToDisplay.map((project, index) => (
          <div 
            key={project._id}
            className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 space-y-3 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                   <FolderOpen className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-white text-xs font-medium">{project.name}</h3>
                  <p className="text-zinc-500 text-[10px]">{timeAgo(project.updatedAt)}</p>
                </div>
              </div>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  project.status === "completed"
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : project.status === "processing"
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : project.status === "error"
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
              >
                {project.status || "draft"}
              </span>
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
               <button
                  onClick={() => handleResumeProject(project._id)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Edit className="w-3 h-3" />
                  Resume
                </button>
                <button
                  onClick={handleAddCollaborators}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3 h-3" />
                  Add
                </button>
                <button
                  onClick={() => handleDeleteProject(project.name, project._id)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .slide-in-from-left-4 {
          animation: slideInFromLeft 0.4s ease-out forwards;
        }

        @keyframes slideInFromBottom {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .slide-in-from-bottom-4 {
          animation: slideInFromBottom 0.4s ease-out forwards;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default RecentProjects;