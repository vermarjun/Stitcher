import React, { useState } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import {
  Plus,
  Upload,
  FileText,
  Edit,
  Trash2,
  UserPlus,
  Play,
  Ghost,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import api from "@/api";
import type { Project } from "@/State/Types";
import { ShineBorder } from "../magicui/shine-border";

interface Props {
  recentProjects: Project[];
  fecthRecentProjects: () => void;
}
interface Props2 {
  projectsToDisplay: Project[];
  navigate: NavigateFunction;
  fecthRecentProjects: () => void;
}
interface Props3 {
  navigate: NavigateFunction;
}
const RecentProjects = ({ projectsToDisplay, navigate, fecthRecentProjects }: Props2) => {
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
    try {
      await api.delete(`/project/${projectId}`); 
      toast.success(`Project ${projectName} deleted successfully`);
      
      // Call the callback to refresh the projects list
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

  const GhostPlaceholder = () => (
    <>
      {/* Ghost rows */}
      {[1, 2].map((index) => (
        <tr
          key={index}
          className="border-b border-neutral-800 last:border-b-0 animate-pulse relative"
          style={{
            animationDelay: `${index * 200}ms`,
            animationDuration: "2s",
          }}
        > 
          <td className="py-4 px-6 relative">
            <div className="flex items-center space-x-3">
              <Ghost className="w-5 h-5 text-neutral-700 animate-float flex-shrink-0" />
              <div className="h-4 bg-gradient-to-r from-neutral-800 to-neutral-700 rounded blur-[0.5px] opacity-50" 
                   style={{ width: `${120 + index * 30}px` }}></div>
            </div>
          </td>
          <td className="py-4 px-6 relative">
            <div className="h-8 w-20 bg-gradient-to-r from-blue-900/30 to-blue-800/30 rounded blur-[0.5px] opacity-40 flex items-center justify-center">
              <Edit className="w-3 h-3 text-blue-600/50" />
            </div>
          </td>
          <td className="py-4 px-6 relative">
            <div className="h-8 w-20 bg-gradient-to-r from-red-900/30 to-red-800/30 rounded blur-[0.5px] opacity-40 flex items-center justify-center">
              <Trash2 className="w-3 h-3 text-red-600/50" />
            </div>
          </td>
          <td className="py-4 px-6 relative">
            <div className="h-8 w-16 bg-gradient-to-r from-green-900/30 to-green-800/30 rounded blur-[0.5px] opacity-40 flex items-center justify-center">
              <UserPlus className="w-3 h-3 text-green-600/50" />
            </div>
          </td>
          <td className="py-4 px-6 relative">
            <div className="h-4 bg-gradient-to-r from-neutral-800 to-neutral-700 rounded blur-[0.5px] opacity-40" 
                 style={{ width: `${80 + index * 15}px` }}></div>
          </td>
        </tr>
      ))}
      
      {/* Floating sparkles positioned relative to table */}
      <tr className="absolute inset-0 pointer-events-none">
        <td colSpan={5} className="relative">
          <div className="absolute top-4 left-20 animate-bounce delay-300">
            <Sparkles className="w-3 h-3 text-neutral-600 opacity-30" />
          </div>
          <div className="absolute top-12 right-32 animate-bounce delay-700">
            <Sparkles className="w-2 h-2 text-neutral-600 opacity-25" />
          </div>
          <div className="absolute bottom-6 left-40 animate-bounce delay-1000">
            <Sparkles className="w-2 h-2 text-neutral-600 opacity-35" />
          </div>
        </td>
      </tr>
      
      {/* Toast-style message overlay */}
      <tr className="absolute inset-0 pointer-events-none">
        <td colSpan={5} className="flex items-center justify-center h-full">
          <div className="bg-black/60 backdrop-blur-md border border-neutral-700/50 rounded-xl px-6 py-4 shadow-2xl max-w-sm mx-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="text-white font-medium text-sm mb-1 leading-tight">
                  Create Your First Project
                </h3>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Your recent projects will appear here once you start creating
                </p>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );

  return (
    <>
      {/* Recent Projects Section */}
      <div className="space-y-6 animate-in fade-in duration-700 delay-200">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Recent Projects</h2>
          <p className="text-neutral-400">
            {projectsToDisplay.length === 0 
              ? "Your projects will appear here once you create them" 
              : "Continue working on your latest projects"
            }
          </p>
        </div>
        <Card className="border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-all duration-300 hover:shadow-lg hover:shadow-neutral-900/20">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-4 px-6 text-white font-medium w-1/4">
                    Project Name
                  </th>
                  <th className="text-left py-4 px-6 text-white font-medium w-1/5">
                    Resume Editing
                  </th>
                  <th className="text-left py-4 px-6 text-white font-medium w-1/5">
                    Delete Project
                  </th>
                  <th className="text-left py-4 px-6 text-white font-medium w-1/5">
                    Add Collaborators
                  </th>
                  <th className="text-left py-4 px-6 text-white font-medium w-1/5">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="relative">
                {projectsToDisplay.length === 0 ? (
                  <GhostPlaceholder />
                ) : (
                  projectsToDisplay.map((project, index) => (
                    <tr
                      key={project._id}
                      className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-900 transition-colors duration-200 animate-in fade-in slide-in-from-left-4"
                      style={{ animationDelay: `${(index + 1) * 100}ms` }}
                    >
                      <td className="py-4 px-6 font-medium text-white w-1/4 truncate">
                        {project.name}
                      </td>
                      <td className="py-4 px-6 w-1/5">
                        <Button
                          size="sm"
                          onClick={() => handleResumeProject(project._id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white border-0 transition-all duration-300 hover:scale-105 hover:shadow-md"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Resume
                        </Button>
                      </td>
                      <td className="py-4 px-6 w-1/5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteProject(project.name, project._id)}
                          className="border-red-700 text-red-400 hover:bg-red-900 hover:border-red-600 hover:text-red-300 transition-all duration-300 hover:scale-105"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </td>
                      <td className="py-4 px-6 w-1/5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddCollaborators}
                          className="border-green-700 text-green-400 hover:bg-green-900 hover:border-green-600 hover:text-green-300 transition-all duration-300 hover:scale-105"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </td>
                      <td className="py-4 px-6 text-neutral-400 w-1/5 truncate">
                        {timeAgo(project.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

const GettingStarted = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-700 delay-400">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Getting Started</h2>
        <p className="text-neutral-400">
          Learn the basics with these quick videos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
        <Card className="border border-neutral-800 hover:border-neutral-700 transition-all duration-300 cursor-pointer group overflow-hidden bg-neutral-950 hover:bg-neutral-900 transform hover:scale-105 hover:shadow-lg hover:shadow-neutral-900/20">
          <div className="relative">
            <div className="aspect-[16/10] bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center transition-colors duration-300">
              <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                <Play className="w-5 h-5 text-blue-400 ml-0.5 group-hover:text-blue-300 transition-colors duration-300" />
              </div>
            </div>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
          </div>
          <CardContent className=" text-left">
            <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors duration-300 mb-1">
              What is Stitcher
            </h3>
            <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors duration-300">
              An introduction to Stitcher
            </p>
          </CardContent>
        </Card>
        <Card className="border border-neutral-800 hover:border-neutral-700 transition-all duration-300 cursor-pointer group overflow-hidden bg-neutral-950 hover:bg-neutral-900 transform hover:scale-105 hover:shadow-lg hover:shadow-neutral-900/20">
          <div className="relative">
            <div className="aspect-[16/10] bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center transition-colors duration-300">
              <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                <Play className="w-5 h-5 text-blue-400 ml-0.5 group-hover:text-blue-300 transition-colors duration-300" />
              </div>
            </div>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
          </div>
          <CardContent className=" text-left">
            <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors duration-300 mb-1">
              Create Your First Video
            </h3>
            <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors duration-300">
              Make your first AI video
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const QuickActions = ({navigate}:Props3) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectName: "",
    description: "",
    category: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.projectName.trim()) {
      toast.error("Project name is required");
      return;
    }

    setIsLoading(true);
    console.log("sending data", formData);
    try {
      const response = await api.post("/project", {
        name: formData.projectName,
        description: formData.description,
        category: formData.category,
      });
      console.log("response recieved: ", response);

      if (response.status == 201) {
        toast.success("Project created successfully!");
        setIsModalOpen(false);
        setFormData({ projectName: "", description: "", category: "" });
        navigate(`/dashboard/${response.data._id}`);
      } else {
        toast.error(response.data.message || "Failed to create project");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to create project";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewProject = () => {
    setIsModalOpen(true);
  };
  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Quick Actions</h2>
          <p className="text-neutral-400">Get started with your next project</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Card
                onClick={startNewProject}
                className="relative overflow-hidden border border-neutral-800 hover:border-neutral-700 transition-all duration-300 cursor-pointer group bg-neutral-950 hover:bg-neutral-900 transform hover:scale-105 hover:shadow-lg hover:shadow-neutral-900/20"
              >
                <ShineBorder shineColor="white" />

                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-neutral-700 transition-all duration-300">
                      <Plus className="w-5 h-5 text-neutral-300 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors duration-300">
                        Create New Project
                      </h3>
                      <p className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors duration-300">
                        Start a fresh project from scratch
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="bg-neutral-950 border-neutral-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-white">
                  Create New Project
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName" className="text-neutral-300">
                    Project Name *
                  </Label>
                  <Input
                    id="projectName"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleInputChange}
                    placeholder="Enter project name"
                    className="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-neutral-300">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter project description (optional)"
                    className="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-blue-500 min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-neutral-300">
                    Category
                  </Label>
                  <Input
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="Enter project category (optional)"
                    className="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="border-white bg-red-50 text-red-500 hover:bg-neutral-800 hover:text-white"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating..." : "Create Project"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="border border-neutral-800 hover:border-neutral-700 transition-all duration-300 cursor-pointer group bg-neutral-950 hover:bg-neutral-900 transform hover:scale-105 hover:shadow-lg hover:shadow-neutral-900/20">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-neutral-700 transition-all duration-300">
                  <Upload className="w-5 h-5 text-neutral-300 group-hover:text-white transition-colors duration-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors duration-300">
                    Import Assets
                  </h3>
                  <p className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors duration-300">
                    Upload your media files and assets
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-neutral-800 hover:border-neutral-700 transition-all duration-300 cursor-pointer group bg-neutral-950 hover:bg-neutral-900 transform hover:scale-105 hover:shadow-lg hover:shadow-neutral-900/20">
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-neutral-700 transition-all duration-300">
                  <FileText className="w-5 h-5 text-neutral-300 group-hover:text-white transition-colors duration-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-white text-sm group-hover:text-blue-400 transition-colors duration-300">
                    Browse Templates
                  </h3>
                  <p className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors duration-300">
                    Choose from pre-made templates
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

// Dashboard Component (Home page content)
const Dashboard = ({ recentProjects, fecthRecentProjects }: Props) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Quick Actions Section */}
        <QuickActions navigate={navigate}/>

        {/* Recent Projects Section */}
        <RecentProjects
          projectsToDisplay={recentProjects.slice(-2, recentProjects.length)}
          navigate={navigate}
          fecthRecentProjects={fecthRecentProjects}
        />

        {/* Getting Started Section */}
        <GettingStarted />
      </div>
    </div>
  );
};

export default Dashboard;
