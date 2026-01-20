import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Trash2,
  X,
  Heart,
  MessageCircle,
  PenBoxIcon,
  ChevronRight,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/Components/ui/button";
import { Alert, AlertDescription } from "@/Components/ui/alert";
import { Sheet, SheetContent, SheetTrigger } from "@/Components/ui/sheet";
import SkeletonLoader from "./SkeletonLoader.settings";
import Header from "./Header.settings";
import ProfileTab from "./ProfileTab.settings";
import PasswordTab from "./PasswordTab.settings";
import DangerTab from "./DangerTab.settings";
import type { PasswordData, ShowPasswords, Message } from "./types.settings";
import api from "@/api";
import type { IUser } from "@/State/Types";
import { motion, AnimatePresence } from "framer-motion";

// Community components we reuse
import PostsTab from "@/Components/Home/CommunityPage/ProfilePage/poststab.profilepage";
import LikesTab from "@/Components/Home/CommunityPage/ProfilePage/likesTab.profilepage";
import CommentsTab from "@/Components/Home/CommunityPage/ProfilePage/commentTab.profilepage";
import Profile from "@/Components/Home/CommunityPage/ProfilePage/main.profilepage";
import PostDetail from "@/Components/Home/CommunityPage/PostDetail.communitypage";
import type { ICommunityPost } from "@/Components/Home/CommunityPage/main.communitypage";

// Navigation types for settings
type ViewType = "settings" | "post" | "profile";

interface NavigationState {
  view: ViewType;
  data?: any;
}

const Navigation: React.FC<{
  activeTab: string;
  setActiveTab: (t: string) => void;
  className?: string;
  onSelect?: () => void;
}> = ({ activeTab, setActiveTab, className, onSelect }) => {
  const navItems = [
    { id: "editmyprofile", label: "Profile", icon: User },
    { id: "password", label: "Security", icon: Lock },
    { id: "myposts", label: "My Posts", icon: PenBoxIcon },
    { id: "likedposts", label: "Liked Posts", icon: Heart },
    { id: "comments", label: "Comments", icon: MessageCircle },
    { id: "danger", label: "Danger Zone", icon: Trash2, className: "text-red-400 hover:text-red-300 hover:bg-red-950/30" },
  ];

  return (
    <nav className={`space-y-1 ${className}`}>
      {navItems.filter(item => item.id !== 'danger').map((item) => (
        <button
          key={item.id}
          onClick={() => {
            setActiveTab(item.id);
            onSelect?.();
          }}
          className={`w-full group flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === item.id
              ? "bg-white/10 text-white shadow-lg backdrop-blur-sm border border-white/10"
              : `text-zinc-400 hover:text-white hover:bg-zinc-800/50 ${item.className || ""}`
          }`}
        >
          <div className="flex items-center gap-3">
            <item.icon className={`h-4 w-4 ${activeTab === item.id ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300"} transition-colors`} />
            {item.label}
          </div>
          {activeTab === item.id && (
            <motion.div
              layoutId="nav-indicator"
              className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
            />
          )}
        </button>
      ))}
    </nav>
  );
};

