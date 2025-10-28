import { Search, X } from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import Leaderboard from "./Leaderboard.rightsidebar";
import TrendingTopics from "./TrendingTopics.rightsidebar";
import SuggestedCreators from "./SuggestedCreators.rightsidebar";
import CommunityStats from "./CommunityStats.rightsidebar";
import type { IAuthor } from "../main.communitypage";

import type {
  PaginationInfo,
  LeaderboardUser,
  TrendingTopic,
  SuggestedCreator,
} from "./types.rightsidebar";

interface RightSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  formatCount: (count: number) => string;
  pagination: PaginationInfo;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  leaderboardData?: LeaderboardUser[];
  trendingTopics?: TrendingTopic[];
  suggestedCreators?: SuggestedCreator[];
  onProfileClick: (user: IAuthor) => void;
  onBack: () => void;
}

const defaultTrendingTopics: TrendingTopic[] = [
  { tag: "WebDevelopment", posts: 1243, trending: true },
  { tag: "AI", posts: 987, trending: true },
  { tag: "React", posts: 856, trending: false },
  { tag: "Design", posts: 742, trending: true },
  { tag: "Tutorial", posts: 621, trending: false },
];

const defaultSuggestedCreators: SuggestedCreator[] = [
  {
    username: "tech_guru",
    followers: "12.5K",
    avatar: "https://i.pravatar.cc/150?img=6",
    verified: true,
  },
  {
    username: "design_wizard",
    followers: "8.2K",
    avatar: "https://i.pravatar.cc/150?img=7",
    verified: false,
  },
  {
    username: "code_ninja",
    followers: "15.7K",
    avatar: "https://i.pravatar.cc/150?img=8",
    verified: true,
  },
];

const RightSidebar = ({
  searchQuery,
  setSearchQuery,
  formatCount,
  pagination,
  isMobileOpen,
  onMobileClose,
  trendingTopics = defaultTrendingTopics,
  suggestedCreators = defaultSuggestedCreators,
  onBack,
  onProfileClick,
}: RightSidebarProps) => {
  const SearchSection = () => (
    <>
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
        className="bg-white text-black rounded-full w-full hover:bg-zinc-300 cursor-pointer"
      >
        Create Post
      </Button>
    </>
  );

  const MobileHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-bold text-lg">Menu</h2>
      <button
        onClick={onMobileClose}
        className="p-2 hover:bg-zinc-800 rounded-full"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`transition-all duration-300 md:w-72 xl:w-96 flex-shrink-0 relative hidden lg:block border-l border-zinc-800`}
      >
        <div
          className={`h-screen overflow-y-auto sticky top-0 px-4 py-6 space-y-4 opacity-100 transition-opacity duration-300`}
        >
          <SearchSection />

          <Leaderboard onProfileClick={onProfileClick} onBack={onBack}/>
          <TrendingTopics topics={trendingTopics} formatCount={formatCount} />
          <SuggestedCreators creators={suggestedCreators} />
          <CommunityStats pagination={pagination} formatCount={formatCount} />
        </div>
      </div>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={onMobileClose}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-black border-l border-zinc-800 overflow-y-auto">
            <div className="p-4">
              <MobileHeader />

              <div className="space-y-4">
                <SearchSection />

                <Leaderboard onProfileClick={onProfileClick} onBack={onBack} />
                <TrendingTopics
                  topics={trendingTopics}
                  formatCount={formatCount}
                />
                <SuggestedCreators creators={suggestedCreators} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RightSidebar;
