import React, { useEffect, useState } from "react";
import { Mail, Save, Calendar, UserPlus, Camera, ImagePlus, Pencil } from "lucide-react";
import { FEATURES } from "@/config/features";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { FlickeringGrid } from "@/Components/ui/flickering-grid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { toast } from "sonner";
import api from "@/api";
import { format } from "date-fns";
import type { IUser } from "@/State/Types";
import type { ProfilePhotoUploadResponse, ProfileBannerUploadResponse } from "@/types/api.types";

const ProfileTab: React.FC = () => {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<IUser> | null>(null);

  const [modalOpen, setModalOpen] = useState<"followers" | "following" | null>(
    null
  );
  const [listLoading, setListLoading] = useState(false);
  const [listData, setListData] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);

  const fetchList = async (type: "followers" | "following", page = 1) => {
    if (!user) return;
    setListLoading(true);
    try {
      const res = await api.get<any>(`/users/${user._id}/${type}?page=${page}`);
      const data = res.data as any;
      setListData((prev) =>
        page === 1 ? data[type] : [...prev, ...data[type]]
      );
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load ${type}`);
    } finally {
      setListLoading(false);
    }
  };

  const handleOpenModal = (type: "followers" | "following") => {
    setModalOpen(type);
    setListData([]);
    fetchList(type, 1);
  };

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
          data.profilePhoto || "https://www.gravatar.com/avatar/?d=mp",
        profileBanner: data.profileBanner || "",
        createdAt,
        bio: data.bio || "",
        role: data.role || "user",
        plan: data.plan || "free",
        credits: data.credits || {
          generation: 0,
          editing: 0,
          expiresAt: Date.now()
        },
        isTestAccount: data.isTestAccount || false,
        aura: typeof data.aura === "number" ? data.aura : 0,
        stats: data.stats || {
          totalPosts: 0,
          totalLikes: 0,
          totalComments: 0,
          totalViews: 0,
          followersCount: 0,
          followingCount: 0,
          lastUpdated: new Date(),
        },
        followers: data.followers || [],
        following: data.following || [],
      };

      setUser(normalizedUser);
      setFormData({
        username: normalizedUser.username,
        email: normalizedUser.email,
        profilePhoto: normalizedUser.profilePhoto,
        profileBanner: normalizedUser.profileBanner,
        createdAt: normalizedUser.createdAt,
        bio: normalizedUser.bio,
        role: normalizedUser.role,
        plan: normalizedUser.plan,
        aura: normalizedUser.aura,
        stats: normalizedUser.stats,
        followers: normalizedUser.followers,
        following: normalizedUser.following,
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

  const handleProfileBannerUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("profileBanner", file);
      const response = await api.post<ProfileBannerUploadResponse>("/users/profile-banner", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newBanner = (response.data as any).profileBanner;

      if (user) {
        const updatedUser = { ...user, profileBanner: newBanner };
        setUser(updatedUser);
        updateLocalStorageUser({ profileBanner: newBanner });
        if (formData) setFormData({ ...formData, profileBanner: newBanner });
      }
      toast.success("Profile banner updated successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Failed to upload profile banner"
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
        username:
          updated.username || formData.username || "",
        email: updated.email || formData.email || "",
        profilePhoto: updated.profilePhoto || user?.profilePhoto || "",
        profileBanner: updated.profileBanner || user?.profileBanner || "",
        createdAt:
          updated.createdAt || user?.createdAt || new Date().toISOString(),
        bio: updated.bio ?? formData.bio ?? "",
        role: updated.role || user?.role || "user",
        credits: updated.credits || {
          generation: 0,
          editing: 0,
          expiresAt: Date.now()
        },
        isTestAccount: updated.isTestAccount || false,
        plan: updated.plan || user?.plan || "free",
        aura: typeof updated.aura === "number" ? updated.aura : user?.aura ?? 0,
        stats: updated.stats || user?.stats,
        followers: updated.followers || user?.followers || [],
        following: updated.following || user?.following || [],
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
  const followersCount =
    user?.stats?.followersCount ?? user?.followers?.length ?? 0;
  const followingCount =
    user?.stats?.followingCount ?? user?.following?.length ?? 0;
  const createdAtDisplay = user?.createdAt
    ? format(new Date(user.createdAt), "PP")
    : "";

  const openBannerPicker = () =>
    document.getElementById("banner-upload")?.click();
  const openAvatarPicker = () =>
    document.getElementById("profilephoto-upload")?.click();

  return (
    <div className="space-y-5">
      {/* ── Profile card: banner + identity + edit form, unified ── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          {/* Banner */}
          <div className="relative h-28 md:h-36 w-full overflow-hidden bg-zinc-950">
            {user?.profileBanner ? (
              <>
                <img
                  src={user.profileBanner}
                  alt="Banner"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/10 to-transparent" />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute top-3 right-3 h-7 gap-1.5 rounded-md border border-white/10 bg-black/50 px-2.5 text-xs text-white backdrop-blur-sm hover:bg-black/70"
                  onClick={openBannerPicker}
                >
                  <Pencil className="h-3 w-3" />
                  Edit banner
                </Button>
              </>
            ) : (
              /* Empty banner — animated flickering grid in brand green that
                 doubles as an "upload here" affordance. */
              <button
                type="button"
                onClick={openBannerPicker}
                aria-label="Upload a profile banner"
                className="group/banner absolute inset-0 h-full w-full"
              >
                <FlickeringGrid
                  className="absolute inset-0"
                  color="#19E5A1"
                  squareSize={3}
                  gridGap={6}
                  flickerChance={0.22}
                  maxOpacity={0.18}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
                <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900/80 ring-1 ring-white/10 transition-colors group-hover/banner:ring-[#19E5A1]/40">
                    <ImagePlus className="h-4 w-4 text-[#19E5A1]" />
                  </div>
                  <p className="text-xs font-medium text-zinc-300">
                    Upload a banner
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Recommended 1500 × 500
                  </p>
                </div>
              </button>
            )}
            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              onChange={handleProfileBannerUpload}
              className="hidden"
            />
          </div>

          {/* Identity row */}
          <div className="px-4 md:px-5 pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-3">
                {/* Avatar */}
                <div className="group/avatar relative -mt-9 shrink-0">
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

              {FEATURES.community && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-zinc-700 bg-zinc-900/50 px-3 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    onClick={() => handleOpenModal("followers")}
                  >
                    <span className="mr-1 font-semibold text-white">
                      {followersCount}
                    </span>
                    Followers
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-zinc-700 bg-zinc-900/50 px-3 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    onClick={() => handleOpenModal("following")}
                  >
                    <span className="mr-1 font-semibold text-white">
                      {followingCount}
                    </span>
                    Following
                  </Button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="my-5 h-px w-full bg-zinc-800" />

            {/* Edit form */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">
                Profile information
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Update your account details and public profile.
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

      {/* Stats Grid — community stats only shown when feature is on */}
      {FEATURES.community && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Posts", value: user?.stats?.totalPosts ?? 0 },
            { label: "Total Likes", value: user?.stats?.totalLikes ?? 0 },
            { label: "Comments", value: user?.stats?.totalComments ?? 0 },
            { label: "Total Views", value: user?.stats?.totalViews ?? 0 },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center"
            >
              <p className="text-xl font-semibold text-white">{stat.value}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-zinc-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Followers / Following Modal — community only */}
      <Dialog open={FEATURES.community && !!modalOpen} onOpenChange={() => setModalOpen(null)}>
        <DialogContent className="gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-white sm:max-w-md">
          <DialogHeader className="border-b border-zinc-800 p-4">
            <DialogTitle className="text-center text-base font-semibold capitalize text-white">
              {modalOpen}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {listLoading && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800 border-t-white" />
              </div>
            )}
            {!listLoading && listData.length === 0 && (
              <div className="py-12 text-center text-zinc-500">
                <UserPlus className="mx-auto mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm">No {modalOpen} found</p>
              </div>
            )}

            <div className="space-y-1">
              {listData.map((item) => (
                <div
                  key={item._id}
                  className="group flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-zinc-800">
                      <AvatarImage src={item.profilePhoto} />
                      <AvatarFallback className="bg-zinc-900 text-zinc-500">
                        {item.username?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-white transition-colors group-hover:text-[#19E5A1]">
                        {item.username}
                      </p>
                      {item.bio && (
                        <p className="line-clamp-1 max-w-[180px] text-xs text-zinc-500">
                          {item.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>

            {pagination?.hasMore && (
              <div className="flex justify-center p-4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={listLoading}
                  onClick={() =>
                    fetchList(
                      modalOpen as "followers" | "following",
                      pagination.currentPage + 1
                    )
                  }
                  className="w-full border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileTab;
