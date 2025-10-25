import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Users,
  Hash,
  Sparkles,
  Bell,
  Bookmark,
  Crown,
  Star,
  Flame,
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
import { Button } from "@/Components/ui/button";

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
  currentUser?: User;
}

const CommunityPage = ({ currentUser }: Props) => {
  const [posts, setPosts] = useState<ICommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"publishedAt" | "likesCount" | "views">("likesCount");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  const [feedType, setFeedType] = useState<"trending" | "following">("trending");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Dummy data for sidebar components
  const leaderboardData = [
    { rank: 1, username: "creator_pro", posts: 142, likes: 45200, avatar: "https://i.pravatar.cc/150?img=1" },
    { rank: 2, username: "video_master", posts: 128, likes: 38900, avatar: "https://i.pravatar.cc/150?img=2" },
    { rank: 3, username: "content_king", posts: 115, likes: 32400, avatar: "https://i.pravatar.cc/150?img=3" },
    { rank: 4, username: "daily_creator", posts: 98, likes: 28100, avatar: "https://i.pravatar.cc/150?img=4" },
    { rank: 5, username: "viral_maker", posts: 87, likes: 24500, avatar: "https://i.pravatar.cc/150?img=5" },
  ];

  const trendingTopics = [
    { tag: "WebDevelopment", posts: 1243, trending: true },
    { tag: "AI", posts: 987, trending: true },
    { tag: "React", posts: 856, trending: false },
    { tag: "Design", posts: 742, trending: true },
    { tag: "Tutorial", posts: 621, trending: false },
  ];

  const suggestedCreators = [
    { username: "tech_guru", followers: "12.5K", avatar: "https://i.pravatar.cc/150?img=6", verified: true },
    { username: "design_wizard", followers: "8.2K", avatar: "https://i.pravatar.cc/150?img=7", verified: false },
    { username: "code_ninja", followers: "15.7K", avatar: "https://i.pravatar.cc/150?img=8", verified: true },
  ];

  const fetchPosts = useCallback(
    async (append = false) => {
      try {
        setLoading(!append);
        const params: any = {
          page: append ? pagination.page + 1 : 1,
          limit: pagination.limit,
          isAddedToBackpackAttach: true,
        };

        // Map sortBy to backend expected values
        if (sortBy === "publishedAt") params.sortBy = "recent";
        else if (sortBy === "likesCount") params.sortBy = "popular";
        else if (sortBy === "views") params.sortBy = "trending";

        if (searchQuery) params.search = searchQuery;
        
        // Add feed type filter (you'll need to implement this in your backend)
        if (feedType === "following") {
          params.followingOnly = true;
        }

        const response = await api.get("/community/posts", { params });
        if (response.data.success) {
          const newPosts = response.data.data;
          setPosts(append ? [...posts, ...newPosts] : newPosts);
          setPagination(response.data.pagination);
          setHasMore(response.data.pagination.page < response.data.pagination.pages);
        }
      } catch (error) {
        console.error("Failed to fetch posts:", error);
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, searchQuery, sortBy, sortOrder, posts, feedType]
  );

  useEffect(() => {
    fetchPosts();
  }, [searchQuery, sortBy, sortOrder, feedType]);

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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-200" />
              <Input
                type="text"
                placeholder="Search posts, creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-800 text-zinc-200 placeholder:text-white placeholder:font-extralight focus:border-none border-none rounded-full h-8"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                <Bell className="h-5 w-5 text-zinc-400" />
              </button>
              <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                <Bookmark className="h-5 w-5 text-zinc-400" />
              </button>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-white h-8 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="publishedAt" className="text-white hover:bg-zinc-700">
                    Latest
                  </SelectItem>
                  <SelectItem value="likesCount" className="text-white hover:bg-zinc-700">
                    Most Liked
                  </SelectItem>
                  <SelectItem value="views" className="text-white hover:bg-zinc-700">
                    Trending
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="container mx-auto px-4 py-4 flex gap-4">
        {/* Main Feed Section */}
        <div className="flex-1 min-w-0">
          {/* Feed Type Selector (Twitter-style) */}
          <div className="mb-6 border-b border-zinc-800">
            <div className="flex gap-0">
              <button
                onClick={() => setFeedType("trending")}
                className={`flex-1 py-3 px-4 font-semibold text-sm transition-colors relative ${
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
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full" />
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
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {loading && posts.length === 0 ? (
            renderSkeleton()
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400">
              <TrendingUp className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">No posts found</p>
              <p className="text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="flex flex-col w-full justify-center items-center gap-10">
              {/* <div className="grid grid-cols-1 gap-4"> */}
                {posts.map((post, index) => (
                  <PostCard
                    key={post._id}
                    currentUser={currentUser}
                    posts={posts}
                    post={post}
                    index={index}
                    formatCount={formatCount}
                    setIsModalOpen={setIsModalOpen}
                    setSelectedPost={setSelectedPost}
                    lastPostRef={lastPostRef}
                  />
                ))}
              {/* </div> */}
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
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div
          className={`transition-all duration-300 ${
            sidebarCollapsed ? "w-12" : "w-80"
          } flex-shrink-0 relative hidden lg:block`}
        >
          {/* Collapse Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -left-3 top-4 z-10 bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-full border border-zinc-700 transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          <div
            className={`sticky top-20 space-y-4 ${
              sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
            } transition-opacity duration-300`}
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-200" />
              <Input
                type="text"
                placeholder="Search users.."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900 h-10 border border-zinc-600 text-zinc-200 placeholder:text-white placeholder:font-extralight focus:border-none rounded-full"
              />
            </div>
            <Button size="lg" className="border border-zinc-600 bg-transparent text-white rounded-full w-full cursor-pointer">My Posts</Button>
            <Button size="lg" className="border border-zinc-600 bg-transparent text-white rounded-full w-full cursor-pointer">Liked Posts</Button>
            <Button size="lg" className="bg-white text-black rounded-full w-full hover:bg-zinc-300 cursor-pointer">Create Post</Button>
            {/* Leaderboard */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h3 className="font-bold text-lg">Top Creators</h3>
              </div>
              <div className="space-y-3">
                {leaderboardData.map((creator) => (
                  <div
                    key={creator.rank}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <div className="relative">
                      <img
                        src={creator.avatar}
                        alt={creator.username}
                        className="h-10 w-10 rounded-full"
                      />
                      {creator.rank <= 3 && (
                        <div className="absolute -top-1 -right-1 bg-zinc-900 rounded-full p-0.5">
                          {creator.rank === 1 && <Crown className="h-3 w-3 text-yellow-500" />}
                          {creator.rank === 2 && <Star className="h-3 w-3 text-zinc-400" />}
                          {creator.rank === 3 && <Star className="h-3 w-3 text-amber-700" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{creator.username}</p>
                      <p className="text-xs text-zinc-500">
                        {formatCount(creator.likes)} likes
                      </p>
                    </div>
                    <div className="text-zinc-500 font-bold text-sm">#{creator.rank}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending Topics */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="h-5 w-5 text-blue-500" />
                <h3 className="font-bold text-lg">Trending Topics</h3>
              </div>
              <div className="space-y-2">
                {trendingTopics.map((topic) => (
                  <div
                    key={topic.tag}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {topic.trending && <Flame className="h-4 w-4 text-orange-500" />}
                      <span className="font-medium text-sm">#{topic.tag}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {formatCount(topic.posts)} posts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested Creators */}
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <h3 className="font-bold text-lg">Suggested</h3>
              </div>
              <div className="space-y-3">
                {suggestedCreators.map((creator) => (
                  <div
                    key={creator.username}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    <img
                      src={creator.avatar}
                      alt={creator.username}
                      className="h-10 w-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate flex items-center gap-1">
                        {creator.username}
                        {creator.verified && (
                          <span className="text-blue-500">✓</span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">{creator.followers} followers</p>
                    </div>
                    <button className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-full hover:bg-zinc-200 transition-colors">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Stats */}
            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-800/50">
              <h3 className="font-bold text-sm mb-3">Community Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Posts</span>
                  <span className="font-semibold">{formatCount(pagination.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Active Creators</span>
                  <span className="font-semibold">2.4K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Views</span>
                  <span className="font-semibold">15.8M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Post Detail Modal */}
      {isModalOpen && selectedPost && (
        <VideoModal
          currentUser={currentUser}
          selectedPost={selectedPost}
          setIsModalOpen={setIsModalOpen}
          setPosts={setPosts}
          setSelectedPost={setSelectedPost}
          formatCount={formatCount}
        />
      )}
    </div>
  );
};

export default CommunityPage;