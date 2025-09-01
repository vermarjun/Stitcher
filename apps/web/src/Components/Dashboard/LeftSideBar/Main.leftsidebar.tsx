import { useState } from "react";
import {
  FileText,
  Users,
  ChevronLeft,
  Scissors,
  FolderOpen,
  Layout,
} from "lucide-react";
import AssetStash from "./AssetStash.leftsidebar";
import TemplatesComponent from "./Template.leftsidebar";
import ProjectDescriptionComponent from "./Script.leftsidebar";
import CollaboratorsComponent from "./Collaborators.leftsidebar";
import TimelineTracksSidebar from "./Tracks.leftsidebar";
import type { Project, User } from "@/State/Types";

interface Props {
  currentProject?: Project;
  user?: User;
}

const MainSidebar = ({ currentProject }: Props) => {
  const [activeTab, setActiveTab] = useState("assetstash");
  const [isExpanded, setIsExpanded] = useState(true);

  const sidebarTabs = [
    { id: "assetstash", icon: FolderOpen, label: "Asset Stash" },
    { id: "tracks", icon: Scissors, label: "Tracks" },
    { id: "templates", icon: Layout, label: "Templates" },
    { id: "description", icon: FileText, label: "Project Script" },
    { id: "collaborators", icon: Users, label: "Add Collaborators" },
  ];

  const renderActiveComponent = () => {
    switch (activeTab) {
      case "explorer":
        return <AssetStash currentProject={currentProject} />
      case "tracks":
        return <TimelineTracksSidebar currentProject={currentProject} />
      case "templates":
        return <TemplatesComponent currentProject={currentProject} />
      case "description":
        return <ProjectDescriptionComponent />
      case "collaborators":
        return <CollaboratorsComponent />;
      default:
        return <AssetStash currentProject={currentProject}/>;
    }
  };

  return (
    <div className="flex h-full bg-black border-r border-zinc-800">
      {/* Icon Strip (Always Visible) */}
      <div className="w-12 bg-black border-r border-zinc-800 flex flex-col">
        {/* Toggle Button - Now at the top */}
        <div className="p-2 border-b border-zinc-800">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded-md transition-all duration-200"
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            <ChevronLeft
              size={16}
              className={`text-zinc-400 hover:text-white transform transition-all duration-300 ${
                isExpanded ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>

        {/* Tab Icons */}
        <div className="flex flex-col py-2">
          {sidebarTabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`
                  w-12 h-12 flex items-center justify-center
                  hover:bg-zinc-800 transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? "bg-zinc-800 border-r-2 border-white"
                      : ""
                  }
                `}
                title={tab.label}
              >
                <IconComponent
                  size={18}
                  className={`transition-colors duration-200 ${
                    activeTab === tab.id ? "text-white" : "text-zinc-400 hover:text-zinc-300"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded Content with smooth animation */}
      <div 
        className={`bg-black flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "w-80 opacity-100" : "w-0 opacity-0"
        }`}
      >
        {/* Header with active tab title */}
        <div className="p-3 border-b border-zinc-800 bg-black">
          <h2 className="text-base font-semibold text-white">
            {sidebarTabs.find(tab => tab.id === activeTab)?.label || "Sidebar"}
          </h2>
        </div>

        {/* Content area */}
        <div className={`flex-1 transition-all duration-300 ${
          isExpanded ? "opacity-100 transform translate-x-0" : "opacity-0 transform translate-x-[-10px]"
        }`}>
          {isExpanded && renderActiveComponent()}
        </div>
      </div>
    </div>
  );
};

export default MainSidebar;