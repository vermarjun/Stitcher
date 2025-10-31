import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  UserPlus,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import api from '@/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Project {
  _id: string;
  name: string;
  updatedAt: string;
  collaborators?: number;
  status?: string;
}

interface AllProjectsProps {
  userId: string
}

const AllProjects: React.FC<AllProjectsProps> = ({ 
  userId
}) => {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch all projects function
  async function fetchAllProjects() {
    if (!api || !userId) {
      console.error('API or user not available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.get(`/project/user/${userId}`);
      setAllProjects(response.data);
      console.log('All projects fetched:', response.data);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to fetch all projects";
      if (toast) {
        toast.error(errorMessage);
      }
      console.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch projects on component mount
  useEffect(() => {
    fetchAllProjects();
  }, [api, userId]);
  
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

  const handleDeleteProject = async (projectName: string, projectId: string) => {
    if (!api || !toast) {
      console.error('API or toast not available');
      return;
    }

    try {
      await api.delete(`/project/${projectId}`);
      if (toast) {
        toast.success(`Project ${projectName} deleted successfully`);
      }
      // Refresh the projects list
      fetchAllProjects();
    } catch (error: any) {
      const errorMessage = error.message || `Error deleting project: ${projectName}`;
      if (toast) {
        toast.error(errorMessage);
      }
      console.error(errorMessage);
    }
  };

  const handleResumeProject = (projectId: string) => {
    navigate(`/dashboard/${projectId}`);
  };

  const handleAddCollaborators = () => {
    if (toast) {
      toast.success(`Hang tight, Feature coming super soooon!`);
    } else {
      console.log('Add collaborators feature coming soon!');
    }
  };

  // Loading state component
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-3"></div>
      <p className="text-zinc-400 text-xs">Loading your projects...</p>
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="relative mb-6">
        <div className="w-16 h-14 rounded-full bg-zinc-900 flex items-center justify-center mb-3">
          <FolderOpen className="w-6 h-6 text-zinc-600" />
        </div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="w-4 h-4 text-zinc-500 animate-pulse" />
        </div>
      </div>
      
      <h3 className="text-base font-semibold text-white mb-1">No Projects Yet</h3>
      <p className="text-zinc-400 text-center max-w-sm mb-4 text-xs">
        Start building something amazing. Your projects will appear here once you create them.
      </p>
      
      <button 
        className="bg-white text-black hover:bg-zinc-200 transition-all duration-200 px-3 py-1.5 rounded-md font-medium flex items-center text-xs"
        onClick={() => navigate('/create-project')}
      >
        <Plus className="w-3 h-3 mr-1.5" />
        Create Your First Project
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
        {/* Header */}
        <div className="mb-3 h-14 border-b border-zinc-800 p-3">
          <div className="flex items-center justify-between h-full">
            <div>
              <h1 className="text-xl font-semibold text-white mb-1">All Projects</h1>
            </div>
            <button 
              className="bg-white text-black hover:bg-zinc-200 transition-all duration-200 px-3 py-1.5 rounded-md font-medium flex items-center text-xs"
              onClick={() => navigate('/create-project')}
            >
              <Plus className="w-3 h-3 mr-1.5" />
              New Project
            </button>
          </div>
        </div>
      <div className="max-w-7xl mx-auto px-4">
        {/* Main Content */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
          {isLoading ? (
            <LoadingState />
          ) : allProjects.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-zinc-300 font-medium text-xs">Project Name</th>
                    <th className="text-left py-3 px-4 text-zinc-300 font-medium text-xs">Status</th>
                    <th className="text-left py-3 px-4 text-zinc-300 font-medium text-xs">Last Updated</th>
                    <th className="text-left py-3 px-4 text-zinc-300 font-medium text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allProjects.map((project, index) => (
                    <tr 
                      key={project._id}
                      className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/50 transition-colors duration-200"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <FolderOpen className="w-3 h-3 text-zinc-400" />
                          </div>
                          <span className="text-white font-medium text-xs">{project.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          project.status === 'compiled' 
                            ? 'bg-green-900/50 text-green-300'
                            : project.status === 'in_progress'
                            ? 'bg-blue-900/50 text-blue-300'
                            : project.status === 'error'
                            ? 'bg-red-900/50 text-red-300'
                            : 'bg-yellow-900/50 text-yellow-300'
                        }`}>
                          {project.status || 'draft'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-xs">
                        {timeAgo(project.updatedAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => handleResumeProject(project._id)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white border-0 h-6 px-2 rounded transition-all duration-200 text-xs font-medium flex items-center"
                          >
                            <Edit className="w-2.5 h-2.5 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={handleAddCollaborators}
                            className="bg-transparent border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 h-6 px-2 rounded transition-all duration-200 text-xs font-medium flex items-center"
                          >
                            <UserPlus className="w-2.5 h-2.5 mr-1" />
                            Share
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.name, project._id)}
                            className="bg-transparent border border-zinc-700 text-zinc-400 hover:text-red-400 hover:bg-red-900/20 hover:border-red-700 h-6 px-2 rounded transition-all duration-200 text-xs font-medium flex items-center"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default AllProjects;