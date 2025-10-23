import React, { useState, useEffect } from "react";
import { Crown } from "lucide-react";
import api from "@/api"; 

interface LeaderboardUser {
  _id: string;
  username: string;
  profilePhoto?: string;
  aura: number;
  bio?: string;
  rank?: number;
}

type TimeFilter = "week" | "alltime";

// Skeleton Loader Component
const LeaderboardSkeleton: React.FC = () => {
  return (
    <div className="mb-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-6 w-40 bg-zinc-700 rounded mb-2"></div>
          <div className="h-4 w-56 bg-zinc-700 rounded"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-zinc-700 rounded-full"></div>
          <div className="h-8 w-20 bg-zinc-700 rounded-full"></div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Top 3 Cards Skeleton */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-full rounded-md p-4 border border-zinc-700 bg-zinc-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-zinc-700"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-4 w-24 bg-zinc-700 rounded"></div>
                      <div className="h-5 w-8 bg-zinc-700 rounded"></div>
                    </div>
                    <div className="h-3 w-32 bg-zinc-700 rounded mb-3"></div>
                    <div className="h-4 w-20 bg-zinc-700 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next 2 Cards Skeleton */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-20 bg-zinc-800/50 rounded-md p-2 border border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-zinc-700"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-4 w-20 bg-zinc-700 rounded"></div>
                      <div className="h-5 w-8 bg-zinc-700 rounded"></div>
                    </div>
                    <div className="h-3 w-28 bg-zinc-700 rounded mb-2"></div>
                    <div className="h-4 w-16 bg-zinc-700 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [, setCurrentUser] = useState<LeaderboardUser | null>(null);
  const [, setCurrentUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");

  useEffect(() => {
    fetchLeaderboard();
    fetchMyRank();
  }, [timeFilter]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch top 6 users for the leaderboard display
      const response = await api.get("/leaderboard/top", {
        params: { limit: 5 },
      });

      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      setError(err.response?.data?.error || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRank = async () => {
    try {
      const response = await api.get("/leaderboard/my-rank");

      if (response.data.success) {
        const { user, rank } = response.data.data;
        setCurrentUser(user);
        setCurrentUserRank(rank);
      }
    } catch (err: any) {
      console.error("Error fetching user rank:", err);
      // Don't set error here to avoid breaking the main leaderboard display
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const getInitials = (username: string) => {
    return username.charAt(0).toUpperCase();
  };
  // Show skeleton during initial load and when time filter changes
  if (loading) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className="mb-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchLeaderboard}
            className="mt-2 px-4 py-2 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const sortedUsers = [...users].sort((a, b) => b.aura - a.aura);
  const topThree = sortedUsers.slice(0, 3);
  const nextTwo = sortedUsers.slice(3, 5);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Leaderboard</h2>
          <p className="text-sm text-zinc-400">
            Community members with most aura
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeFilter("week")}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              timeFilter === "week"
                ? "bg-zinc-800 text-white border-zinc-700"
                : "hover:bg-zinc-800 text-zinc-400 border-transparent"
            }`}
          >
            This week
          </button>
          <button
            onClick={() => setTimeFilter("alltime")}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              timeFilter === "alltime"
                ? "bg-zinc-800 text-white border-zinc-700"
                : "hover:bg-zinc-800 text-zinc-400 border-transparent"
            }`}
          >
            All time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Right side - Top 3 vertical cards */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {topThree.map((user, index) => (
              <div
                key={user._id}
                className={`h-full rounded-md p-4 border transition-all hover:scale-105 ${
                  index === 0
                    ? "bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border-yellow-500/30"
                    : index === 1
                    ? "bg-gradient-to-br from-zinc-400/10 to-zinc-300/5 border-zinc-400/30"
                    : "bg-gradient-to-br from-amber-700/10 to-amber-600/5 border-amber-700/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
                      {user.profilePhoto ? (
                        <img
                          src={user.profilePhoto}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-white">
                          {getInitials(user.username)}
                        </div>
                      )}
                    </div>
                    {index === 0 && (
                      <div className="absolute -top-1 -right-1">
                        <Crown className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold text-sm truncate">
                        {user.username}
                      </h3>
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          index === 0
                            ? "bg-yellow-500 text-black"
                            : index === 1
                            ? "bg-zinc-400 text-black"
                            : "bg-amber-700 text-white"
                        }`}
                      >
                        #{index + 1}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-xs truncate">
                      {user.bio || "No bio"}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white font-bold text-sm">
                        {formatNumber(user.aura)} aura
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Left side - Next top 2 horizontal cards */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            {nextTwo.map((user, index) => (
              <div
                key={user._id}
                className="h-20 bg-zinc-900 rounded-md p-2 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-600">
                      {user.profilePhoto ? (
                        <img
                          src={user.profilePhoto}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-white font-bold">
                          {getInitials(user.username)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold truncate text-sm">
                        {user.username}
                      </h3>
                      <span className="text-xs font-bold bg-zinc-700 text-white px-1.5 py-0.5 rounded">
                        #{index + 4}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-xs truncate">
                      {user.bio || "No bio"}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-white font-bold text-sm">
                        {formatNumber(user.aura)} aura
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;