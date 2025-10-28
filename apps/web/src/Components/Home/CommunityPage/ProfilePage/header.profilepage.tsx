import { Calendar, Check, Loader2 } from "lucide-react";
import type { IUser } from "./main.profilepage";
import type { User as ICurrentUser } from "@/State/Types";

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
  currentUser?: ICurrentUser | null;
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
        <div className="h-48 w-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 rounded-b-2xl animate-gradient-x" />

        {/* Profile Image */}
        <div className="absolute left-6 -bottom-16">
          <div className="relative group">
            <img
              src={user.profilePhoto || "https://www.gravatar.com/avatar/?d=mp"}
              alt={`${user.username} avatar`}
              className="w-32 h-32 rounded-full ring-4 ring-black object-cover shadow-2xl transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 rounded-full bg-white/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition" />
          </div>
        </div>

        {/* Follow Button */}
        {currentUser?.id !== user._id && (
          <div className="absolute right-6 top-40">
            <button
              onClick={onFollowToggle}
              disabled={followLoading}
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-semibold text-sm transition-all duration-300 ${
                isFollowing
                  ? "border border-white/30 bg-transparent hover:bg-red-900/20 hover:text-red-400"
                  : "bg-white text-black hover:bg-white/90"
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
      <div className="mt-20 px-6 space-y-3 animate-fadeIn">
        {/* Username + Aura */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{user.username}</h1>
              <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-xs font-semibold text-black">
                <div className="w-2 h-2 bg-white rounded-full" />
                {user.aura ?? 0} AURA
              </div>
            </div>
            <div className="text-neutral-400">@{user.username?.toLowerCase()}</div>
          </div>

          {/* Rank */}
          {rank !== null && (
            <div className="mt-2 sm:mt-0 bg-white/10 px-3 py-1.5 rounded-full text-sm text-neutral-300 flex items-center gap-1">
              <span className="font-semibold text-white">#{rank}</span> Rank
            </div>
          )}
        </div>

        {/* Bio */}
        <p className="text-neutral-300 max-w-prose whitespace-pre-wrap leading-relaxed">
          {user.bio || "Hey, I haven't written a bio yet."}
        </p>

        {/* Joined Date */}
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Calendar className="w-4 h-4" />
          <span>{formattedJoinDate}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm pt-2">
          <div className="hover:underline cursor-pointer">
            <span className="font-semibold text-white">
              {user.stats?.followingCount ?? user.following?.length ?? 0}
            </span>{" "}
            <span className="text-neutral-400">Following</span>
          </div>
          <div className="hover:underline cursor-pointer">
            <span className="font-semibold text-white">
              {user.stats?.followersCount ?? user.followers?.length ?? 0}
            </span>{" "}
            <span className="text-neutral-400">Followers</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;
