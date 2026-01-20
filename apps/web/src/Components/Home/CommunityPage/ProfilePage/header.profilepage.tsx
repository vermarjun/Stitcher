import { Calendar, Check, Loader2 } from "lucide-react";
import type { IUser } from "@/State/Types";

function ProfileHeader({
  user,
  currentUser,
  isFollowing,
  followLoading,
  rank,
  formattedJoinDate,
  onFollowToggle,
}: {
  user: IUser;
  currentUser?: IUser;
  isFollowing: boolean;
  followLoading: boolean;
  rank: number | null;
  formattedJoinDate: string;
  onFollowToggle: () => void;
}) {
  return (
    <div className="w-full text-white">
      {/* Cover Photo */}
      <div className="relative">
        <div
            className="w-full h-44 md:h-60 bg-zinc-900 border-b border-zinc-800"
            style={{
              backgroundImage: user?.profileBanner
                ? `url(${user.profileBanner})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        
        {/* Profile Image */}
        <div className="absolute left-6 -bottom-16">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full p-1 bg-black ring-1 ring-zinc-800">
                <img
                src={user.profilePhoto || "https://www.gravatar.com/avatar/?d=mp"}
                alt={`${user.username} avatar`}
                className="w-full h-full rounded-full object-cover transition-transform duration-300 group-hover:scale-105 bg-zinc-900"
                />
            </div>
            {/* <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition pointer-events-none" /> */}
          </div>
        </div>

        {/* Follow Button */}
        {currentUser?._id !== user._id && (
          <div className="absolute right-6 -bottom-12 md:-bottom-14">
            <button
              onClick={onFollowToggle}
              disabled={followLoading}
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-semibold text-sm transition-all duration-300 shadow-lg ${
                isFollowing
                  ? "bg-black border border-zinc-700 text-white hover:border-red-500/50 hover:text-red-400"
                  : "bg-white text-black hover:bg-zinc-200"
              }`}
            >
              {followLoading ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : isFollowing ? (
                <Check className="w-4 h-4" />
              ) : null}
              {followLoading
                ? "Loading..."
                : isFollowing
                ? "Following"
                : "Follow"}
            </button>
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div className="mt-20 px-6 space-y-4 animate-fadeIn pb-2">
        {/* Username + Aura */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">{user.username}</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-medium text-emerald-400">
                <span>⚡️</span>
                {user.aura ?? 0} Aura
              </div>
            </div>
            <div className="text-zinc-500 font-medium">@{user.username?.toLowerCase()}</div>
          </div>

          {/* Rank */}
          {rank !== null && (
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-sm text-zinc-400">
               <span>🏆</span>
               <span className="font-semibold text-white">#{rank}</span> 
               <span>Global Rank</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {user.bio && (
            <p className="text-zinc-300 max-w-2xl whitespace-pre-wrap leading-relaxed text-[15px]">
            {user.bio}
            </p>
        )}

        {/* Joined Date & Stats */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-zinc-500 pt-1">
            <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formattedJoinDate}</span>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1">
                    <span className="font-bold text-white text-lg">
                    {user.stats?.followingCount ?? user.following?.length ?? 0}
                    </span>{" "}
                    <span>Following</span>
                </div>
                <div className="hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1">
                    <span className="font-bold text-white text-lg">
                    {user.stats?.followersCount ?? user.followers?.length ?? 0}
                    </span>{" "}
                    <span>Followers</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;
