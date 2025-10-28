import { Sparkles } from "lucide-react";
import type { SuggestedCreator } from "./types.rightsidebar";

interface SuggestedCreatorsProps {
  creators: SuggestedCreator[];
}

const SuggestedCreators = ({ creators }: SuggestedCreatorsProps) => {
  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-purple-500" />
        <h3 className="font-bold text-lg">Suggested</h3>
      </div>
      <div className="space-y-3">
        {creators.map((creator) => (
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
  );
};

export default SuggestedCreators;