import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { Skeleton } from "@/Components/ui/skeleton";
import api from "@/api";
import { PostCard } from "./PostCard.communitypage";
import { VideoModal } from "./VideoModal.communitypage";
import type { User } from "@/State/Types";

export interface IUser {
  _id: string;
  username: string;
  profilePhoto?: string;
  bio?: string;
  createdAt: string;
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
  userId: IUser;
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
  authorId: IUser;
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
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Props {
  currentUser?: User
}

const CommunityPage = ({currentUser}:Props) => {
  const [posts, setPosts] = useState<ICommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"publishedAt" | "likesCount" | "views">(
    "likesCount"
  );
  const [sortOrder, ] = useState<"asc" | "desc">("desc");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [hasMore, setHasMore] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ICommunityPost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const observer = useRef<IntersectionObserver>(null);
  const lastPostRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(
    async (append = false) => {
      try {
        setLoading(!append);
        const params: any = {
          page: append ? pagination.page + 1 : 1,
          limit: pagination.limit,
          isAddedToBackpackAttach : true
        };

        // Map sortBy to backend expected values
        if (sortBy === "publishedAt") params.sortBy = "recent";
        else if (sortBy === "likesCount") params.sortBy = "popular";
        else if (sortBy === "views") params.sortBy = "trending";

        if (searchQuery) params.search = searchQuery;

        const response = await api.get("/community/posts", { params });
        if (response.data.success) {
          const newPosts = response.data.data;
          setPosts(append ? [...posts, ...newPosts] : newPosts);
          setPagination(response.data.pagination);
          setHasMore(
            response.data.pagination.page < response.data.pagination.pages
          );
        }
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, searchQuery, sortBy, sortOrder, posts]
  );

  useEffect(() => {
    fetchPosts();
  }, [searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        fetchPosts(true);
      }
    });

    if (lastPostRef.current) {
      observer.current.observe(lastPostRef.current);
    }

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [loading, hasMore, posts]);

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="bg-transparent">
          <Skeleton className="w-full aspect-video bg-zinc-800 rounded-xl mb-3" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full bg-zinc-800" />
              <Skeleton className="h-3 w-24 bg-zinc-800 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full bg-zinc-800 rounded-full" />
            <Skeleton className="h-3 w-3/4 bg-zinc-800 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <div className="h-14 sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl flex items-center justify-center gap-1 font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Community
              </h1>
            </div>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Search posts, creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-zinc-600 rounded-full h-8"
                />
              </div>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-32 bg-zinc-900 border-zinc-800 text-white h-8 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem
                    value="publishedAt"
                    className="text-white hover:bg-zinc-800"
                  >
                    Latest
                  </SelectItem>
                  <SelectItem
                    value="likesCount"
                    className="text-white hover:bg-zinc-800"
                  >
                    Most Liked
                  </SelectItem>
                  <SelectItem
                    value="views"
                    className="text-white hover:bg-zinc-800"
                  >
                    Trending
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4">
        {loading && posts.length === 0 ? (
          renderSkeleton()
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400">
            <TrendingUp className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No posts found</p>
            <p className="text-sm mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {posts.map((post, index) => (
                <PostCard currentUser={currentUser} posts={posts} post={post} index={index} formatCount={formatCount} setIsModalOpen={setIsModalOpen} setSelectedPost={setSelectedPost} lastPostRef={lastPostRef}/>
              ))}
            </div>

            {/* Loading more indicator */}
            {hasMore && (
              <div className="flex justify-center mt-8">
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
          </>
        )}
      </div>

      {/* Post Detail Modal (Instagram-style) */}
      {isModalOpen && selectedPost && (
          <VideoModal currentUser={currentUser} selectedPost={selectedPost} setIsModalOpen={setIsModalOpen} setPosts={setPosts} setSelectedPost={setSelectedPost} formatCount={formatCount}/>
      )}
    </div>
  );
};

export default CommunityPage;
