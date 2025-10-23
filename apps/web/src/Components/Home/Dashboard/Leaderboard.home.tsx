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
  stats?: {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    totalViews: number;
    lastUpdated: string;
  };
}

type TimeFilter = "week" | "alltime";

const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");

  useEffect(() => {
    fetchLeaderboard();
  }, [timeFilter]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/leaderboard/top", {
        params: { limit: 5 },
      });
      if (response.data.success) setUsers(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const getInitials = (username: string) => username.charAt(0).toUpperCase();

  const trophyColors = [
    "from-yellow-400 to-amber-500",
    "from-zinc-400 to-gray-500",
    "from-amber-600 to-orange-700",
  ];

  if (loading)
    return (
      <div className="flex justify-center items-center h-40 text-zinc-400 animate-pulse">
        Loading leaderboard...
      </div>
    );

  if (error)
    return (
      <div className="text-red-400 text-sm bg-red-900/20 border border-red-700/30 p-3 rounded-lg">
        {error}
      </div>
    );

  const sorted = [...users].sort((a, b) => b.aura - a.aura);
  const topThree = sorted.slice(0, 3);
  const nextTwo = sorted.slice(3, 5);

  return (
    <div className="mb-10 text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white bg-clip-text">
            Leaderboard
          </h2>
          <p className="text-zinc-500 text-xs">Top creators by aura</p>
        </div>
        <div className="flex gap-2">
          {["week", "alltime"].map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t as TimeFilter)}
              className={`px-4 py-1.5 text-xs rounded-full transition-all border ${
                timeFilter === t
                  ? "bg-green-500/10 border-green-400/40 text-green-300 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                  : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
              }`}
            >
              {t === "week" ? "This Week" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 🥇 Top 3 */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((user, i) => (
            <div
              key={user._id}
              className={`relative rounded-xl p-5 bg-zinc-900/60 border border-zinc-800 backdrop-blur-md transition-all hover:scale-[1.03] hover:border-green-500/40 group shadow-[0_0_20px_rgba(34,197,94,0.1)]`}
            >
              {/* Glow accent */}
              <div
                className={`absolute inset-0 rounded-xl bg-gradient-to-br ${trophyColors[i]} opacity-10 blur-xl group-hover:opacity-20 transition-opacity`}
              ></div>

              {/* Trophy icon */}
              <div className="absolute bottom-3 right-3 text-3xl">
                {i === 0 ? "🏆" : i === 1 ? "🥈" : "🥉"}
              </div>
              {/* HASHTAG */}
              <div className="absolute font-bold -top-2 -right-2 z-20 text-3xl bg-transparent rounded-full p-4">
                #{i === 0 ? "1" : i === 1 ? "2" : "3"}
              </div>

              <div className="flex items-center gap-4 mb-3 relative z-10">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-zinc-700 shadow-md">
                  {user.profilePhoto ? (
                    <img
                      src={user.profilePhoto}
                      alt={user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-lg font-bold">
                      {getInitials(user.username)}
                    </div>
                  )}
                  {i === 0 && (
                    <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{user.username}</h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {user.bio || "No bio"}
                  </p>
                </div>
              </div>

              <p className="text-green-400 font-semibold text-lg mb-2 relative z-10">
                {formatNumber(user.aura)} Aura
              </p>

              {user.stats && (
                <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 text-xs relative z-10">
                  <div>
                    <p className="text-zinc-500">Posts</p>
                    <p>{user.stats.totalPosts}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Likes</p>
                    <p>{user.stats.totalLikes}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Views</p>
                    <p>{formatNumber(user.stats.totalViews)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Comments</p>
                    <p>{user.stats.totalComments}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 🏅 Next Two */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {nextTwo.map((user, i) => (
            <div
              key={user._id}
              className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-green-500/40 transition-all hover:scale-[1.02] backdrop-blur-md shadow-[0_0_15px_rgba(34,197,94,0.1)]"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-700">
                {user.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center font-bold text-white">
                    {getInitials(user.username)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium truncate">{user.username}</h3>
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                    #{i + 4}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  {user.bio || "No bio"}
                </p>
                <p className="text-green-400 font-semibold text-sm mt-1">
                  {formatNumber(user.aura)} Aura
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* THE CURRENT USER */}
      <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-green-500/40 transition-all hover:scale-[1.02] backdrop-blur-md shadow-[0_0_15px_rgba(34,197,94,0.1)]">
        <div className="w-fit h-fit bg-zinc-800 flex items-center justify-center font-bold text-white">
          {getInitials("user.username")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <h3 className="font-medium truncate">{"user.username"}</h3>
            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
              #{"i + 4"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 truncate">{"No bio"}</p>
          <p className="text-green-400 font-semibold text-sm mt-1">
            {formatNumber(10)} Aura
          </p>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
