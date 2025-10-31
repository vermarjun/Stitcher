import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Trash2,
  X,
  Heart,
  MessageCircle,
  PenBoxIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/Components/ui/button";
import { Alert, AlertDescription } from "@/Components/ui/alert";
import { Card, CardContent } from "@/Components/ui/card";
import SkeletonLoader from "./SkeletonLoader.settings";
import Header from "./Header.settings";
import ProfileTab from "./ProfileTab.settings";
import PasswordTab from "./PasswordTab.settings";
import DangerTab from "./DangerTab.settings";
import type { PasswordData, ShowPasswords, Message } from "./types.settings";
import api from "@/api";
import type { IUser } from "@/State/Types";

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
}> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: "editmyprofile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
    { id: "myposts", label: "My Posts", icon: PenBoxIcon },
    { id: "likedposts", label: "Liked Posts", icon: Heart },
    { id: "comments", label: "Comments", icon: MessageCircle },
    { id: "danger", label: "Danger Zone", icon: Trash2 },
  ];

  return (
    <div className="lg:col-span-1">
      <Card className="bg-zinc-900 border-zinc-800 sticky top-18">
        <CardContent className="px-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  activeTab === item.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </CardContent>
      </Card>
    </div>
  );
};

const Settings: React.FC<{ currentUser: IUser }> = ({ currentUser }) => {
  const [user, setUser] = useState<IUser>(currentUser);
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
      const response = await api.get("/users/me");
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
      await api.put("/users/change-password", {
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
      await api.delete("/users/me");
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
      case "post":
        return (
          <PostDetail
            post={currentView.data}
            currentUser={currentUser}
            onBack={navigateBack}
            onProfileClick={handleProfileClick}
            formatCount={formatCount}
          />
        );
      case "profile":
        return (
          <Profile
            profile={currentUser}
            currentUser={currentUser}
            onBack={navigateBack}
            onPostClick={handlePostClick}
          />
        );
      default:
        return null;
    }
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

      <div className="px-6 max-w-6xl mx-auto">
        {/* Message */}
        {message && (
          <Alert
            className={`mb-6 ${
              message.type === "error"
                ? "border-red-500 bg-red-900/30"
                : "border-green-500 bg-green-900/30"
            }`}
          >
            <AlertDescription className="flex items-center justify-between text-sm">
              <span
                className={
                  message.type === "error" ? "text-red-300" : "text-green-300"
                }
              >
                {message.text}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessage(null)}
                className="h-5 w-5 p-0 hover:bg-transparent text-zinc-400 hover:text-white"
              >
                <X className="h-3" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* GRID: Navigation (col 1) always visible, Main stage (col 2-4) switches */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="grid sm:hidden">
            <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <div className="lg:col-span-3 space-y-6">
            {/* MAIN AREA: Switch based on navigationStack top */}
            {currentView.view === "settings" && renderActiveTab()}

            {currentView.view === "post" && (
              <PostDetail
                post={currentView.data}
                currentUser={currentUser}
                onBack={navigateBack}
                onProfileClick={handleProfileClick}
                formatCount={formatCount}
              />
            )}

            {currentView.view === "profile" && (
              <Profile
                profile={currentUser}
                currentUser={currentUser}
                onBack={navigateBack}
                onPostClick={handlePostClick}
              />
            )}
          </div>
          <div className="hidden sm:grid">
            <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
