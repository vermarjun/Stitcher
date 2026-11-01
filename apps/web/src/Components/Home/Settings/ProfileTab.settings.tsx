import React, { useEffect, useState } from "react";
import { Mail, Save, Calendar, Camera } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { toast } from "sonner";
import api from "@/api";
import { format } from "date-fns";
import type { IUser } from "@/State/Types";

interface ProfilePhotoUploadResponse {
  message: string;
  profilePhoto: string;
}

const ProfileTab: React.FC = () => {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<IUser> | null>(null);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const res = await api.get<IUser>("/users/me");
      const data = res.data as any;

      // normalize createdAt to string
      const createdAt = data.createdAt
        ? new Date(data.createdAt).toISOString()
        : new Date().toISOString();

      const normalizedUser: IUser = {
        _id: data._id || "",
        username: data.username || "",
        email: data.email || "",
        profilePhoto:
          data.profilePhoto || "/default-avatar.svg",
        createdAt,
        bio: data.bio || "",
      };

      setUser(normalizedUser);
      setFormData({
        username: normalizedUser.username,
        email: normalizedUser.email,
        profilePhoto: normalizedUser.profilePhoto,
        createdAt: normalizedUser.createdAt,
        bio: normalizedUser.bio,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const updateLocalStorageUser = (updated: any) => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const newUser = { ...parsed, ...updated };
          localStorage.setItem("user", JSON.stringify(newUser));
          return;
        }
      }
      localStorage.setItem("user", JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to update localStorage user, overwriting.", err);
      localStorage.setItem("user", JSON.stringify(updated));
    }
  };

  const handleProfilePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("profilePhoto", file);
      const response = await api.post<ProfilePhotoUploadResponse>("/users/profile-photo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newPhoto = (response.data as any).profilePhoto;

      if (user) {
        const updatedUser = { ...user, profilePhoto: newPhoto };
        setUser(updatedUser);
        updateLocalStorageUser({ profilePhoto: newPhoto });
        if (formData) setFormData({ ...formData, profilePhoto: newPhoto });
      }
      toast.success("Profile photo updated successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Failed to upload profile photo"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setLoading(true);
    try {
      // send only editable fields to backend
      const payload: any = {
        username: formData.username,
        bio: formData.bio,
      };
      const response = await api.put<IUser>("/users/me", payload);
      const updated = response.data;
      const updatedUser: IUser = {
        _id: user?._id || "",
        username: updated.username || formData.username || "",
        email: updated.email || formData.email || "",
        profilePhoto: updated.profilePhoto || user?.profilePhoto || "",
        createdAt:
          updated.createdAt || user?.createdAt || new Date().toISOString(),
        bio: updated.bio ?? formData.bio ?? "",
      };

      setUser(updatedUser);
      setFormData({
        ...formData,
        username: updatedUser.username,
        bio: updatedUser.bio,
      });
      updateLocalStorageUser(updatedUser);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Failed to update profile, Username already taken");
    } finally {
      setLoading(false);
    }
  };

  // helper getters
  const createdAtDisplay = user?.createdAt
    ? format(new Date(user.createdAt), "PP")
    : "";

  const openAvatarPicker = () =>
    document.getElementById("profilephoto-upload")?.click();

  return (
    <div className="space-y-5">
      {/* ── Profile card: identity + edit form ── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          {/* Identity row */}
          <div className="px-4 md:px-5 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-3">
                {/* Avatar */}
                <div className="group/avatar relative shrink-0">
                  <Avatar className="h-[72px] w-[72px] border-4 border-zinc-900 ring-1 ring-zinc-800 md:h-20 md:w-20">
                    <AvatarImage
                      src={user?.profilePhoto}
                      alt="Profile"
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-zinc-800 text-xl font-semibold text-white">
                      {user?.username?.charAt(0)?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={openAvatarPicker}
                    aria-label="Change profile photo"
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover/avatar:opacity-100"
                  >
                    <Camera className="h-5 w-5 text-white/90" />
                  </button>
                  <input
                    id="profilephoto-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoUpload}
                    className="hidden"
                  />
                </div>

                {/* Name + meta */}
                <div className="pb-0.5">
                  <h2 className="text-lg font-semibold leading-tight tracking-tight text-white">
                    {user?.username}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      {user?.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      Joined {createdAtDisplay}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Divider */}
            <div className="my-5 h-px w-full bg-zinc-800" />

            {/* Edit form */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">
                Profile information
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Update your account details.
              </p>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs text-zinc-400">
                    Username
                  </Label>
                  {formData && (
                    <Input
                      id="username"
                      value={formData.username || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="h-9 border-zinc-800 bg-zinc-950 text-sm text-white focus-visible:border-[#19E5A1]/50 focus-visible:ring-[#19E5A1]/20"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-zinc-400">
                    Email address
                  </Label>
                  {formData && (
                    <Input
                      id="email"
                      value={formData.email || ""}
                      disabled
                      className="h-9 cursor-not-allowed border-zinc-900 bg-zinc-950/50 text-sm text-zinc-500"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-xs text-zinc-400">
                  Bio
                </Label>
                {formData && (
                  <Textarea
                    id="bio"
                    value={formData.bio || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                    maxLength={500}
                    className="min-h-[88px] resize-none border-zinc-800 bg-zinc-950 text-sm text-white focus-visible:border-[#19E5A1]/50 focus-visible:ring-[#19E5A1]/20"
                    placeholder="Tell us a bit about yourself..."
                  />
                )}
                <p className="text-right text-[11px] text-zinc-500">
                  {(formData?.bio?.length || 0)}/500
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="h-9 w-full sm:w-auto sm:min-w-[120px] bg-white text-black hover:bg-zinc-200"
                >
                  {loading ? (
                    <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  ) : (
                    <Save className="mr-2 h-3.5 w-3.5" />
                  )}
                  Save changes
                </Button>
              </div>
            </form>
          </div>
      </div>
    </div>
  );
};

export default ProfileTab;
