import { useEffect, useState } from "react";
import Sidebar from "./Sidebar.home";
import MobileBottomNav from "./MobileBottomNav.home";
import Dashboard from "./Dashboard/Dashboard.home";
import api from "@/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Project } from "@/State/Types";
import AllProjects from "./AllProjects.home";
import Generations from "./Generations.home";
import SettingsPage from "./Settings/main.settings";
import ThreeDotLoader from "../LoadingScreens/ThreeDotLoader";
import type { IUser } from "@/State/Types";
import { useNav } from "@/Context/HomeNavigation.context";
import { maybeRunHomeTour } from "@/lib/onboardingTour";

// Main Component - Updated to handle navigation
const Main = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // const [activeItem, setActiveItem] = useState("home");
  const { activeItem, setActiveItem } = useNav();
  const [isLoading, setIsLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  const user:IUser = JSON.parse(localStorage.getItem("user") || "");
  if (!user.profilePhoto) {
    user.profilePhoto = "/default-avatar.svg";
  }

  async function fetchRecentProjects() {
    try {
      const response = await api.get<Project[]>(`/project/user/${user._id}`);
      setRecentProjects(response.data);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to fetch recent projects";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  // First-time product tour. Instead of asking the user to create a project,
  // we open their most recent one (or silently create "demo" if they have none).
  useEffect(() => {
    if (activeItem !== "home") return;
    const autoOpen = async () => {
      try {
        const res = await api.get<Project[]>(`/project/user/${user._id}`);
        const projects = res.data;
        if (projects && projects.length > 0) {
          const sorted = [...projects].sort(
            (a, b) =>
              new Date((b as any).updatedAt ?? (b as any).createdAt).getTime() -
              new Date((a as any).updatedAt ?? (a as any).createdAt).getTime()
          );
          navigate(`/dashboard/${(sorted[0] as any)._id}`);
        } else {
          const created = await api.post<any>("/project", { name: "demo" });
          navigate(`/dashboard/${created.data._id}`);
        }
      } catch {
        // silent — user can open a project themselves if the API fails
      }
    };
    maybeRunHomeTour(autoOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation handler
  const handleNavigation = (itemKey: string) => {
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
        return <AllProjects userId={user._id}/>;
      case "generations":
        return <Generations />;
      case "settings":
        return <SettingsPage currentUser={user}/>;
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
          
          <MobileBottomNav
             activeItem={activeItem} 
             onNavigate={handleNavigation}
             user={user}
             onSignOut={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/auth");
             }}
          />

          {/* Main Content */}
          <div className="flex-1 overflow-auto">{renderContent()}</div>
        </>
      )}
    </div>
  );
};

export default Main;
