import React, { useState, useEffect } from "react";
import { User, Lock, Upload, Trash2, Eye, EyeOff, Save, X, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { Alert, AlertDescription } from "@/Components/ui/alert";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Separator } from "@/Components/ui/separator";
import { Badge } from "@/Components/ui/badge";
import api from "@/api";

interface UserData {
  id: string;
  username: string;
  email: string;
  bio?: string;
  profilePhoto?: string;
  plan?: string;
  role?: string;
}

interface FormData {
  username: string;
  email: string;
  bio: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const SkeletonLoader = () => (
  <div className="max-w-4xl mx-auto p-4 space-y-6">
    <div className="space-y-1.5">
      <div className="h-6 bg-zinc-800 rounded w-32 animate-pulse" />
      <div className="h-3 bg-zinc-800 rounded w-48 animate-pulse" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-1.5">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-8 bg-zinc-800 rounded animate-pulse"
          />
        ))}
      </div>

      <div className="md:col-span-3 space-y-4">
        <div className="h-48 bg-zinc-800 rounded animate-pulse" />
        <div className="flex gap-3">
          <div className="h-8 bg-zinc-800 rounded w-24 animate-pulse" />
          <div className="h-8 bg-zinc-800 rounded w-20 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

const Settings: React.FC = () => {
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
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
      localStorage.setItem('user', response.data);
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
      console.log("updateprofilephoto response: ",response.data);
      if (user) {
        setUser({ ...user, profilePhoto: response.data.profilePhoto });
        const updated_user = JSON.parse(localStorage.getItem('user') || "");
        updated_user.profilePhoto = response.data.profilePhoto;
        localStorage.setItem('user', JSON.stringify(updated_user));
      }
      toast.success("Profile photo updated successfully");
    } catch (error: any) {
      toast.error(
        "error",
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="mb-6 p-6 border-b border-zinc-800 h-16 flex items-center w-full justify-between">
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-bold text-white">Account Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user.username}</p>
              <p className="text-xs text-zinc-400">{user.email}</p>
            </div>
            <Avatar className="h-10 w-10 border border-zinc-700">
              <AvatarImage src={user.profilePhoto} alt="Profile" className="object-cover"/>
              <AvatarFallback className="bg-zinc-800 text-white">
                {user.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
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
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="bg-zinc-900 border-zinc-800 sticky top-6">
              <CardContent className="p-4">
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeTab === "profile"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => setActiveTab("password")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeTab === "password"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    Password
                  </button>
                  <button
                    onClick={() => setActiveTab("danger")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeTab === "danger"
                        ? "bg-red-900/30 text-red-300"
                        : "text-zinc-400 hover:text-red-300 hover:bg-red-900/20"
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Danger Zone
                  </button>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Profile Information
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                      Update your personal details and profile photo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Profile Photo Section */}
                    <div className="flex items-center gap-6 p-4 bg-zinc-800/50 rounded-lg">
                      <div className="relative">
                        <Avatar className="h-20 w-20 border-2 border-zinc-600">
                          <AvatarImage src={user.profilePhoto} alt="Profile" className="object-cover"/>
                          <AvatarFallback className="bg-zinc-700 text-white text-lg">
                            {user.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1">
                          {user.plan && (
                            <Badge className="bg-blue-900/60 text-blue-300 border-blue-700 text-xs">
                              {user.plan}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">
                          {user.username}
                        </h3>
                        <p className="text-zinc-400 text-sm flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 text-xs"
                            onClick={() =>
                              document.getElementById("photo-upload")?.click()
                            }
                            disabled={loading}
                          >
                            <Upload className="h-3 w-3 mr-1.5" />
                            Upload Photo
                          </Button>
                          <input
                            id="photo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoUpload}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-zinc-800" />

                    {/* Profile Form */}
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username" className="text-sm font-medium text-white">
                            Username
                          </Label>
                          <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) =>
                              setFormData({ ...formData, username: e.target.value })
                            }
                            className="bg-zinc-800 border-zinc-700 text-white focus:border-white h-10"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium text-white">
                            Email
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData({ ...formData, email: e.target.value })
                            }
                            className="bg-zinc-800 border-zinc-700 text-white focus:border-white h-10"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bio" className="text-sm font-medium text-white">
                          Bio
                        </Label>
                        <Textarea
                          id="bio"
                          value={formData.bio}
                          onChange={(e) =>
                            setFormData({ ...formData, bio: e.target.value })
                          }
                          className="bg-zinc-800 border-zinc-700 text-white focus:border-white min-h-[100px] resize-none"
                          placeholder="Tell us about yourself..."
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          type="submit"
                          disabled={loading}
                          className="bg-white text-black hover:bg-zinc-200 transition-colors h-10 px-6"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {loading ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === "password" && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Secure your account with a new password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    {(["current", "new", "confirm"] as const).map((field) => (
                      <div key={field} className="space-y-2">
                        <Label className="text-sm font-medium text-white">
                          {field === "current"
                            ? "Current Password"
                            : field === "new"
                            ? "New Password"
                            : "Confirm New Password"}
                        </Label>
                        <div className="relative">
                          <Input
                            type={showPasswords[field] ? "text" : "password"}
                            value={
                              passwordData[
                                field === "current"
                                  ? "currentPassword"
                                  : field === "new"
                                  ? "newPassword"
                                  : "confirmPassword"
                              ]
                            }
                            onChange={(e) =>
                              setPasswordData({
                                ...passwordData,
                                [field === "current"
                                  ? "currentPassword"
                                  : field === "new"
                                  ? "newPassword"
                                  : "confirmPassword"]: e.target.value,
                              })
                            }
                            className="bg-zinc-800 border-zinc-700 text-white focus:border-white h-10 pr-10"
                            required
                            minLength={field !== "current" ? 6 : undefined}
                            placeholder="••••••••"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                            onClick={() => togglePasswordVisibility(field)}
                          >
                            {showPasswords[field] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-white text-black hover:bg-zinc-200 transition-colors h-10 px-6"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        {loading ? "Changing..." : "Change Password"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Danger Tab */}
            {activeTab === "danger" && (
              <Card className="bg-zinc-900 border-red-800">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-red-400 flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription className="text-red-300">
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">
                      Delete Account
                    </h3>
                    <p className="text-red-300 text-sm leading-relaxed mb-4">
                      Once you delete your account, there is no going back. Please
                      be certain. All your data will be permanently removed and
                      cannot be recovered.
                    </p>
                    <Button
                      onClick={handleDeleteAccount}
                      disabled={loading}
                      className="bg-red-800 text-white hover:bg-red-700 transition-colors h-10 px-6"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {loading ? "Deleting..." : "Delete Account"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;