import React, { useState, useEffect } from "react";
import {
  Search,
  Download,
  FileVideo,
  Check,
  Loader2,
  Star,
  Tag,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { type IBackpack as Backpack, type IBackpackItem as BackpackItem, type IAsset as Asset, type ITemplate as Template } from "@/Components/Home/Backpack/main.backpack";
import api from "@/api";
import BeautifulLoader from "@/Components/LoadingScreens/Templatestore.loader";

interface BackpackProps {
  currentProject?: any;
  onUseItem?: (item: BackpackItem, assetOrTemplate: Asset | Template) => Promise<void>;
}

enum BackpackItemType {
  ASSET = 'Asset',
  TEMPLATE = 'Template'
}

const BackpackComponent: React.FC<BackpackProps> = ({
  onUseItem,
}) => {
  const [backpack, setBackpack] = useState<Backpack | null>(null);
  const [items, setItems] = useState<BackpackItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<BackpackItemType | "all">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [usingIds, setUsingIds] = useState<Set<string>>(new Set());
  const [successAnimations, setSuccessAnimations] = useState<Set<string>>(new Set());
  const [favouritingIds, setFavouritingIds] = useState<Set<string>>(new Set());
  const [favouriteAnimations, setFavouriteAnimations] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Filter items based on search, type, tags, and favourite status
  const filteredItems = items.filter((item) => {
    const matchesSearch = searchQuery === "" || 
      item.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === "all" || item.itemType === selectedType;
    
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.every(tag => item.tags.includes(tag));
    
    return matchesSearch && matchesType && matchesTags;
  });

  async function fetchBackpack() {
    try {
      setIsLoading(true);
      const response = await api.get("/backpack");
      
      if (response.status === 200 || response.status === 201) {
        setBackpack(response.data.data.backpack);
        setItems(response.data.data.backpack.items || []);
        
        // Extract all unique tags
        const tags = new Set<string>();
        response.data.data.backpack.items?.forEach((item: BackpackItem) => {
          item.tags.forEach(tag => tags.add(tag));
        });
        setAllTags(Array.from(tags));
      } else {
        throw new Error(response.data?.message || "Failed to fetch backpack");
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch backpack";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchBackpack();
  }, []);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const handleFavouriteItem = async (item: BackpackItem) => {
    setFavouritingIds((prev) => new Set(prev).add(item._id.toString()));

    const wasFavourited = item.favourite;

    try {
      const response = await api.patch(`/backpack/items/${item._id}/favourite`, {
        favourite: !item.favourite
      });

      if (!response.data.success) {
        throw new Error("Network connection failed. Please try again.");
      } else {
        toast.success(response.data.message);
      }

      // Update item state
      setItems((prev) =>
        prev.map((i) =>
          i._id.toString() === item._id.toString()
            ? { ...i, favourite: !i.favourite }
            : i
        )
      );

      // Show animation only if the item is being favourited (not unfavourited)
      if (!wasFavourited) {
        setFavouriteAnimations((prev) => new Set(prev).add(item._id.toString()));

        setTimeout(() => {
          setFavouriteAnimations((prev) => {
            const newSet = new Set(prev);
            newSet.delete(item._id.toString());
            return newSet;
          });
        }, 1000);
      }
    } catch (error) {
      toast.error("Favourite unsuccessful", {
        description: error instanceof Error ? error.message : "Failed to update favourite status",
        duration: 4000,
      });
    } finally {
      setFavouritingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item._id.toString());
        return newSet;
      });
    }
  };

  const handleUseItem = async (item: BackpackItem) => {
    setUsingIds((prev) => new Set(prev).add(item._id.toString()));

    try {
      // Fetch the actual asset or template data
      const response = await api.get(`/backpack/items/${item._id}/details`);
      
      if (onUseItem) {
        await onUseItem(item, response.data.data.item);
      }

      // Show success animation
      setSuccessAnimations((prev) => new Set(prev).add(item._id.toString()));

      toast.success("Item used successfully!", {
        description: `${item.itemType} has been added to your project`,
        duration: 3000,
      });

      setTimeout(() => {
        setSuccessAnimations((prev) => {
          const newSet = new Set(prev);
          newSet.delete(item._id.toString());
          return newSet;
        });
      }, 2000);
    } catch (error) {
      toast.error("Failed to use item", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        duration: 4000,
      });
    } finally {
      setUsingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item._id.toString());
        return newSet;
      });
    }
  };

  const BackpackItemCard: React.FC<{ item: BackpackItem }> = ({ item }) => {
    const isUsing = usingIds.has(item._id.toString());
    const showSuccess = successAnimations.has(item._id.toString());
    const isFavouriting = favouritingIds.has(item._id.toString());
    const showFavouriteAnimation = favouriteAnimations.has(item._id.toString());

    return (
      <div
        className={`relative bg-zinc-800 rounded-lg overflow-hidden cursor-pointer group hover:bg-zinc-800 transition-all duration-200 ${
          showSuccess ? "shadow-sm shadow-green-500/20 ring-1 ring-green-500/30" : "hover:shadow-lg"
        }`}
      >
        <div className="flex items-center p-1">
          {/* Thumbnail - You might want to fetch actual thumbnail from the asset/template */}
          <div className="flex-shrink-0 h-16 aspect-video bg-zinc-800 rounded-md flex items-center justify-center relative overflow-hidden">
            <div className="text-zinc-500">
              {item.itemType === BackpackItemType.ASSET ? (
                <FileVideo className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </div>
            
            {/* Item Type Badge */}
            <div className="absolute top-1 left-1 bg-zinc-700 bg-opacity-80 rounded-xs text-white text-[8px] px-1 py-0.5 leading-none uppercase">
              {item.itemType}
            </div>
          </div>

          {/* Item Info */}
          <div className="flex-1 px-2.5 min-w-0 overflow-hidden">
            {/* Header with Favourite and Use button */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {/* Favourite Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavouriteItem(item);
                  }}
                  disabled={isFavouriting}
                  className={`relative flex-shrink-0 flex items-center justify-center w-4 h-4 rounded transition-all duration-200 ${
                    item.favourite
                      ? "text-yellow-500 hover:text-yellow-600"
                      : "text-white hover:text-yellow-400 hover:bg-yellow-500/10"
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

                {/* Source Badge */}
                <span className="text-[9px] text-zinc-400 bg-zinc-700 px-1 py-0.5 rounded capitalize flex-shrink-0">
                  {item.source.replace('_', ' ')}
                </span>
              </div>

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
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseItem(item);
                    }}
                    className="bg-zinc-300 hover:bg-zinc-200 rounded-sm flex items-center justify-center transition-all duration-200 py-0 px-1"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Download className="w-2.5 h-2.5 text-black" />
                      <span className="text-[10px] text-black font-medium">
                        Use
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            {item.notes && (
              <p className="text-[10px] text-zinc-300 mb-1 line-clamp-2 leading-tight">
                {item.notes}
              </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-1">
              {item.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-0.5 bg-zinc-700 text-zinc-300 text-[9px] px-1.5 py-0.5 rounded-full"
                >
                  <Tag className="w-2 h-2" />
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="text-[9px] text-zinc-500">
                  +{item.tags.length - 3} more
                </span>
              )}
            </div>

            {/* Footer with date and source info */}
            <div className="flex items-center justify-between text-[9px] text-zinc-400">
              {/* <span>Added {formatDate(item.addedAt)}</span> */}
              <span className="capitalize">{item.source.replace('_', ' ')}</span>
            </div>
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

  if (isLoading) {
    return <BeautifulLoader />;
  }

  return (
    <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by notes or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors"
          />
        </div>

        {/* Type Filter Tabs */}
        <div className="flex bg-zinc-800 rounded-lg p-1 mb-2">
          <button
            onClick={() => setSelectedType("all")}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedType === "all"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedType(BackpackItemType.ASSET)}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedType === BackpackItemType.ASSET
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Assets
          </button>
          <button
            onClick={() => setSelectedType(BackpackItemType.TEMPLATE)}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedType === BackpackItemType.TEMPLATE
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Templates
          </button>
        </div>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {allTags.slice(0, 5).map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTags(prev =>
                    prev.includes(tag)
                      ? prev.filter(t => t !== tag)
                      : [...prev, tag]
                  );
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-white text-black"
                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                }`}
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </button>
            ))}
            {allTags.length > 5 && (
              <span className="text-xs text-zinc-500 self-center">
                +{allTags.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2 mb-8">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <BackpackItemCard key={item._id.toString()} item={item} />
            ))
          ) : (
            <div className="text-center text-zinc-500 mt-6">
              <div className="text-2xl mb-2">🎒</div>
              <p className="text-xs">
                No {selectedType === "all" ? "" : selectedType.toLowerCase()} items found
                {selectedTags.length > 0 && " with selected tags"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950">
        <div className="text-[10px] text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>Total Items:</span>
            <span className="text-white">{backpack?.totalItems || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Favourites:</span>
            <span className="text-white">
              {items.filter(item => item.favourite).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Total Size:</span>
            <span className="text-white">
              {formatFileSize(backpack?.totalBytes || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackpackComponent;