import { Skeleton } from "@/Components/ui/skeleton";
import type { User } from "@/State/Types";
import { useEffect, useState, useRef, useCallback } from "react";
import { TrendingUp } from "lucide-react";
import api from "@/api";
import PostCard from "./PostCard.settings";

export interface IAuthor {
  _id: string;
  username: string;
  profilePhoto?: string;
  plan?: string;
}

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
  userId: IAuthor;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  likes: string[];
  isLiked?: boolean;
  parentCommentId?: string;
}

export interface ICommunityPost {
  _id: string;
  assetId: IAsset;
  authorId: IAuthor;
  title: string;
  description?: string;
  tags: string[];
  likes: { userId: string; createdAt: string }[];
  likesCount: number;
  comments: IComment[];
  commentsCount: number;
  analytics: {
    views: number;
    uniqueViews: number;
    saves: number;
  };
  publishedAt: string;
  isLiked?: boolean;
  isSavedByUser?: boolean;
  isAddedToBackpack?: boolean;
  isFollowing?: boolean;
}

interface Props {
  currentUser?: User;
}

const MyPosts = ({ currentUser }: Props) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [posts, setPosts] = useState<ICommunityPost[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prev) => prev + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const fetchPosts = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/community/users/posts?limit=5&page=${pageNumber}`);
      if (response.data.success) {
        const fetchedPosts = response.data.data;
        if (fetchedPosts.length < 5) setHasMore(false);
        setPosts((prev) => [...prev, ...fetchedPosts]);
      }
    } catch (error: any) {
      console.error("Failed to fetch posts:", error);
      if (error.response?.status === 401) {
        console.error("Authentication required for following feed");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(page);
  }, [page]);

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

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

  if (posts.length === 0 && loading) return renderSkeleton();

  if (posts.length === 0 && !loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400">
        <TrendingUp className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No posts found</p>
        <p className="text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    );

  return (
    <div className="flex-1 justify-center min-w-0 w-full">
      <div className="flex flex-col justify-center items-center gap-4">
        {posts.map((post, index) => {
          if (index === posts.length - 1) {
            return (
              <div ref={lastPostRef} key={post._id} className="w-full">
                <PostCard
                  formatCount={formatCount}
                  post={post}
                  posts={posts}
                  currentUser={currentUser}
                />
              </div>
            );
          }
          return (
            <PostCard
              key={post._id}
              formatCount={formatCount}
              post={post}
              posts={posts}
              currentUser={currentUser}
            />
          );
        })}

        {loading && (
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
    </div>
  );
};

export default MyPosts;