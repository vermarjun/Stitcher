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
  Compass,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { type NavigateFunction } from "react-router-dom";
import api from "@/api";
import { ShineBorder } from "../../magicui/shine-border";
import { LINKS } from "@/config/links";
import { startReplayTour } from "@/lib/onboardingTour";

interface Props3 {
  navigate: NavigateFunction;
  onNavigate: (itemKey:string)=>void,
}

const QuickActions = ({ navigate }: Props3) => {
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
    try {
      const response = await api.post<any>("/project", {
        name: formData.projectName,
        description: formData.description,
        category: formData.category,
      });

      if (response.status == 201) {
        toast.success("Project created successfully!");
        setIsModalOpen(false);
        setFormData({ projectName: "", description: "", category: "" });
        navigate(`/dashboard/${(response.data as any)._id}`);
      } else {
        toast.error((response.data as any).message || "Failed to create project");
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
      <div className="space-y-3 animate-in fade-in duration-500">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
          <p className="text-zinc-400 text-sm">
            Get started with your next project
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Card
                data-tour="create-project"
                onClick={startNewProject}
                className="relative overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer group bg-zinc-900/50 hover:bg-zinc-900 h-full min-h-[110px]"
              >
                <ShineBorder
                  borderWidth={1}
                  duration={8}
                  shineColor={["#19E5A1", "#02684D", "#00231a"]}
                />

                <CardContent className="p-4 flex flex-col items-center justify-center h-full">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-all duration-200 ring-1 ring-white/5">
                      <Plus className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors duration-200" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-white text-sm group-hover:text-white transition-colors duration-200">
                        New Project
                      </h3>
                      <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors duration-200 hidden sm:block">
                        Start fresh
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 text-white border-zinc-800 max-w-md p-4">
              <DialogHeader className="pb-2">
                <DialogTitle className="text-base font-semibold text-white">
                  Create New Project
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="projectName"
                    className="text-zinc-300 text-xs"
                  >
                    Project Name *
                  </Label>
                  <Input
                    id="projectName"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleInputChange}
                    placeholder="Enter project name"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-white text-xs h-8"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="description"
                    className="text-zinc-300 text-xs"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter project description (optional)"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-white min-h-[70px] text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="category"
                    className="text-zinc-300 text-xs"
                  >
                    Category
                  </Label>
                  <Input
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="Enter project category (optional)"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-white text-xs h-8"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white text-xs h-7 px-2"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-white text-black hover:bg-zinc-200 text-xs h-7 px-2"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Replaces "Browse Templates" (already in the left panel). Starts the
              guided cat-meme tour from here; finishing Act 1 arms the editor leg
              to auto-run once the user opens a project. */}
          <Card
            onClick={() => {
              const autoOpen = async () => {
                try {
                  const userStr = localStorage.getItem("user");
                  const u = userStr ? JSON.parse(userStr) : null;
                  const res = await api.get<any[]>(`/project/user/${u?._id}`);
                  const projects = res.data;
                  if (projects && projects.length > 0) {
                    const sorted = [...projects].sort(
                      (a, b) =>
                        new Date(b.updatedAt ?? b.createdAt).getTime() -
                        new Date(a.updatedAt ?? a.createdAt).getTime()
                    );
                    navigate(`/dashboard/${sorted[0]._id}`);
                  } else {
                    const created = await api.post<any>("/project", { name: "demo" });
                    navigate(`/dashboard/${created.data._id}`);
                  }
                } catch {
                  // silent fallback
                }
              };
              startReplayTour(autoOpen);
            }}
            className="border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer group bg-zinc-900/50 hover:bg-zinc-900 h-full min-h-[110px]">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-all duration-200 ring-1 ring-white/5">
                  <Compass className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors duration-200" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-white text-sm group-hover:text-white transition-colors duration-200">
                    Take the Tour
                  </h3>
                  <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors duration-200 hidden sm:block">
                    Guided demo 🐱
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            onClick={() => { window.open(LINKS.docs, "_blank"); }}
            className="hidden md:flex flex-col border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer group bg-zinc-900/50 hover:bg-zinc-900 h-full min-h-[110px]">
            <CardContent className="p-4 flex flex-col items-center justify-center h-full w-full">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-all duration-200 ring-1 ring-white/5">
                  <Terminal className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors duration-200" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-white text-sm group-hover:text-white transition-colors duration-200">
                    API, MCP &amp; Agent
                  </h3>
                  <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors duration-200 hidden sm:block">
                    Use Stitcher in your stack
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

export default QuickActions