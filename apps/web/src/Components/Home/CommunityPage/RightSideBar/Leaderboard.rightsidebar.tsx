"use client";

import { useEffect, useState } from "react";
import { Trophy, Crown, Star, Sparkles, MessageCircle, Heart, Eye } from "lucide-react";
import api  from "@/api";
import { Skeleton } from "@/Components/ui/skeleton";
import type { IAuthor } from "../main.communitypage";

interface LeaderboardUser {
  _id: string;
  username: string;
  profilePhoto: string;
  aura: number;
  stats: {
    totalPosts: number;
    totalLikes: number;
    totalViews: number;
  };
}

interface Props {
    onProfileClick: (user: IAuthor) => void;
    onBack: () => void;
}

const Leaderboard = ({onProfileClick, onBack}:Props) => {
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get("/leaderboard/top");
        if (res.data?.success) {
          setData(res.data.data);
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const handleViewProfile = (user: IAuthor) => {
    onBack();
    onProfileClick(user);
  }

  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h3 className="font-bold text-lg text-white">Top Creators</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((user, index) => {
            const rank = index + 1;

            const rankIcon =
              rank === 1 ? (
                <Crown className="h-3.5 w-3.5 text-yellow-500" />
              ) : rank === 2 ? (
                <Star className="h-3.5 w-3.5 text-gray-400" />
              ) : rank === 3 ? (
                <Star className="h-3.5 w-3.5 text-amber-700" />
              ) : null;

            return (
              <div
              onClick={() => handleViewProfile(user)}
                key={user._id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-800/40 transition-all duration-150 cursor-pointer"
              >
                {/* Avatar + Rank */}
                <div className="relative">
                  <img
                    src={user.profilePhoto || "https://www.gravatar.com/avatar/?d=mp"}
                    alt={user.username}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  {rank <= 3 && (
                    <div className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-0.5">
                      {rankIcon}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-white truncate">
                      {user.username}
                    </p>
                    <p className="text-xs text-zinc-500 font-semibold">#{rank}</p>
                  </div>
                  <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-yellow-400" />
                    {user.aura} Aura
                  </p>

                  {/* User Stats (Posts, Likes, Views) */}
                  <div className="flex gap-3 mt-1 text-xs text-zinc-500">
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {user.stats.totalPosts}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {user.stats.totalLikes}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {user.stats.totalViews}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
