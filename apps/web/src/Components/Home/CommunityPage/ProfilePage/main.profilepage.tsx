import { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import ProfileHeader from "./header.profilepage";
import PostsTab from "./poststab.profilepage";
import type { IUser, IUserStats } from "@/State/Types";
import api from "@/api";
import LikesTab from "./likesTab.profilepage";
import CommentsTab from "./commentTab.profilepage";
import type { ICommunityPost } from "../main.communitypage";

type Props = {
  profile: IUser;
  currentUser?: IUser;
  onBack: () => void;
  onPostClick: (post: ICommunityPost) => void;
};

function SkeletonProfilePage() {
  return (
    <div className="min-h-screen w-full bg-black text-white animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg w-full border-b border-zinc-800 flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 bg-neutral-800 rounded-full" />
        <div>
          <div className="h-4 w-24 bg-neutral-800 rounded mb-2" />
          <div className="h-3 w-16 bg-neutral-800 rounded" />
        </div>
      </div>

      {/* Banner */}
      <div className="relative">
        <div className="h-48 w-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 rounded-b-2xl" />
        <div className="absolute left-4 -bottom-16">
          <div className="w-32 h-32 rounded-full bg-neutral-800 ring-4 ring-black shadow-xl" />
        </div>
      </div>

      {/* Profile content */}
      <div className="mt-20 px-4 space-y-4">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-32 bg-neutral-800 rounded" />
          <div className="h-4 w-20 bg-neutral-800 rounded" />
        </div>

        {/* Bio */}
        <div className="space-y-2 mt-3">
          <div className="h-3 w-3/4 bg-neutral-800 rounded" />
          <div className="h-3 w-2/3 bg-neutral-800 rounded" />
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-4">
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-4 w-20 bg-neutral-800 rounded" />
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-800 mt-6 flex justify-around">
          {["Posts", "Likes", "Replies"].map((t) => (
            <div key={t} className="h-5 w-12 bg-neutral-800 rounded mb-2" />
          ))}
        </div>

        {/* Posts skeleton (reuse from PostTab style) */}
        <div className="flex flex-col divide-y divide-neutral-800 mt-4">
          {[...Array(3)].map((_, i) => (
            <article
              key={i}
              className="px-5 py-4 transition-colors duration-200"
            >
              <div className="flex items-start gap-3">
                {/* Profile Picture */}
                <div className="w-10 h-10 rounded-full bg-neutral-800" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-24 bg-neutral-800 rounded" />
                    <div className="h-3 w-10 bg-neutral-800 rounded" />
                  </div>
                  <div className="h-4 w-3/4 bg-neutral-800 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-800 rounded" />
                  <div className="mt-3 w-full aspect-video bg-neutral-900 rounded-2xl border border-zinc-700" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({
  profile,
  currentUser,
  onBack,
  onPostClick
}: Props) {
  const [user, setUser] = useState<IUser>(profile);
  const [loading, setLoading] = useState<boolean>(!profile);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "likes" | "comments" | "about">("posts");
  const [rank, setRank] = useState<number | null>(null);

  const userId = profile._id;

  const toggleFollow = useCallback(async () => {
    if (!currentUser || !user) return;
    
    setFollowLoading(true);
    const originalFollowing = isFollowing;
    setIsFollowing(!originalFollowing);

    try {
      if (originalFollowing) {
        // FIXED: Changed from GET to DELETE to match backend
        await api.delete(`/users/${user._id}/unfollow`);
        setUser((u) =>
          u
            ? ({
                ...u,
                stats: {
                  ...(u.stats ?? ({} as IUserStats)),
                  followersCount:
                    (u.stats?.followersCount ?? u.followers?.length ?? 1) - 1,
                },
                followers: u.followers?.filter((f) => f !== currentUser._id),
              } as IUser)
            : u
        );
      } else {
        // FIXED: Changed from GET to POST to match backend
        await api.post(`/users/${user._id}/follow`);
        setUser((u) =>
          u
            ? ({
                ...u,
                stats: {
                  ...(u.stats ?? ({} as IUserStats)),
                  followersCount:
                    (u.stats?.followersCount ?? u.followers?.length ?? 0) + 1,
                },
                followers: [...(u.followers ?? []), currentUser._id],
              } as IUser)
            : u
        );
      }
    } catch (err) {
      console.error("follow toggle failed", err);
      setIsFollowing(originalFollowing);
    } finally {
      setFollowLoading(false);
    }
  }, [currentUser, user, isFollowing]);

  const fetchProfile = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const profileRes = await api.get<IUser>(`/users/${userId}/profile`);
      const profileData: IUser = profileRes.data;
      const rankRes = await api.get<{ success: boolean; rank: number }>(`/leaderboard/user/${userId}/rank`);
      setUser(profileData);
      setRank(rankRes?.data?.rank ?? null);
      setIsFollowing(
        Boolean(currentUser && profileData.followers?.includes(currentUser._id))
      );
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const formattedJoinDate = useMemo(() => {
    if (!user?.createdAt) return "-";
    const d = new Date(user.createdAt);
    return `Joined ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  }, [user?.createdAt]);

  const handleTabChange = useCallback((tab: "posts" | "likes" | "comments" | "about") => {
    setActiveTab(tab);
  }, []);

  if (loading) return <SkeletonProfilePage />;

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xl font-semibold">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-black text-white pb-8">
      {/* Header */}
      <div className="sticky h-14 top-0 z-10 bg-black/80 backdrop-blur-lg w-full border-b border-zinc-800 flex items-center gap-3 px-4 py-3">
        <button onClick={onBack} className="hover:bg-zinc-800 rounded-full p-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex justify-center items-center gap-3">
          <h2 className="text-lg font-semibold">{user.username}</h2>
        </div>
      </div>

      {/* Profile Header */}
      <ProfileHeader
        user={user}
        currentUser={currentUser}
        isFollowing={isFollowing}
        followLoading={followLoading}
        rank={rank}
        formattedJoinDate={formattedJoinDate}
        onFollowToggle={toggleFollow}
      />

      {/* Tabs */}
      <div className="px-5 mt-4">
        <div className="border-b border-zinc-800">
          <nav className="flex justify-start gap-8">
            <TabButton
              active={activeTab === "posts"}
              onClick={() => handleTabChange("posts")}
              label="Posts"
              count={user.stats?.totalPosts}
            />
            <TabButton
              active={activeTab === "likes"}
              onClick={() => handleTabChange("likes")}
              label="Likes"
              count={user.stats?.totalLikes}
            />
            <TabButton
              active={activeTab === "comments"}
              onClick={() => handleTabChange("comments")}
              label="Replies"
              count={user.stats?.totalComments}
            />
          </nav>
        </div>
      </div>

      {/* Dynamic Tab */}
      <div className="mt-2 text-zinc-200">
        {activeTab === "posts" && <PostsTab onPostClick={onPostClick} userId={user._id} />}
        {activeTab === "likes" && <LikesTab onPostClick={onPostClick} userId={user._id} />}
        {activeTab === "comments" && <CommentsTab userId={user._id} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-4 transition-all relative flex items-center gap-2 ${
        active ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <span className="text-sm">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-xs ${active ? "text-zinc-400" : "text-zinc-600"}`}>
            {count}
        </span>
      )}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 rounded-t-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
      )}
    </button>
  );
}