import {
  Search,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Hash,
  Sparkles,
  Crown,
  Star,
  Flame,
  X,
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";

// Types
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

// ============= RIGHT SIDEBAR COMPONENT =============
interface RightSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  formatCount: (count: number) => string;
  pagination: PaginationInfo;
  onMyPostsClick: () => void;
  onLikedPostsClick: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const RightSidebar = ({
  collapsed,
  setCollapsed,
  searchQuery,
  setSearchQuery,
  formatCount,
  pagination,
  onMyPostsClick,
  onLikedPostsClick,
  isMobileOpen,
  onMobileClose,
}: RightSidebarProps) => {
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

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`transition-all duration-300 ${
          collapsed ? "w-12" : "md:w-72 xl:w-96"
        } flex-shrink-0 relative hidden lg:block border-l border-zinc-800`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -left-3 top-4 z-10 bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-full border border-zinc-700 transition-colors"
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        
        <div
          className={`h-[calc(100vh-3.5rem)] overflow-y-auto sticky top-14 px-4 py-6 space-y-4 ${
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
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
          <Button 
            size="lg" 
            onClick={onMyPostsClick}
            className="border border-zinc-600 bg-transparent text-white rounded-full w-full cursor-pointer hover:bg-zinc-800"
          >
            My Posts
          </Button>
          <Button 
            size="lg" 
            onClick={onLikedPostsClick}
            className="border border-zinc-600 bg-transparent text-white rounded-full w-full cursor-pointer hover:bg-zinc-800"
          >
            Liked Posts
          </Button>
          <Button size="lg" className="bg-white text-black rounded-full w-full hover:bg-zinc-300 cursor-pointer">
            Create Post
          </Button>

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
                    <img src={creator.avatar} alt={creator.username} className="h-10 w-10 rounded-full" />
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
                    <p className="text-xs text-zinc-500">{formatCount(creator.likes)} likes</p>
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
                  <span className="text-xs text-zinc-500">{formatCount(topic.posts)} posts</span>
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
                  <img src={creator.avatar} alt={creator.username} className="h-10 w-10 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate flex items-center gap-1">
                      {creator.username}
                      {creator.verified && <span className="text-blue-500">✓</span>}
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

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80" onClick={onMobileClose} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-black border-l border-zinc-800 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg">Menu</h2>
                <button onClick={onMobileClose} className="p-2 hover:bg-zinc-800 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-200" />
                  <Input
                    type="text"
                    placeholder="Search users.."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-zinc-900 h-10 border border-zinc-600 text-zinc-200 rounded-full"
                  />
                </div>
                <Button 
                  size="lg" 
                  onClick={() => {
                    onMyPostsClick();
                    onMobileClose();
                  }}
                  className="border border-zinc-600 bg-transparent text-white rounded-full w-full hover:bg-zinc-800"
                >
                  My Posts
                </Button>
                <Button 
                  size="lg" 
                  onClick={() => {
                    onLikedPostsClick();
                    onMobileClose();
                  }}
                  className="border border-zinc-600 bg-transparent text-white rounded-full w-full hover:bg-zinc-800"
                >
                  Liked Posts
                </Button>
                <Button size="lg" className="bg-white text-black rounded-full w-full hover:bg-zinc-300">
                  Create Post
                </Button>

                {/* Mobile Leaderboard */}
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
                          <img src={creator.avatar} alt={creator.username} className="h-10 w-10 rounded-full" />
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
                          <p className="text-xs text-zinc-500">{formatCount(creator.likes)} likes</p>
                        </div>
                        <div className="text-zinc-500 font-bold text-sm">#{creator.rank}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Trending Topics */}
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
                        <span className="text-xs text-zinc-500">{formatCount(topic.posts)} posts</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Suggested Creators */}
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
                        <img src={creator.avatar} alt={creator.username} className="h-10 w-10 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate flex items-center gap-1">
                            {creator.username}
                            {creator.verified && <span className="text-blue-500">✓</span>}
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
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RightSidebar;