import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  UserPlus,
  FolderOpen,
  Sparkles,
  Search,
  LayoutGrid,
  List as ListIcon,
  Calendar,
  MoreVertical,
} from 'lucide-react';
import api from '@/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/Components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { Button } from "@/Components/ui/button";

interface Project {
  _id: string;
  name: string;
  description?: string;
  updatedAt: string;
  collaborators?: number;
  status?: string;
  category?: string;
}

interface AllProjectsProps {
  userId: string
}

const AllProjects: React.FC<AllProjectsProps> = ({ 
  userId
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    projectName: "",
    description: "",
    category: "",
  });
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
      const response = await api.get<Project[]>(`/project/user/${userId}`);
      setAllProjects(response.data);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to fetch all projects";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAllProjects();
  }, [userId]);
  
  function timeAgo(date: Date | string) {
    const now = new Date();
    const past = typeof date === "string" ? new Date(date) : date;
    const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return past.toLocaleDateString(); 
  }

  const handleDeleteProject = async (projectName: string, projectId: string) => {
    try {
      await api.delete(`/project/${projectId}`);
      toast.success(`Project ${projectName} deleted successfully`);
      fetchAllProjects();
    } catch (error: any) {
      toast.error(error.message || `Error deleting project`);
    }
  };

  const handleResumeProject = (projectId: string) => {
    navigate(`/dashboard/${projectId}`);
  };

  const handleAddCollaborators = () => {
    toast.success(`Feature coming soon!`);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName.trim()) {
      toast.error("Project name is required");
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post<any>("/project", {
        name: formData.projectName,
        description: formData.description,
        category: formData.category,
      });
      if (response.status === 201) {
        toast.success("Project created successfully!");
        setIsModalOpen(false);
        setFormData({ projectName: "", description: "", category: "" });
        navigate(`/dashboard/${(response.data as any)._id}`);
      } else {
        toast.error((response.data as any).message || "Failed to create project");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProjects = allProjects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatusBadge = ({ status }: { status?: string }) => {
    const styles = {
      compiled: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20',
      default: 'bg-zinc-800 text-zinc-400 border-zinc-700'
    };
    
    const statusKey = status as keyof typeof styles;
    const style = styles[statusKey] || styles.default;
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${style} uppercase tracking-wide`}>
        {status || 'Draft'}
      </span>
    );
  };

  // Mobile Project Card
  const ProjectCard = ({ project }: { project: Project }) => (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3 active:scale-[0.99] transition-transform">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="text-[16px] font-semibold text-white">{project.name}</h3>
          <StatusBadge status={project.status} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800">
            <DropdownMenuItem onClick={() => handleResumeProject(project._id)} className="cursor-pointer">
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddCollaborators} className="cursor-pointer">
              <UserPlus className="mr-2 h-4 w-4" /> Share
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => handleDeleteProject(project.name, project._id)} className="text-red-400 cursor-pointer focus:text-red-400 focus:bg-red-950/20">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
         <div className="flex items-center gap-1.5">
           <Calendar className="h-3.5 w-3.5" />
           {timeAgo(project.updatedAt)}
         </div>
      </div>

      <Button 
        onClick={() => handleResumeProject(project._id)}
        className="w-full bg-white text-black hover:bg-zinc-200 h-9 text-sm font-medium mt-2"
      >
        Resume Project
      </Button>
    </div>
  );

  const SkeletonLoader = () => (
    <div className="space-y-4">
       {[...Array(3)].map((_, i) => (
         <div key={i} className="h-24 bg-zinc-900/50 rounded-xl border border-zinc-800 animate-pulse" />
       ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-10">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-white tracking-tight hidden md:block">All Projects</h1>
            
            {/* Mobile Title or Search */}
            <div className="flex-1 md:max-w-md flex items-center gap-2">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search projects..."
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full pl-9 pr-4 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:bg-zinc-900 transition-all"
                    />
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-lg shadow-emerald-900/20 whitespace-nowrap">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Project</span>
                  <span className="sm:hidden">New</span>
                </button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 text-white border-zinc-800 max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input
                      id="projectName"
                      name="projectName"
                      value={formData.projectName}
                      onChange={handleInputChange}
                      placeholder="e.g. My Awesome Video"
                      className="bg-black/50 border-zinc-800 focus:border-emerald-500/50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Brief description of your project"
                      className="bg-black/50 border-zinc-800 focus:border-emerald-500/50 resize-none"
                    />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="category">Category (Optional)</Label>
                    <Input
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      placeholder="e.g. Marketing, Tutorial"
                      className="bg-black/50 border-zinc-800 focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">Create Project</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {isLoading ? (
          <SkeletonLoader />
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-zinc-800">
                <FolderOpen className="w-8 h-8 text-zinc-600" />
            </div>
            <div>
                <h3 className="text-lg font-medium text-white">No projects found</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-1">
                    {searchQuery ? `No matches for "${searchQuery}"` : "Get started by creating your first project."}
                </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredProjects.map((project) => (
                <ProjectCard key={project._id} project={project} />
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-zinc-900/20 border border-zinc-800/50 rounded-xl overflow-hidden backdrop-blur-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-black/20">
                    <th className="text-left py-4 px-6 text-zinc-400 font-medium text-xs uppercase tracking-wider">Project Name</th>
                    <th className="text-left py-4 px-6 text-zinc-400 font-medium text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left py-4 px-6 text-zinc-400 font-medium text-xs uppercase tracking-wider">Last Updated</th>
                    <th className="text-right py-4 px-6 text-zinc-400 font-medium text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredProjects.map((project) => (
                    <tr 
                      key={project._id} 
                      className="group hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all">
                             <FolderOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium text-[15px] text-white group-hover:text-emerald-400 transition-colors cursor-pointer" onClick={() => handleResumeProject(project._id)}>
                                {project.name}
                            </div>
                            {project.category && (
                                <div className="text-xs text-zinc-500">{project.category}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="py-4 px-6 text-sm text-zinc-400">
                        {timeAgo(project.updatedAt)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                             onClick={() => handleResumeProject(project._id)}
                             className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                             title="Edit Project"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                             onClick={handleAddCollaborators}
                             className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                             title="Share Project"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                           <button
                             onClick={() => handleDeleteProject(project.name, project._id)}
                             className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all"
                             title="Delete Project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AllProjects;