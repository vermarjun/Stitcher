import React from "react";
import { Download, Check, Loader2, Star, Tag, Play, Music } from "lucide-react";

export enum BackpackItemType {
  ASSET = "Asset",
  TEMPLATE = "Template",
}

export interface IBackpackItem {
  _id: string;
  itemType: "Asset" | "Template";
  itemId: any;
  favourite: boolean;
  source: "project" | "community_post" | "template_library";
  sourceId?: string;
  tags: string[];
  notes?: string;
  addedAt: string;
  isAddedToProject?: boolean;
}

interface BackpackItemCardProps {
  item: IBackpackItem;
  isUsing: boolean;
  isFavouriting: boolean;
  showSuccess: boolean;
  showFavouriteAnimation: boolean;
  onFavourite: (item: IBackpackItem) => void;
  handleImportItemToProject: (item: IBackpackItem) => void;
}

const BackpackItemCard: React.FC<BackpackItemCardProps> = ({
  item,
  isUsing,
  isFavouriting,
  showSuccess,
  showFavouriteAnimation,
  onFavourite,
  handleImportItemToProject,
}) => {
  // Helper functions
  const formatDuration = (seconds: number): string => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getItemName = () => {
    return item.itemId.name || item.itemId.title || "Untitled";
  };

  const getItemType = () => {
    return item.itemId.type || "unknown";
  };

  const getItemDuration = () => {
    return item.itemId.duration;
  };

  const getItemBytes = () => {
    return item.itemId.bytes || 0;
  };

  const getThumbnail = () => {
    return item.itemId.thumbnail;
  };

  return (
    <div
      className={`relative bg-gradient-top bg-zinc-800 rounded-lg overflow-hidden cursor-pointer group hover:bg-zinc-700 transition-all duration-200 ${
        showSuccess
          ? "shadow-sm shadow-green-500/20 ring-1 ring-green-500/30"
          : "hover:shadow-lg"
      }`}
    >
      <div className="flex items-center p-1 gap-2.5">
        {/* Thumbnail */}
        <div className="flex-shrink-0 aspect-video h-16 bg-zinc-800 rounded-md flex items-center justify-center relative overflow-hidden">
          {getThumbnail() ? (
            <img
              src={getThumbnail()}
              alt={getItemName()}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-zinc-500">
              {getItemType() === "video" ? (
                <Play className="w-4 h-4" />
              ) : (
                <Music className="w-4 h-4" />
              )}
            </div>
          )}

          {/* Duration overlay */}
          {getItemDuration() && (
            <div className="absolute bottom-1 right-1 bg-zinc-700 bg-opacity-80 text-white text-[9px] px-1 py-0.5 leading-none rounded">
              {formatDuration(getItemDuration())}
            </div>
          )}

          {/* Item Type Badge */}
          <div className="absolute top-1 left-1 bg-zinc-700 bg-opacity-80 rounded-xs text-white text-[8px] px-1 py-0.5 leading-none uppercase">
            {item.itemType}
          </div>
        </div>

        {/* Item Info */}
        <div className="flex-1 min-w-0 overflow-hidden pr-2">
          {/* Header with name and favourite button */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {/* Favourite Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFavourite(item);
                }}
                disabled={isFavouriting}
                className={`relative flex-shrink-0 flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${
                  item.favourite
                    ? "text-yellow-500 hover:text-yellow-600"
                    : "text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10"
                }`}
              >
                {isFavouriting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Star
                    className={`w-3 h-3 transition-all duration-200 ${
                      item.favourite ? "fill-current" : ""
                    }`}
                  />
                )}

                {showFavouriteAnimation && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Star className="w-3 h-3 text-yellow-500 fill-current animate-bounce" />
                  </div>
                )}
              </button>

              {/* Item Name */}
              <h3 className="text-xs font-medium text-white truncate pr-1 leading-tight">
                {getItemName()}
              </h3>
            </div>
          </div>

          {/* Type and Size */}
          <div className="flex items-center justify-between w-full gap-2 text-[10px] text-zinc-400 mb-1">
            <span className="uppercase font-medium tracking-wide">
              {getItemType()}
            </span>
            <span className="text-zinc-500">
              {formatFileSize(getItemBytes())}
            </span>
          </div>

          {/* Source Badge and Date */}
          <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
            <span className="text-zinc-200 bg-zinc-500 px-1.5 py-0.5 rounded capitalize">
              {item.source.replace("_", " ")}
            </span>
            {/* Use Button */}
            <div className="flex-shrink-0">
              {isUsing ? (
                <div className="w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center">
                  <Loader2 className="w-2.5 h-2.5 text-zinc-400 animate-spin" />
                </div>
              ) : showSuccess ? (
                <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center animate-pulse">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              ) : item.isAddedToProject ? (
                <div className="flex items-center text-green-400 text-[10px] font-medium px-1 py-0 bg-green-500/10 rounded-full border border-green-500/20">
                  <div className="flex items-center justify-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    <span className="text-[10px] font-medium">Added</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImportItemToProject(item);
                  }}
                  className="bg-zinc-300 hover:bg-zinc-200 rounded-xl flex items-center justify-center transition-all duration-200 py-0 px-1.5"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Download className="w-2.5 h-2.5 text-black" />
                    <span className="text-[10px] text-black font-medium">
                      Import
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          {item.notes && (
            <p className="text-[10px] text-zinc-300 mb-1 line-clamp-1 leading-tight">
              {item.notes}
            </p>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 2).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-0.5 bg-zinc-700 text-zinc-300 text-[9px] px-1.5 py-0.5 rounded-full"
                >
                  <Tag className="w-2 h-2" />
                  {tag}
                </span>
              ))}
              {item.tags.length > 2 && (
                <span className="text-[9px] text-zinc-500">
                  +{item.tags.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Success overlay animation */}
      {showSuccess && (
        <div className="absolute inset-0 bg-green-600/20 flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-green-600 text-white rounded-full p-3 animate-in zoom-in duration-300">
            <Check className="w-6 h-6" />
          </div>
        </div>
      )}
    </div>
  );
};

export default BackpackItemCard;
