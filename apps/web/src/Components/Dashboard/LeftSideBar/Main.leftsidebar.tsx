import { useState } from "react";
import {
  ChevronLeft,
  FolderOpen,
  Brain,
  X,
} from "lucide-react";
import AssetStash from "./AssetStash/main.assetstash";
import MemoryComponent from "./Memory.leftsidebar";
import type { Project } from "@/State/Types";

interface Props {
  currentProject?: Project;
}

const MainSidebar = ({ currentProject }: Props) => {
  const [activeTab, setActiveTab] = useState("assetstash");
  const [isExpanded, setIsExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sidebarTabs = [
    { id: "assetstash", icon: FolderOpen, label: "Asset Stash" },
    { id: "memory", icon: Brain, label: "Memory" },
  ];

  const renderActiveComponent = () => {
    switch (activeTab) {
      case "explorer":
      case "assetstash":
        return <AssetStash currentProject={currentProject} />;
      case "memory":
        return <MemoryComponent />;
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
      <div
        data-mobile-nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-[60] flex justify-around items-center px-2 py-2 safe-pb"
      >
        {sidebarTabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id && drawerOpen;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (activeTab === tab.id && drawerOpen) {
                  setDrawerOpen(false);
                } else {
                  setActiveTab(tab.id);
                  setDrawerOpen(true);
                }
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            >
              <IconComponent size={20} />
              <span className="text-[10px] mt-1">{tab.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile bottom sheet — a custom panel (not vaul) so the bottom nav can
          sit ABOVE it (higher z-index). Tapping a different tab switches panels
          instantly instead of dismissing the sheet, and it fills the full height
          below the header. */}
      <div
        className={`md:hidden fixed left-0 right-0 bottom-0 top-12 z-[58] flex flex-col bg-black border-t border-zinc-800 transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        role="dialog"
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="font-semibold text-lg">
            {sidebarTabs.find((t) => t.id === activeTab)?.label}
          </h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-20">
          {renderActiveComponent()}
        </div>
      </div>
    </>
  );
};

export default MainSidebar;
