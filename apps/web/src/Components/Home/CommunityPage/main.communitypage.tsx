import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
} from "lucide-react";
import RightSidebar from "./RightSideBar.communitypage";
import Header from "./Header.communitypage";
import Feed from "./PostFeed.communitypage";
import Profile from "./ProfilePage/main.profilepage";
import PostDetail from "./PostDetail.communitypage";
import api from "@/api";
import type { User } from "@/State/Types";

// Types
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
  media: ICommentMedia[];
}

export interface ICommentMedia {
  mediaType: 'image' | 'video' | 'gif' | 'audio';
  thumbnailUrl?: string;
  order: number;
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
  isFollowing?: boolean; //if the currentUser is following the author of this post
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Navigation types
type ViewType = 'feed' | 'post' | 'profile' | 'myPosts' | 'likedPosts';

interface NavigationState {
  view: ViewType;
  data?: any;
}

// ============= MAIN COMMUNITY PAGE COMPONENT =============
interface Props {
  currentUser?: User;
}

const CommunityPage = ({ currentUser }: Props) => {
  // State
  const [posts, setPosts] = useState<ICommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"publishedAt" | "likesCount" | "views">("likesCount");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  const [feedType, setFeedType] = useState<"trending" | "following">("trending");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [hasMore, setHasMore] = useState(true);
  
  // Navigation state
  const [navigationStack, setNavigationStack] = useState<NavigationState[]>([
    { view: 'feed' }
  ]);
  
  const currentView = navigationStack[navigationStack.length - 1];
  
  const observer = useRef<IntersectionObserver>(null);
  const lastPostRef = useRef<HTMLDivElement>(null);

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

  // Navigation functions
  const navigateTo = (view: ViewType, data?: any) => {
    setNavigationStack([...navigationStack, { view, data }]);
  };

  const navigateBack = () => {
    if (navigationStack.length > 1) {
      setNavigationStack(navigationStack.slice(0, -1));
    }
  };

  const handlePostClick = (post: ICommunityPost) => {
    navigateTo('post', post);
  };

  const handleProfileClick = (user: IAuthor) => {
    navigateTo('profile', user);
  };

  const handleMyPostsClick = () => {
    navigateTo('myPosts');
  };

  const handleLikedPostsClick = () => {
    navigateTo('likedPosts');
  };

  // Render current view
  const renderMainStage = () => {
    switch (currentView.view) {
      case 'feed':
        return (
          <Feed
            posts={posts}
            loading={loading}
            feedType={feedType}
            setFeedType={setFeedType}
            hasMore={hasMore}
            lastPostRef={lastPostRef}
            formatCount={formatCount}
            currentUser={currentUser}
            onPostClick={handlePostClick}
            onProfileClick={handleProfileClick}
          />
        );
      
      case 'post':
        return (
          <PostDetail
            post={currentView.data}
            formatCount={formatCount}
            currentUser={currentUser}
            onBack={navigateBack}
            onProfileClick={handleProfileClick}
          />
        );
      
      case 'profile':
        return (
          <Profile onPostClick={handlePostClick} onBack={navigateBack} currentUser={currentUser} profile={currentView.data}/>
        );
      
      case 'myPosts':
        return (
          <div className="flex-1 min-w-0">
            <button
              onClick={navigateBack}
              className="flex items-center gap-2 mb-4 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <h2 className="text-2xl font-bold mb-6">My Posts</h2>
            <p className="text-zinc-500">Your posts will appear here</p>
          </div>
        );
      
      case 'likedPosts':
        return (
          <div className="flex-1 min-w-0">
            <button
              onClick={navigateBack}
              className="flex items-center gap-2 mb-4 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <h2 className="text-2xl font-bold mb-6">Liked Posts</h2>
            <p className="text-zinc-500">Posts you've liked will appear here</p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-white">
      {/* Header */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onMenuClick={() => setMobileSidebarOpen(true)}
      />

      {/* Main Content with Sidebar */}
      <div className="flex justify-between">
        {/* Main Stage */}
        <div className="min-w-0 w-full flex justify-center">
            {renderMainStage()}
        </div>

        {/* Right Sidebar */}
        <RightSidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          formatCount={formatCount}
          pagination={pagination}
          onMyPostsClick={handleMyPostsClick}
          onLikedPostsClick={handleLikedPostsClick}
          isMobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      </div>
    </div>
  );
};

export default CommunityPage;