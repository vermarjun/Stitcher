import { useState, useEffect, useCallback, useRef } from "react";
import RightSidebar from "./RightSideBar/main.rightsidebar";
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
  mediaType: "image" | "video" | "gif" | "audio";
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
type ViewType = "feed" | "post" | "profile" | "myPosts" | "likedPosts";

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
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"publishedAt" | "likesCount" | "views">(
    "likesCount"
  );
  // const [sortOrder] = useState<"asc" | "desc">("desc");
  const [feedType, setFeedType] = useState<"trending" | "following">(
    "trending"
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [hasMore, setHasMore] = useState(true);

  // Navigation state
  const [navigationStack, setNavigationStack] = useState<NavigationState[]>([
    { view: "feed" },
  ]);

  const currentView = navigationStack[navigationStack.length - 1];

  const observer = useRef<IntersectionObserver>(null);
  const lastPostRef = useRef<HTMLDivElement>(null);
  const fetchPosts = useCallback(
    async (append = false) => {
      try {
        setLoading(true);
        setPosts([]);

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

        // Determine the endpoint based on feedType
        const endpoint =
          feedType === "following"
            ? "/community/following/posts"
            : "/community/posts";

        const response = await api.get(endpoint, { params });

        if (response.data.success) {
          const newPosts = response.data.data;
          setPosts(append ? [...posts, ...newPosts] : newPosts);
          setPagination(response.data.pagination);
          setHasMore(
            response.data.pagination.page < response.data.pagination.pages
          );
        }
      } catch (error: any) {
        console.error("Failed to fetch posts:", error);
        // Optional: Show user-friendly error message
        if (error.response?.status === 401 && feedType === "following") {
          console.error("Authentication required for following feed");
          // You might want to redirect to login or show a message
        }
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, searchQuery, sortBy, posts, feedType]
  );

  useEffect(() => {
    fetchPosts();
  }, [searchQuery, sortBy, feedType]); // Removed sortOrder since it's not used

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
    navigateTo("post", post);
  };

  const handleProfileClick = (user: IAuthor) => {
    if (currentView.view === "profile") {
      // Replace the existing profile view with the new one
      const updatedStack = [...navigationStack];
      updatedStack[updatedStack.length - 1] = { view: "profile", data: user };
      setNavigationStack(updatedStack);
    } else {
      navigateTo("profile", user);
    }
  };

  // Render current view
  const renderMainStage = () => {
    switch (currentView.view) {
      case "feed":
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

      case "post":
        return (
          <PostDetail
            post={currentView.data}
            formatCount={formatCount}
            currentUser={currentUser}
            onBack={navigateBack}
            onProfileClick={handleProfileClick}
          />
        );

      case "profile":
        return (
          <Profile
            onPostClick={handlePostClick}
            onBack={navigateBack}
            currentUser={currentUser}
            profile={currentView.data}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-between min-h-screen w-full bg-black text-white">
      {/* Main Content with Sidebar */}
      <div className="w-full">
        {/* Header */}
        <Header
          sortBy={sortBy}
          setSortBy={setSortBy}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />
        {/* Main Stage */}
        <div className="min-w-0 w-full flex justify-center">
          {renderMainStage()}
        </div>
      </div>
      {/* Right Sidebar */}
      <RightSidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        formatCount={formatCount}
        pagination={pagination}
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onProfileClick={handleProfileClick}
        onBack={navigateBack}
      />
    </div>
  );
};

export default CommunityPage;
