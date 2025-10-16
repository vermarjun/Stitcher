import { useEffect, useState } from "react";
import Sidebar from "./Sidebar.home";
import Dashboard from "./Dashboard/Dashboard.home";
import api from "@/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Project } from "@/State/Types";
import AllProjects from "./AllProjects.home";
import Teams from "./Teams.home";
// import Pricing from "./Pricing.home";
import ApiKeys from "./ApiKeys.home";
import Templates from "./Templates.home";
import Assets from "./Assets.home";
import SettingsPage from "./Settings.home";

import ThreeDotLoader from "../LoadingScreens/ThreeDotLoader";

// Main Component - Updated to handle navigation
const Main = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("home");
  const [isLoading, setIsLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  // Mock user data
  const user = JSON.parse(localStorage.getItem("user") || "");
  if (user.profilePhoto == "") {
    user.profilePhoto =
      "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";
  }

  async function fetchRecentProjects() {
    try {
      const response = await api.get(`/project/user/${user.id}`);
      setRecentProjects(response.data);
      console.log(response.data)
    } catch (error: any) {
      const errorMessage = error.message || "Failed to fetch recent projects";
      toast.error(errorMessage);
      console.log(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  // Navigation handler
  // @ts-ignore
  const handleNavigation = (itemKey) => {
    setActiveItem(itemKey);
  };

  const navigate = useNavigate();

  // Content renderer based on active item
  const renderContent = () => {
    switch (activeItem) {
      case "home":
        return (
          <Dashboard
            recentProjects={recentProjects}
            fecthRecentProjects={fetchRecentProjects}
            onNavigate={handleNavigation}
          />
        );
      case "projects":
        return <AllProjects user={user}/>;
      case "teams":
        return <Teams />;
      // case "pricing":
        // return <Pricing />;
      case "api-keys":
        return <ApiKeys />;
      case "templates":
        return <Templates />;
      case "assets":
        return <Assets />;
      case "settings":
        return <SettingsPage />;
      default:
        return (
          <Dashboard
            recentProjects={recentProjects}
            fecthRecentProjects={fetchRecentProjects}
            onNavigate={handleNavigation}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-neutral-950">
      {isLoading ? (
        <ThreeDotLoader />
      ) : (
        <>
          {/* Sidebar */}
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            user={user}
            activeItem={activeItem}
            onNavigate={handleNavigation}
            navigate={navigate}
          />

          {/* Main Content */}
          <div className="flex-1 overflow-auto">{renderContent()}</div>
        </>
      )}
    </div>
  );
};

export default Main;
