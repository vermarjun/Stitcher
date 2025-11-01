import { TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/Components/ui/skeleton";
import PostCard from "./PostCard.communitypage";
import type { ICommunityPost } from "./main.communitypage";
import type { IUser } from "@/State/Types";

export interface IAsset {
  _id: string;
  name: string;
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
}

export interface IComment {
  _id: string;
  userId: IUser;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  likes: string[];
  isLiked?: boolean;
  parentCommentId?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface FeedProps {
  posts: ICommunityPost[];
  loading: boolean;
  feedType: "trending" | "following";
  setFeedType: (type: "trending" | "following") => void;
  hasMore: boolean;
  lastPostRef?: React.RefObject<HTMLDivElement> | null;
  formatCount: (count: number) => string;
  currentUser?: IUser;
  onPostClick: (post: ICommunityPost) => void;
  onProfileClick: (user: IUser) => void;
}

const Feed = ({
  posts,
  loading,
  feedType,
  setFeedType,
  hasMore,
  lastPostRef,
  formatCount,
  currentUser,
  onPostClick,
  onProfileClick,
}: FeedProps) => {
  const renderSkeleton = () => (
    <div className="grid grid-cols-1 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-transparent p-4 border-b border-zinc-800">
          <Skeleton className="w-full aspect-video bg-zinc-800 rounded-xl mb-3" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full bg-zinc-800" />
              <Skeleton className="h-3 w-24 bg-zinc-800 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full bg-zinc-800 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex-1 justify-center min-w-0 w-full">
      {/* Feed Type Selector */}
      <div className="sticky top-0 z-10 backdrop-blur-sm bg-black/80 mb-6 border-b border-zinc-800 h-14">
        <div className="flex gap-0">
          <button
            onClick={() => setFeedType("trending")}
            className={`flex-1 py-4 px-4 font-semibold text-sm transition-colors relative ${
              feedType === "trending"
                ? "text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trending
            </div>
            {feedType === "trending" && (
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-[#02684D] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setFeedType("following")}
            className={`flex-1 py-3 px-4 font-semibold text-sm transition-colors relative ${
              feedType === "following"
                ? "text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="h-4 w-4" />
              Following
            </div>
            {feedType === "following" && (
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-[#02684D] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {(loading && posts.length === 0) ? (
        renderSkeleton()
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400">
          <TrendingUp className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No posts found</p>
          <p className="text-sm mt-2">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center gap-4">
          {posts.map((post, index) => (
            <PostCard
              formatCount={formatCount}
              currentUser={currentUser}
              onPostClick={onPostClick}
              onProfileClick={onProfileClick}
              post={post}
              posts={posts}
              index={index}
              lastPostRef={lastPostRef}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-zinc-400">
                <div className="h-1.5 w-1.5 bg-zinc-400 rounded-full animate-pulse" />
                <div
                  className="h-1.5 w-1.5 bg-zinc-400 rounded-full animate-pulse"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="h-1.5 w-1.5 bg-zinc-400 rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Feed;
