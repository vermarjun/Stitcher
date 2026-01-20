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
        const res = await api.get<any>("/leaderboard/top");
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
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
      
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
        <h3 className="font-bold text-white text-lg tracking-tight flex items-center gap-2">
          🏆 Leaderboard
        </h3>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full bg-zinc-900" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24 bg-zinc-900" />
                <Skeleton className="h-2 w-16 bg-zinc-900" />
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
                <img src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1761962346/pngimg.com_-_golden_cup_PNG94601_jte7zy.png" className="h-4 w-auto drop-shadow-md" alt="1st" />
              ) : rank === 2 ? (
                <img src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1761962347/Second_Place_Medal_Badge_Clipart_Image-removebg-preview_p7yodv.png" className="h-4 w-auto drop-shadow-md" alt="2nd" />
              ) : rank === 3 ? (
                <img src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1761962350/225-2252470_third-place-medal-badge-clipart-image-emblem-hd.png-removebg-preview_xpt8px.png" className="h-4 w-auto drop-shadow-md" alt="3rd" />
              ) : null;

            return (
              <div
                onClick={() => handleViewProfile(user)}
                key={user._id}
                className="px-5 py-3.5 flex items-center gap-4 cursor-pointer 
                hover:bg-zinc-900/50 transition-all border-b border-zinc-800/50 last:border-none group"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={user.profilePhoto || "https://www.gravatar.com/avatar/?d=mp"}
                    alt={user.username}
                    className="h-11 w-11 rounded-full border border-zinc-800 object-cover ring-2 ring-transparent group-hover:ring-zinc-800 transition-all"
                  />
                  {rank <= 3 && (
                    <div className="absolute -top-1.5 -right-1.5 bg-zinc-900 border border-zinc-800 rounded-full p-1 shadow-sm">
                      {rankIcon}
                    </div>
                  )}
                  {rank > 3 && (
                    <div className="absolute -bottom-1 -right-1 bg-zinc-900 border border-zinc-800 rounded-full h-5 w-5 flex items-center justify-center text-[9px] font-bold text-zinc-500">
                        {rank}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                      {user.username}
                    </p>
                    <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/10">
                      {user.aura} Aura
                    </span>
                  </div>

                  <div className="flex gap-3 text-xs text-zinc-500 font-medium">
                    <span className="flex items-center gap-1">
                        <span className="text-zinc-300">{user.stats?.totalLikes || 0}</span> Likes
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="text-zinc-300">{user.stats?.totalViews || 0}</span> Views
                    </span>
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
