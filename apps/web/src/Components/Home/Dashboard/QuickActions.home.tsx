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
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { type NavigateFunction } from "react-router-dom";
import api from "@/api";
import { ShineBorder } from "../../magicui/shine-border";

interface Props3 {
  navigate: NavigateFunction;
  onNavigate: (itemKey:string)=>void,
}

const QuickActions = ({ navigate, onNavigate }: Props3) => {
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
      const response = await api.post("/project", {
        name: formData.projectName,
        description: formData.description,
        category: formData.category,
      });

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
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
          <p className="text-zinc-400 text-xs">
            Get started with your next project
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Card
                onClick={startNewProject}
                className="relative overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer group bg-zinc-900 hover:bg-zinc-800"
              >
                <ShineBorder
                  borderWidth={1}
                  duration={8}
                  shineColor={["#19E5A1", "#02684D", "#00231a"]}
                />

                <CardContent className="p-2.5">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-all duration-200">
                      <Plus className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors duration-200" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-medium text-white text-xs group-hover:text-white transition-colors duration-200">
                        Create New Project
                      </h3>
                      <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors duration-200">
                        Start a fresh project
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

          <Card 
            onClick={()=>{onNavigate("api-keys")}}
            className="border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer group bg-zinc-900 hover:bg-zinc-800">
            <CardContent className="p-2.5">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-all duration-200">
                  <Upload className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors duration-200" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-medium text-white text-xs group-hover:text-white transition-colors duration-200">
                    API Keys
                  </h3>
                  <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors duration-200">
                    Add API keys or check usage
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            onClick={() => onNavigate("templates")}
            className="border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer group bg-zinc-900 hover:bg-zinc-800">
            <CardContent className="p-2.5">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-all duration-200">
                  <LayoutTemplate className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors duration-200" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-medium text-white text-xs group-hover:text-white transition-colors duration-200">
                    Browse Templates
                  </h3>
                  <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors duration-200">
                    Choose from templates
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