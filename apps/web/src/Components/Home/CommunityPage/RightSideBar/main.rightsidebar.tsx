import { X } from "lucide-react";
import Leaderboard from "./Leaderboard.rightsidebar";
import TrendingTopics from "./TrendingTopics.rightsidebar";
import SuggestedCreators from "./SuggestedCreators.rightsidebar";
import type { IAuthor } from "../main.communitypage";
import SearchSection from "./Search.rightsidebar";

import type {
  PaginationInfo,
  LeaderboardUser,
  TrendingTopic,
  SuggestedCreator,
} from "./types.rightsidebar";

interface RightSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
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
  formatCount,
  pagination,
  isMobileOpen,
  onMobileClose,
  trendingTopics = defaultTrendingTopics,
  suggestedCreators = defaultSuggestedCreators,
  onBack,
  onProfileClick,
}: RightSidebarProps) => {
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
          <SearchSection/>

          <Leaderboard onProfileClick={onProfileClick} onBack={onBack}/>
          <TrendingTopics topics={trendingTopics} formatCount={formatCount} />
          <SuggestedCreators creators={suggestedCreators} />
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
                <SearchSection/>

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
