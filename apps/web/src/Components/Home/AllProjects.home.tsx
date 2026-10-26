import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  FolderOpen,
  Calendar,
  MoreVertical,
  SearchIcon,
} from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/Components/ui/input-group";
import api from '@/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { AuroraButton } from "@/Components/ui/aurora-button";

interface Project {
  _id: string;
  name: string;
  description?: string;
  updatedAt: string;
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

  // Fetch the user's projects, newest first.
  async function fetchAllProjects() {
    if (!api || !userId) {
      console.error('API or user not available');
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.get<Project[]>(`/project/user/${userId}`);
      setAllProjects(
        [...res.data].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );
    } catch {
      toast.error("Failed to fetch your projects");
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

  // Mobile Project Card — tapping anywhere opens the project
  const ProjectCard = ({ project }: { project: Project }) => (
    <div
      onClick={() => handleResumeProject(project._id)}
      className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 space-y-1.5">
            <h3 className="text-sm font-medium text-white truncate">{project.name}</h3>
          </div>
        </div>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 flex-shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800">
               <DropdownMenuItem onClick={() => handleDeleteProject(project.name, project._id)} className="text-red-400 cursor-pointer focus:text-red-400 focus:bg-red-950/20">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
         <Calendar className="h-3.5 w-3.5" />
         {timeAgo(project.updatedAt)}
      </div>
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

            {/* Search */}
            <div className="flex-1 md:max-w-md flex items-center">
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Search"
                  placeholder="Search projects..."
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </div>

            <AuroraButton
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 text-sm font-medium whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
              <span className="sm:hidden">New</span>
            </AuroraButton>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                <h3 className="text-base font-medium text-white">No projects found</h3>
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
                    <th className="text-left py-3 px-6 text-zinc-400 font-medium text-xs uppercase tracking-wider">Project Name</th>
                    <th className="text-left py-3 px-6 text-zinc-400 font-medium text-xs uppercase tracking-wider">Last Updated</th>
                    <th className="text-right py-3 px-6 text-zinc-400 font-medium text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredProjects.map((project) => (
                    <tr
                      key={project._id}
                      onClick={() => handleResumeProject(project._id)}
                      className="group hover:bg-zinc-900/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <span className="font-medium text-sm text-white group-hover:text-emerald-400 transition-colors truncate block">
                                {project.name}
                            </span>
                            {project.category && (
                                <div className="text-xs text-zinc-500">{project.category}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-sm text-zinc-400">
                        {timeAgo(project.updatedAt)}
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(project.name, project._id);
                            }}
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
