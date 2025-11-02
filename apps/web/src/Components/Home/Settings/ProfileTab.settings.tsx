import React, { useEffect, useState } from "react";
import { Mail, Upload, Save, Calendar, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Separator } from "@/Components/ui/separator";
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
      const res = await api.get(`/users/${user._id}/${type}?page=${page}`);
      const data = res.data;
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
      const res = await api.get("/users/me");
      const data = res.data;

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
      const response = await api.post("/users/profile-photo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newPhoto =
        response.data.profilePhoto ||
        response.data.profilePhotoUrl ||
        response.data.url ||
        response.data;

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
      const response = await api.post("/users/profile-banner", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newBanner =
        response.data.profileBanner ||
        response.data.profileBannerUrl ||
        response.data.url ||
        response.data;

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
      const response = await api.put("/users/me", payload);
      const updated = response.data;
      const updatedUser: IUser = {
        _id: user?._id || "",
        username:
          updated.username || updated.user?.username || formData.username || "",
        email: updated.email || formData.email || "",
        profilePhoto: updated.profilePhoto || user?.profilePhoto || "",
        profileBanner: updated.profileBanner || user?.profileBanner || "",
        createdAt:
          updated.createdAt || user?.createdAt || new Date().toISOString(),
        bio: updated.bio ?? formData.bio ?? "",
        role: updated.role || user?.role || "user",
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
    ? format(new Date(user.createdAt), "PPP")
    : "";

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 p-0 pb-4 border-zinc-800 overflow-hidden rounded-2xl shadow-lg">
        {/* ===== Banner Section ===== */}
        <div className="relative">
          <div
            className="w-full h-44 md:h-52 bg-zinc-800"
            style={{
              backgroundImage: user?.profileBanner
                ? `url(${user.profileBanner})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />

            {/* Change Banner Button */}
            <div className="absolute top-3 right-3">
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-600 bg-black/40 text-white hover:bg-zinc-700/50"
                onClick={() =>
                  document.getElementById("banner-upload")?.click()
                }
              >
                <Upload className="h-4 w-4 mr-2" />
                Change Banner
              </Button>
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                onChange={handleProfileBannerUpload}
                className="hidden"
              />
            </div>
            <div className="flex bg-zinc-800 rounded-full py-1 pl-6 pr-2 absolute -bottom-8 right-3 justify-center items-center text-right">
              <div>
                <p className="text-sm text-zinc-400">Aura</p>
                <p className="text-2xl font-bold text-white">
                  {user?.aura ?? 0}
                </p>
              </div>
              <span className="text-5xl">🔥</span>
            </div>
          </div>

          {/* ===== Avatar Section ===== */}
          <div className="relative px-6 pb-3">
            <div className="absolute -top-12 flex items-end gap-4">
              <div className="relative justify-center items-end">
                <Avatar className="h-24 w-24 md:h-28 md:w-28 border-4 border-zinc-900 rounded-full">
                  <AvatarImage
                    src={user?.profilePhoto}
                    alt="Profile"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-700 text-white text-xl">
                    {user?.username?.charAt(0)?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-600 absolute bottom-1 -right-16 bg-black/40 text-white hover:bg-zinc-700/50"
                  onClick={() =>
                    document.getElementById("profilephoto-upload")?.click()
                  }
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
                <input
                  id="profilephoto-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== User Info Section ===== */}
        <div className="mt-10 px-6 space-y-4">
          <div className="flex flex-wrap justify-between items-start">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-white">
                {user?.username}
              </h2>
              <p className="text-zinc-400 text-sm mt-1 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {user?.email}
              </p>
            </div>
          </div>

          <div className="text-sm font-normal text-zinc-400 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {createdAtDisplay}
          </div>

          {/* ===== Meta Info Section (Followers / Following) ===== */}
          <div className="text-sm text-zinc-300 flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-1 sm:gap-4 justify-between">
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleOpenModal("followers")}
                className="hover:underline cursor-pointer hover:text-white transition"
              >
                <span className="font-semibold text-white">
                  {followersCount}
                </span>{" "}
                Followers
              </button>
              <button
                onClick={() => handleOpenModal("following")}
                className="hover:underline cursor-pointer hover:text-white transition"
              >
                <span className="font-semibold text-white">
                  {followingCount}
                </span>{" "}
                Following
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between w-full flex-wrap gap-4">
            <div className="flex text-sm text-zinc-400">
              <div className="border-r pr-4">
                <span className="text-white font-medium">
                  {user?.stats?.totalPosts ?? 0}
                </span>{" "}
                Posts
              </div>
              <div className="border-r px-4">
                <span className="text-white font-medium">
                  {user?.stats?.totalLikes ?? 0}
                </span>{" "}
                Likes
              </div>
              <div className="border-r px-4">
                Comments:{" "}
                <span className="text-white font-medium">
                  {user?.stats?.totalComments ?? 0}
                </span>
              </div>
              <div className="px-4">
                Views:{" "}
                <span className="text-white font-medium">
                  {user?.stats?.totalViews ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-2 bg-zinc-800" />

        <CardContent className="space-y-6">
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="flex justify-center items-end gap-4 h-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-sm font-medium text-white"
                  >
                    Username
                  </Label>
                  {formData && (
                    <Input
                      id="username"
                      value={formData.username || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="bg-zinc-800 border-zinc-700 text-white focus:border-white h-10"
                      required
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-white"
                  >
                    Email
                  </Label>
                  {formData && (
                    <Input
                      id="email"
                      type="email"
                      disabled
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      value={formData.email || ""}
                      className="bg-zinc-800 border-zinc-700 text-white focus:border-white h-10"
                    />
                  )}
                </div>
              </div>
              <div className="flex w-fit h-full justify-end items-start">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-white text-black hover:bg-zinc-200 rounded-md h-10 px-6"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-sm font-medium text-white">
                Bio
              </Label>
              {formData && (
                <Textarea
                  id="bio"
                  value={formData.bio || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  className="bg-zinc-800 border-zinc-700 text-white focus:border-white min-h-[100px] resize-none"
                  placeholder="Tell us about yourself..."
                />
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ===== Followers / Following Modal ===== */}
      <Dialog open={!!modalOpen} onOpenChange={() => setModalOpen(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white border-none focus:ring-0 max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white capitalize text-center">
              {modalOpen}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 mt-3">
            {listLoading && (
              <p className="text-center text-zinc-400 py-6">Loading...</p>
            )}
            {!listLoading && listData.length === 0 && (
              <p className="text-center text-zinc-400 py-6">
                No {modalOpen} yet.
              </p>
            )}

            {listData.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between border-b border-zinc-800 hover:bg-zinc-800/70 p-3 transition"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={item.profilePhoto} />
                    <AvatarFallback>
                      {item.username?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-medium text-sm">
                      {item.username}
                    </p>
                    {item.bio && (
                      <p className="text-xs text-zinc-400 line-clamp-1">
                        {item.bio}
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-500">
                      {item.stats?.followersCount || 0} followers ·{" "}
                      {item.stats?.followingCount || 0} following
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-black hover:text-white bg-zinc-200 hover:bg-zinc-600"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Follow
                </Button>
              </div>
            ))}
          </div>

          {pagination?.hasMore && (
            <div className="flex justify-center pt-3">
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
                className="text-white border-zinc-700"
              >
                Load more
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileTab;
