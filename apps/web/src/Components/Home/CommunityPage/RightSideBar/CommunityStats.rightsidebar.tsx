import type { PaginationInfo } from "./types.rightsidebar";

interface CommunityStatsProps {
  pagination: PaginationInfo;
  formatCount: (count: number) => string;
}

const CommunityStats = ({ pagination, formatCount }: CommunityStatsProps) => {
  return (
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
  );
};

export default CommunityStats;