import React, { useState, useEffect } from "react";
import { User, Lock, Trash2, X, Users, Heart, UserPlus, MessageCircle, PenBoxIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/Components/ui/button";
import { Alert, AlertDescription } from "@/Components/ui/alert";
import { Card, CardContent } from "@/Components/ui/card";
import SkeletonLoader from "./SkeletonLoader.settings";
import Header from "./Header.settings";
import ProfileTab from "./ProfileTab.settings";
import PasswordTab from "./PasswordTab.settings";
import DangerTab from "./DangerTab.settings";
import type { UserData, FormData, PasswordData, ShowPasswords, Message } from "./types.settings";
import api from "@/api";
import MyPosts from "./MyPosts.settings";
import type { User as IUser } from "@/State/Types";

// Custom hook inside main component
const useSettings = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    username: "",
    email: "",
    bio: "",
  });
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [activeTab, setActiveTab] = useState<string>("profile");
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
      setFormData({
        username: response.data.username || "",
        email: response.data.email || "",
        bio: response.data.bio || "",
      });
    } catch (error: any) {
      toast.error("Failed to load user data");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.put("/users/me", formData);
      setUser(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(
        "error",
        error.response?.data?.message || "Failed to update profile"
      );
    } finally {
      setLoading(false);
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
      toast.error(
        "error",
        error.response?.data?.message || "Failed to change password"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("profilePhoto", file);
      const response = await api.post("/users/profile-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (user) {
        setUser({ ...user, profilePhoto: response.data.profilePhoto });
        try {
          const raw = localStorage.getItem("user");
          if (raw) {
            const updated_user = JSON.parse(raw);
            if (updated_user && typeof updated_user === "object") {
              updated_user.profilePhoto = response.data.profilePhoto;
              localStorage.setItem("user", JSON.stringify(updated_user));
            } else {
              localStorage.setItem(
                "user",
                JSON.stringify({
                  ...user,
                  profilePhoto: response.data.profilePhoto,
                })
              );
            }
          } else {
            localStorage.setItem(
              "user",
              JSON.stringify({
                ...user,
                profilePhoto: response.data.profilePhoto,
              })
            );
          }
        } catch (parseErr) {
          console.warn("Failed to parse stored user, overwriting.", parseErr);
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...user,
              profilePhoto: response.data.profilePhoto,
            })
          );
        }
      }

      toast.success("Profile photo updated successfully");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to upload profile photo"
      );
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
      toast.error(
        "error",
        error.response?.data?.message || "Failed to delete account"
      );
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return {
    user,
    formData,
    setFormData,
    passwordData,
    setPasswordData,
    activeTab,
    setActiveTab,
    loading,
    initialLoading,
    showPasswords,
    message,
    setMessage,
    handleProfileUpdate,
    handlePasswordChange,
    handleProfilePhotoUpload,
    handleDeleteAccount,
    togglePasswordVisibility,
  };
};

// Navigation component inside main component
interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
    { id: "danger", label: "Danger Zone", icon: Trash2 },
    { id: "myposts", label: "My Posts", icon:  PenBoxIcon},
    { id: "likedposts", label: "Liked Posts", icon:  Heart},
    { id: "comments", label: "Comments", icon:  MessageCircle},
    { id: "followers", label: "Followers", icon:  Users},
    { id: "following", label: "Following", icon:  UserPlus},
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
                    ? item.id === "danger"
                      ? "bg-red-900/30 text-red-300"
                      : "bg-zinc-800 text-white"
                    : item.id === "danger"
                    ? "text-zinc-400 hover:text-red-300 hover:bg-red-900/20"
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

interface Props {
  currentUser?: IUser
}

// Main Settings Component
const Settings: React.FC<Props> = (props) => {
  const {
    user,
    passwordData,
    setPasswordData,
    activeTab,
    setActiveTab,
    loading,
    initialLoading,
    showPasswords,
    message,
    setMessage,
    handlePasswordChange,
    handleDeleteAccount,
    togglePasswordVisibility,
  } = useSettings();

  if (initialLoading) {
    return <SkeletonLoader />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Alert className="max-w-md bg-zinc-900 border-zinc-800">
          <AlertDescription className="text-zinc-300 text-xs">
            Failed to load user data. Please refresh the page and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case "profile":
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
        return (
          <MyPosts currentUser={props.currentUser}/>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header user={user} />

      <div className="px-6 max-w-6xl mx-auto">
        {/* Message Alert */}
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {renderActiveTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;