const Settings: React.FC<{ currentUser: IUser }> = ({ currentUser }) => {
  const [user, setUser] = useState<IUser>(currentUser);
  // ... (rest of state items are fine, omitting for brevity in replacement if not changed, but I must provide full replacement for the chunk)
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [activeTab, setActiveTab] = useState<string>("editmyprofile");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState<ShowPasswords>({
    current: false,
    new: false,
    confirm: false,
  });
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await api.get<any>("/users/me");
      setUser(response.data);
    } catch (error: any) {
      toast.error("Failed to load user data");
    } finally {
      setInitialLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.put<any>("/users/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password changed successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete your account? This action cannot be undone."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await api.delete<any>("/users/me");
      toast.success("Account deleted successfully");
      window.location.href = "/";
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete account");
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Navigation stack similar to CommunityPage
  const [navigationStack, setNavigationStack] = useState<NavigationState[]>([
    { view: "settings" },
  ]);
  const currentView = navigationStack[navigationStack.length - 1];

  const navigateTo = (view: ViewType, data?: any) => {
    setNavigationStack((prev) => [...prev, { view, data }]);
  };

  const navigateBack = () => {
    setNavigationStack((prev) =>
      prev.length > 1 ? prev.slice(0, prev.length - 1) : prev
    );
  };

  const handlePostClick = (post: ICommunityPost) => {
    navigateTo("post", post);
  };

  const handleProfileClick = (author: IUser) => {
    // If current view is profile, replace top of stack, else push
    if (currentView.view === "profile") {
      setNavigationStack((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { view: "profile", data: author };
        return updated;
      });
    } else {
      navigateTo("profile", author);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "editmyprofile":
        return <ProfileTab />;
      case "password":
        return (
          <PasswordTab
            passwordData={passwordData}
            setPasswordData={setPasswordData}
            loading={loading}
            showPasswords={showPasswords}
            togglePasswordVisibility={togglePasswordVisibility}
            handlePasswordChange={handlePasswordChange}
          />
        );
      case "danger":
        return (
          <DangerTab
            loading={loading}
            handleDeleteAccount={handleDeleteAccount}
          />
        );
      case "myposts":
        return <PostsTab userId={user?._id} onPostClick={handlePostClick} />;
      case "likedposts":
        return <LikesTab userId={user._id} onPostClick={handlePostClick} />;
      case "comments":
        return <CommentsTab userId={user?._id} />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    if (currentView.view === "post") {
      return (
        <PostDetail
          post={currentView.data}
          currentUser={currentUser}
          onBack={navigateBack}
          onProfileClick={handleProfileClick}
          formatCount={formatCount}
        />
      );
    }
    
    if (currentView.view === "profile") {
      return (
        <Profile
          profile={currentUser}
          currentUser={currentUser}
          onBack={navigateBack}
          onPostClick={handlePostClick}
        />
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderActiveTab()}
        </motion.div>
      </AnimatePresence>
    );
  };

  if (initialLoading) return <SkeletonLoader />;

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Alert className="max-w-md bg-zinc-900 border-zinc-800">
          <AlertDescription className="text-zinc-300 text-xs">
            Failed to load user data. Please refresh the page and try again.
          </AlertDescription>
        </Alert>
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header (always visible above content) */}
      <Header user={user} />

      <div className="px-4 md:px-6 max-w-7xl mx-auto pb-20">
        {/* Message */}
        {message && (
          <Alert
            className={`mb-6 ${
              message.type === "error"
                ? "border-red-500/50 bg-red-900/10 text-red-200"
                : "border-green-500/50 bg-green-900/10 text-green-200"
            }`}
          >
            <AlertDescription className="flex items-center justify-between text-sm font-medium">
              <span>{message.text}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessage(null)}
                className="h-6 w-6 p-0 hover:bg-transparent text-current opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
          {/* Sidebar / Navigation */}
          <div className="lg:col-span-3">
            {/* Desktop Navigation */}
            <div className="hidden lg:block sticky top-24">
              <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/5 p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-4">
                  Settings Menu
                </h3>
                <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
              </div>
            </div>

            {/* Mobile Navigation Trigger */}
            <div className="lg:hidden mb-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800">
                    <span className="flex items-center gap-2">
                       <Menu className="h-4 w-4" />
                       Menu
                    </span>
                    <ChevronRight className="h-4 w-4 text-zinc-500" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="top" className="bg-zinc-950 border-b-zinc-800 p-0">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                      {user.profilePhoto ? (
                        <img 
                          src={user.profilePhoto} 
                          alt={user.username} 
                          className="h-10 w-10 rounded-full object-cover border border-zinc-700"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center">
                           <User className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white">Settings</p>
                        <p className="text-xs text-zinc-400">Manage your account</p>
                      </div>
                    </div>
                    <Navigation 
                      activeTab={activeTab} 
                      setActiveTab={setActiveTab} 
                      onSelect={() => document.getElementById('close-sheet')?.click()}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-4 md:space-y-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
