import { Hash, Flame } from "lucide-react";
import type { TrendingTopic } from "./types.rightsidebar";

interface TrendingTopicsProps {
  topics: TrendingTopic[];
  formatCount: (count: number) => string;
}

const TrendingTopics = ({ topics, formatCount }: TrendingTopicsProps) => {
  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <Hash className="h-5 w-5 text-blue-500" />
        <h3 className="font-bold text-lg">Trending Topics</h3>
      </div>
      <div className="space-y-2">
        {topics.map((topic) => (
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
  );
};

export default TrendingTopics;