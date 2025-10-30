import { useEffect, useState } from "react";
import { Hash, Flame } from "lucide-react";
import api from "@/api";

interface TrendingTopic {
  tag: string;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  trendingScore: number;
  lastUsedAt: string;
}

const TrendingTopics = () => {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCount = (count: number): string => {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "M";
    if (count >= 1_000) return (count / 1_000).toFixed(1) + "K";
    return count.toString();
  };

  useEffect(() => {
    const fetchTrendingTopics = async () => {
      try {
        const res = await api.get("/community/trending/tags?limit=5");
        if (res.data?.success) {
          setTopics(res.data.data || []);
        }
      } catch (err) {
        console.error("Error fetching trending topics:", err);
        setError("Failed to load trending topics");
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingTopics();
  }, []);

  // ✨ Modern Skeleton Loader
  const Skeleton = () => (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-2 rounded-lg border border-transparent"
        >
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-zinc-800" />
            <div className="h-3 w-24 bg-zinc-800 rounded" />
          </div>
          <div className="h-2 w-12 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <div className="flex items-center gap-2 mb-4">
          <Hash className="h-5 w-5 text-blue-500" />
          <h3 className="font-bold text-lg">Trending Topics</h3>
        </div>
        <Skeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 text-center text-zinc-500">
        No trending topics right now.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <Hash className="h-5 w-5 text-blue-500" />
        <h3 className="font-bold text-lg">Trending Topics</h3>
      </div>

      <div className="space-y-2">
        {topics.map((topic, index) => (
          <div
            key={topic.tag}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {index < 3 && <Flame className="h-4 w-4 text-orange-500" />}
              <span className="font-medium text-sm">#{topic.tag}</span>
            </div>
            <span className="text-xs text-zinc-500">
              {formatCount(topic.totalPosts)} posts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendingTopics;
