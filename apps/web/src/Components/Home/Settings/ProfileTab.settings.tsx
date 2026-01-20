import React, { useEffect, useState } from "react";
import { Mail, Save, Calendar, UserPlus, Camera } from "lucide-react";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
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
    ? format(new Date(user.createdAt), "PPP")
    : "";

  return (
    <div className="space-y-8">
      {/* Banner & Header Card */}
      <div className="relative group rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="relative h-48 md:h-64 w-full bg-zinc-800 overflow-hidden">
          {user?.profileBanner ? (
            <img 
              src={user.profileBanner} 
              alt="Banner" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
          )}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
          
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border border-white/10"
            onClick={() => document.getElementById("banner-upload")?.click()}
          >
            <Camera className="h-4 w-4 mr-2" />
            Edit Banner
          </Button>
          <input
            id="banner-upload"
            type="file"
            accept="image/*"
            onChange={handleProfileBannerUpload}
            className="hidden"
          />
        </div>

        <div className="px-6 md:px-10 pb-6 relative">
          <div className="flex flex-col md:flex-row items-start md:items-end -mt-12 md:-mt-16 mb-4 gap-4 md:gap-6">
            <div className="flex items-end gap-5">
              <div className="relative group/avatar">
                <Avatar className="h-28 w-28 md:h-36 md:w-36 border-4 border-zinc-900 shadow-xl ring-2 ring-zinc-800">
                  <AvatarImage
                    src={user?.profilePhoto}
                    alt="Profile"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 text-white text-3xl font-bold">
                    {user?.username?.charAt(0)?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div 
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => document.getElementById("profilephoto-upload")?.click()}
                >
                  <Camera className="h-8 w-8 text-white/80" />
                </div>
                <input
                  id="profilephoto-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  className="hidden"
                />
              </div>
              <h2 className="md:hidden text-2xl font-bold text-white tracking-tight mb-4">{user?.username}</h2>
            </div>
            
            <div className="flex-1 mb-2 w-full">
              <h2 className="hidden md:block text-3xl font-bold text-white tracking-tight">{user?.username}</h2>
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-zinc-400 mt-1 text-sm">
                <span className="flex items-center gap-1.5">
                   <Mail className="h-3.5 w-3.5" />
                   {user?.email}
                </span>
                <span className="hidden md:block w-1 h-1 rounded-full bg-zinc-600" />
                <span className="flex items-center gap-1.5">
                   <Calendar className="h-3.5 w-3.5" />
                   Joined {createdAtDisplay}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mb-3 w-full md:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 md:flex-none border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => handleOpenModal("followers")}
              >
                <span className="font-bold text-white mr-1.5">{followersCount}</span> Followers
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 md:flex-none border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => handleOpenModal("following")}
              >
                 <span className="font-bold text-white mr-1.5">{followingCount}</span> Following
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Posts", value: user?.stats?.totalPosts ?? 0 },
          { label: "Total Likes", value: user?.stats?.totalLikes ?? 0 },
          { label: "Comments", value: user?.stats?.totalComments ?? 0 },
          { label: "Total Views", value: user?.stats?.totalViews ?? 0 },
        ].map((stat, i) => (
          <Card key={i} className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-xs text-zinc-500 uppercase tracking-widest">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Form */}
      <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 border-b border-zinc-800">
            <h3 className="text-lg font-semibold text-white">Profile Information</h3>
            <p className="text-sm text-zinc-400">Update your account details and public profile.</p>
          </div>
          
          <form onSubmit={handleProfileUpdate} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-zinc-300">Username</Label>
                {formData && (
                  <Input
                    id="username"
                    value={formData.username || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="bg-zinc-950 border-zinc-800 text-white focus:ring-blue-500/20 focus:border-blue-500/50"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">Email Address</Label>
                {formData && (
                  <Input
                    id="email"
                    value={formData.email || ""}
                    disabled
                    className="bg-zinc-950/50 border-zinc-900 text-zinc-500 cursor-not-allowed"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-zinc-300">Bio</Label>
              {formData && (
                <Textarea
                  id="bio"
                  value={formData.bio || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  className="bg-zinc-950 border-zinc-800 text-white min-h-[120px] focus:ring-blue-500/20 focus:border-blue-500/50 resize-none"
                  placeholder="Tell us a bit about yourself..."
                />
              )}
              <p className="text-xs text-zinc-500 text-right">
                {(formData?.bio?.length || 0)}/500 characters
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="bg-white text-black hover:bg-zinc-200 min-w-[120px]"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Followers / Following Modal */}
      <Dialog open={!!modalOpen} onOpenChange={() => setModalOpen(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md p-0 overflow-hidden gap-0">
          <DialogHeader className="p-4 border-b border-zinc-800">
            <DialogTitle className="text-white capitalize text-center text-lg">
              {modalOpen}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {listLoading && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {!listLoading && listData.length === 0 && (
              <div className="py-12 text-center text-zinc-500">
                <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No {modalOpen} found</p>
              </div>
            )}

            <div className="space-y-1">
              {listData.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-zinc-800">
                      <AvatarImage src={item.profilePhoto} />
                      <AvatarFallback className="bg-zinc-900 text-zinc-500">
                        {item.username?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors">
                        {item.username}
                      </p>
                      {item.bio && (
                        <p className="text-xs text-zinc-500 line-clamp-1 max-w-[180px]">
                          {item.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>

            {pagination?.hasMore && (
              <div className="p-4 flex justify-center">
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
                  className="w-full border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white"
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
