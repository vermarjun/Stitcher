import { useEffect, useState } from "react";
import api from "@/api";
import { Skeleton } from "@/Components/ui/skeleton";
import type { IUser } from "@/State/Types";

interface Props {
  onProfileClick: (user: IUser) => void;
  onBack: () => void;
}

const Leaderboard = ({ onProfileClick, onBack }: Props) => {
  const [data, setData] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get("/leaderboard/top");
        if (res.data?.success) setData(res.data.data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const handleViewProfile = (user: IUser) => {
    onBack();
    onProfileClick(user);
  };

  return (
    <div className="bg-[#0B0D0F] border border-zinc-800 rounded-xl overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <h3 className="font-semibold text-white text-lg tracking-tight">
          🏆 Leaderboard
        </h3>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {data.map((user, index) => {
            const rank = index + 1;

            const rankIcon =
              rank === 1 ? (
                <img src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1761962346/pngimg.com_-_golden_cup_PNG94601_jte7zy.png" className="h-5 bg-transparent" alt="" />
              ) : rank === 2 ? (
                <img src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1761962347/Second_Place_Medal_Badge_Clipart_Image-removebg-preview_p7yodv.png" className="h-5 bg-transparent" alt="" />
              ) : rank === 3 ? (
                <img src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1761962350/225-2252470_third-place-medal-badge-clipart-image-emblem-hd.png-removebg-preview_xpt8px.png" className="h-5 bg-transparent" alt="" />
              ) : null;

            return (
              <div
                onClick={() => handleViewProfile(user)}
                key={user._id}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer 
                hover:bg-[#111315] transition-all border-b border-zinc-800 last:border-none"
              >
                {/* Avatar */}
                <div className="relative">
                  <img
                    src={user.profilePhoto || "https://www.gravatar.com/avatar/?d=mp"}
                    alt={user.username}
                    className="h-12 w-12 rounded-full border border-zinc-700 object-cover"
                  />
                  {rank <= 3 && (
                    <div className="absolute -top-1 -right-1 bg-[#0B0D0F] border border-zinc-700 rounded-full p-0.5">
                      {rankIcon}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white truncate">
                      {user.username}
                    </p>
                    <span className="text-xs text-zinc-500 font-medium">
                      #{rank}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-400 font-medium mt-0.5">
                    {user.aura} Aura
                  </p>

                  <div className="flex gap-4 text-xs text-zinc-500 mt-1">
                    <span>{user.stats?.totalPosts} Posts</span>
                    <span>{user.stats?.totalLikes} Likes</span>
                    <span>{user.stats?.totalViews} Views</span>
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
