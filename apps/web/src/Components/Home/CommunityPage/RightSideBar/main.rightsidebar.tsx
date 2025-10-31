import { X } from "lucide-react";
import Leaderboard from "./Leaderboard.rightsidebar";
import TrendingTopics from "./TrendingTopics.rightsidebar";
import SuggestedCreators from "./SuggestedCreators.rightsidebar";
import SearchSection from "./Search.rightsidebar";
import type { IUser } from "@/State/Types";

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
  onProfileClick: (user: IUser) => void;
  onBack: () => void;
}

const RightSidebar = ({
  isMobileOpen,
  onMobileClose,
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
          <SearchSection onProfileClick={onProfileClick} onBack={onBack}/>

          <Leaderboard onProfileClick={onProfileClick} onBack={onBack}/>
          <TrendingTopics/>
          <SuggestedCreators/>
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
                <SearchSection onBack={onBack} onProfileClick={onProfileClick}/>

                <Leaderboard onProfileClick={onProfileClick} onBack={onBack} />
                <TrendingTopics/>
                <SuggestedCreators/>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RightSidebar;
