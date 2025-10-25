import React from "react";
import {
  Play,
  Music,
  Plus,
  Loader2,
  Backpack,
  Check,
} from "lucide-react";
import type { Asset } from "@/State/Types";
import { AssetOrigin, AssetType } from "@/State/Types";

interface CardProps {
  filteredAssets: Asset[];
  handleDragStart: (e: React.DragEvent, a: Asset) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  formatDuration: (x: number) => string;
  handleAddToTimeline: (asset: Asset) => Promise<void>;
  handleAddToBackPack: (asset: Asset) => Promise<void>;
  getOriginLabel: (origin: AssetOrigin) => string;
  formatFileSize: (s: number) => string;
  loadingStates: {
    [assetId: string]: {
      timeline: boolean;
      backpack: boolean;
    };
  };
}

const AssetCardComponent = ({
  filteredAssets,
  handleDragStart,
  handleDragEnd,
  formatDuration,
  handleAddToTimeline,
  handleAddToBackPack,
  getOriginLabel,
  formatFileSize,
  loadingStates,
}: CardProps) => {
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-200 bg-green-950 p-2 rounded-md">
        For Editing, drag the asset below to Right Side Bar. Only Generated or
        Template videos can be edited.
      </p>
      {filteredAssets.map((asset: Asset) => (
        <div
          key={asset._id}
          draggable={true}
          onDragStart={(e) => handleDragStart(e, asset)}
          onDragEnd={handleDragEnd}
          className="relative bg-gradient-top bg-zinc-800 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group hover:bg-zinc-700 transition-all duration-200"
        >
          <div className="flex items-center p-1 gap-2.5">
            {/* Thumbnail/Icon */}
            <div className="flex-shrink-0 aspect-video h-16 bg-zinc-800 rounded-md flex items-center justify-center relative overflow-hidden">
              {asset.thumbnail ? (
                <img
                  src={asset.thumbnail}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-zinc-500">
                  {asset.type === AssetType.VIDEO ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Music className="w-4 h-4" />
                  )}
                </div>
              )}
              {/* Duration overlay */}
              {asset.duration && (
                <div className="absolute bottom-1 right-1 bg-zinc-700 bg-opacity-80 text-white text-[9px] px-1 py-0.5 leading-none">
                  {formatDuration(asset.duration)}
                </div>
              )}
            </div>

            {/* Asset Info */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-medium text-white truncate pr-1 leading-tight">
                  {asset.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 mb-0.5">
                <span className="uppercase font-medium tracking-wide">
                  {asset.type}
                </span>
                <span className="text-zinc-500">
                  {formatFileSize(asset.bytes)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                <div className="text-[10px] text-zinc-500 truncate">
                  {getOriginLabel(asset.origin)}
                </div>
                {/* Timeline Status / Add Button */}
                <div className="flex justify-center items-center gap-2 cursor-pointer">
                  <div className="flex-shrink-0 cursor-pointer">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToTimeline(asset);
                      }}
                      disabled={loadingStates[asset._id]?.timeline}
                      className="p-1 cursor-pointer bg-green-800 text-black rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingStates[asset._id]?.timeline ? (
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToBackPack(asset);
                      }}
                      disabled={loadingStates[asset._id]?.backpack}
                      className="p-1 cursor-pointer bg-green-800 text-black rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingStates[asset._id]?.backpack ? (
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      ) : !asset.isAddedToBackpack ? (
                        <Backpack className="w-3 h-3 text-white" />
                      ) : (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AssetCardComponent;