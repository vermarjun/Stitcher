import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/Components/ui/alert";
import SkeletonLoader from "./SkeletonLoader.settings";
import Header from "./Header.settings";
import ProfileTab from "./ProfileTab.settings";
import PasswordTab from "./PasswordTab.settings";
import DangerTab from "./DangerTab.settings";
import type { PasswordData, ShowPasswords } from "./types.settings";
import api from "@/api";
import type { IUser } from "@/State/Types";

const Settings: React.FC<{ currentUser: IUser }> = ({ currentUser }) => {
  const [user, setUser] = useState<IUser>(currentUser);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState<ShowPasswords>({
    current: false,
    new: false,
    confirm: false,
  });

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

      {/* Single-column settings: Profile, Security, then Danger Zone */}
      <div className="px-4 md:px-6 max-w-5xl mx-auto pb-20 space-y-6 md:space-y-8">
        <ProfileTab />
        <PasswordTab
          passwordData={passwordData}
          setPasswordData={setPasswordData}
          loading={loading}
          showPasswords={showPasswords}
          togglePasswordVisibility={togglePasswordVisibility}
          handlePasswordChange={handlePasswordChange}
        />
        <DangerTab loading={loading} handleDeleteAccount={handleDeleteAccount} />
      </div>
    </div>
  );
};

export default Settings;
