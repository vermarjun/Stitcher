import { useState } from "react";
import {
  Users,
  ChevronLeft,
  Scissors,
  FolderOpen,
  Layout,
  Backpack,
  Edit,
  Brain,
} from "lucide-react";
import AssetStash from "./AssetStash/main.assetstash";
import TemplatesComponent from "./Template.leftsidebar";
import ProjectDescriptionComponent from "./Script.leftsidebar";
import CollaboratorsComponent from "./Collaborators.leftsidebar";
import TimelineTracksSidebar from "./Tracks.leftsidebar";
import MemoryComponent from "./Memory.leftsidebar";
import type { Project, IUser } from "@/State/Types";
// import BackpackComponent from "@/Components/Dashboard/LeftSideBar/Backpack.leftsidebar";
import BackpackComponent from "./BackPack/main.backpack";
import { Drawer, DrawerContent, DrawerTrigger } from "@/Components/ui/drawer";
import { FEATURES } from "@/config/features";

interface Props {
  currentProject?: Project;
  user?: IUser;
}

const MainSidebar = ({ currentProject }: Props) => {
  const [activeTab, setActiveTab] = useState("assetstash");
  const [isExpanded, setIsExpanded] = useState(true);

  const sidebarTabs = [
    { id: "assetstash", icon: FolderOpen, label: "Asset Stash" },
    { id: "tracks", icon: Scissors, label: "Tracks" },
    ...(FEATURES.community ? [{ id: "backpack", icon: Backpack, label: "Backpack" }] : []),
    { id: "templates", icon: Layout, label: "Templates" },
    { id: "description", icon: Edit, label: "Project Script" },
    { id: "memory", icon: Brain, label: "Memory" },
    { id: "collaborators", icon: Users, label: "Add Collaborators" },
  ];

  const renderActiveComponent = () => {
    switch (activeTab) {
      case "explorer":
      case "assetstash":
        return <AssetStash currentProject={currentProject} />;
      case "tracks":
        return <TimelineTracksSidebar currentProject={currentProject} />;
      case "templates":
        return <TemplatesComponent currentProject={currentProject} />;
      case "description":
        return <ProjectDescriptionComponent currentProject={currentProject} />;
      case "memory":
        return <MemoryComponent />;
      case "collaborators":
        return <CollaboratorsComponent />;
      case "backpack":
        return <BackpackComponent currentProject={currentProject}/>;
      default:
        return <AssetStash currentProject={currentProject} />;
    }
  };

  return (
    <>
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <div className="hidden md:flex h-full bg-black border-r border-zinc-600 z-50">
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
          <div className="flex flex-col">
            {sidebarTabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  data-tour={`sidebar-${tab.id}`}
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
                      activeTab === tab.id
                        ? "text-white"
                        : "text-zinc-400 hover:text-zinc-300"
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
              {sidebarTabs.find((tab) => tab.id === activeTab)?.label ||
                "Sidebar"}
            </h2>
          </div>

          {/* Content area */}
          <div
            className={`flex-1 transition-all duration-300 ${
              isExpanded
                ? "opacity-100 transform translate-x-0"
                : "opacity-0 transform translate-x-[-10px]"
            }`}
          >
            {isExpanded && renderActiveComponent()}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation (Visible only on Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-[60] flex justify-around items-center px-2 py-2 safe-pb">
        {sidebarTabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <Drawer key={tab.id}>
              <DrawerTrigger asChild>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                     activeTab === tab.id ? "text-white" : "text-zinc-500"
                  }`}
                >
                  <IconComponent size={20} />
                  <span className="text-[10px] mt-1">{tab.label.split(" ")[0]}</span>
                </button>
              </DrawerTrigger>
              <DrawerContent className="bg-black border-zinc-800 text-white h-[80vh]">
                 <div className="flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                        <h2 className="font-semibold text-lg">{tab.label}</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {renderActiveComponent()}
                    </div>
                 </div>
              </DrawerContent>
            </Drawer>
          );
        })}
      </div>
    </>
  );
};

export default MainSidebar;
