import { useEffect, useState } from "react";
import api from "@/api";

interface SuggestedUser {
  _id: string;
  username: string;
  profilePhoto: string;
  bio?: string;
  plan?: string;
  stats: {
    followersCount: number;
    followingCount: number;
  };
  isFollowing?: boolean;
}

const SuggestedCreators = () => {
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSuggestedUsers = async () => {
      try {
        setLoading(true);
        const res = await api.get("/users/suggestions");
        if (res.data.success) {
          setUsers(res.data.suggestions);
        } else {
          throw new Error("Cannot fetch users");
        }
      } catch (err) {
        console.error("Error fetching suggested users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestedUsers();
  }, []);

  const handleFollowToggle = async (userId: string, isFollowing: boolean) => {
    try {
      if (isFollowing) {
        await api.delete(`/users/${userId}/unfollow`);
      } else {
        await api.post(`/users/${userId}/follow`);
      }

      // Optimistic UI update
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId ? { ...u, isFollowing: !isFollowing } : u
        )
      );
    } catch (err) {
      console.error(
        `Failed to ${isFollowing ? "unfollow" : "follow"} user:`,
        err
      );
    }
  };

  // 💫 Skeleton loader for smooth UX
  const Skeleton = () => (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-2 rounded-lg border border-transparent"
        >
          <div className="h-10 w-10 rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-zinc-800 rounded" />
            <div className="h-2 w-2/3 bg-zinc-800 rounded" />
            <div className="h-2 w-1/4 bg-zinc-800 rounded" />
          </div>
          <div className="h-6 w-16 rounded-full bg-zinc-800" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-bold text-lg">✨ Suggested for you</h3>
      </div>

      {loading ? (
        <Skeleton />
      ) : users.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center">
          No suggestions available
        </p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user._id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              <img
                src={user.profilePhoto}
                alt={user.username}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate flex items-center gap-1">
                  {user.username}
                  {user.plan === "pro" && (
                    <span className="text-blue-500">✓</span>
                  )}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {user.bio || "No bio"}
                </p>
                <p className="text-xs text-zinc-600">
                  {user.stats.followersCount} followers
                </p>
              </div>
              <button
                onClick={() =>
                  handleFollowToggle(user._id, user.isFollowing ?? false)
                }
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  user.isFollowing
                    ? "bg-transparent border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                    : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                {user.isFollowing ? "Unfollow" : "Follow"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestedCreators;
