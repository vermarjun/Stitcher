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
import Teams from "./Teams.home";
// import Pricing from "./Pricing.home";
import ApiKeys from "./ApiKeys.home";
import Templates from "./Templates.home";
import Assets from "./Assets.home";
import SettingsPage from "./Settings/main.settings";
import ThreeDotLoader from "../LoadingScreens/ThreeDotLoader";
import AnimationCommunity from "./CommunityPage/main.communitypage";
import Backpack from "./Backpack/main.backpack";
import NotificationsComponent from "./Dashboard/Notifications.home";
import PricingPage from "./Pricing.home";
import type { IUser } from "@/State/Types";
import { useNav } from "@/Context/HomeNavigation.context";
import { FEATURES } from "@/config/features";

// Main Component - Updated to handle navigation
const Main = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // const [activeItem, setActiveItem] = useState("home");
  const { activeItem, setActiveItem } = useNav();
  const [isLoading, setIsLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  const user:IUser = JSON.parse(localStorage.getItem("user") || "");
  if (user.profilePhoto == "") {
    user.profilePhoto =
      "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";
  }

  async function fetchRecentProjects() {
    try {
      const response = await api.get<Project[]>(`/project/user/${user._id}`);
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
        return <AllProjects userId={user._id}/>;
      case "generations":
        return <Generations />;
      case "teams":
        return FEATURES.community ? <Teams /> : (
          <Dashboard recentProjects={recentProjects} fecthRecentProjects={fetchRecentProjects} onNavigate={handleNavigation} />
        );
      case "community":
        return FEATURES.community ? <AnimationCommunity currentUser={user}/> : (
          <Dashboard recentProjects={recentProjects} fecthRecentProjects={fetchRecentProjects} onNavigate={handleNavigation} />
        );
      case "backpack":
        return FEATURES.community ? <Backpack/> : (
          <Dashboard recentProjects={recentProjects} fecthRecentProjects={fetchRecentProjects} onNavigate={handleNavigation} />
        );
      case "api-keys":
        return <ApiKeys />;
      case "templates":
        return <Templates />;
      case "assets":
        return <Assets />;
      case "settings":
        return <SettingsPage currentUser={user}/>;
      case "notifications":
        return FEATURES.community ? <NotificationsComponent /> : (
          <Dashboard recentProjects={recentProjects} fecthRecentProjects={fetchRecentProjects} onNavigate={handleNavigation} />
        );
      case "pricing":
        return <PricingPage />;

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
