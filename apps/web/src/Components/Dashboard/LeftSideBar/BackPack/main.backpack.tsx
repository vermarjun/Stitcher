import React, { useState, useEffect } from "react";
import { Search, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  type IBackpack as Backpack,
  type IBackpackItem as BackpackItem,
} from "@/Components/Home/Backpack/main.backpack";
import api from "@/api";
import BeautifulLoader from "@/Components/LoadingScreens/Templatestore.loader";
import BackpackItemCard, { BackpackItemType } from "./Card.backpack";
import type { Project } from "@/State/Types";

interface BackpackProps {
  currentProject?: Project;
}

const BackpackComponent: React.FC<BackpackProps> = ({ currentProject }) => {
  const [backpack, setBackpack] = useState<Backpack | null>(null);
  const [items, setItems] = useState<BackpackItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<BackpackItemType | "all">(
    "all"
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [usingIds, setUsingIds] = useState<Set<string>>(new Set());
  const [successAnimations, setSuccessAnimations] = useState<Set<string>>(
    new Set()
  );
  const [favouritingIds, setFavouritingIds] = useState<Set<string>>(new Set());
  const [favouriteAnimations, setFavouriteAnimations] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Filter items based on search, type, tags, and favourite status
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesType =
      selectedType === "all" || item.itemType === selectedType;

    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => item.tags.includes(tag));

    return matchesSearch && matchesType && matchesTags;
  });

  async function fetchBackpack() {
    try {
      setIsLoading(true);
      const response = await api.get(`/backpack/${currentProject?._id}`);

      if (response.status === 200 || response.status === 201) {
        setBackpack((response.data as any).backpack);
        setItems((response.data as any).backpack.items || []);

        // Extract all unique tags
        const tags = new Set<string>();
        (response.data as any).backpack.items?.forEach((item: BackpackItem) => {
          item.tags.forEach((tag) => tags.add(tag));
        });
        setAllTags(Array.from(tags));
      } else {
        throw new Error("Failed to fetch backpack");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch backpack";
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
      const response = await api.patch(
        `/backpack/items/${item._id}/favourite`,
        {
          favourite: !item.favourite,
        }
      );

      if (!(response.data as any).success) {
        throw new Error("Network connection failed. Please try again.");
      } else {
        toast.success((response.data as any).message);
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
        setFavouriteAnimations((prev) =>
          new Set(prev).add(item._id.toString())
        );

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
        description:
          error instanceof Error
            ? error.message
            : "Failed to update favourite status",
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

  const handleImportItemToProject = async (item: BackpackItem) => {
    console.log("currentProject: ", currentProject);
    setUsingIds((prev) => new Set(prev).add(item._id.toString()));
    try {
      const response = await api.post(
        `/backpack/items/${item._id}/addtoproject`,
        {
          projectId: currentProject?._id,
        }
      );

      if ((response.data as any).success) {
        // Show success animation
        setSuccessAnimations((prev) => new Set(prev).add(item._id.toString()));

        toast.success("Item added to AssetStash successfully!", {
          description: `${item.itemType} has been added to your project`,
          duration: 3000,
        });

        item.isAddedToProject = true;

        setTimeout(() => {
          setSuccessAnimations((prev) => {
            const newSet = new Set(prev);
            newSet.delete(item._id.toString());
            return newSet;
          });
        }, 2000);
      } else {
        throw new Error((response.data as any).message);
      }
    } catch (error:any) {
        console.log(error)
      toast.error("Failed to use item", {
        description: error.response?.data.message,
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
                  setSelectedTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
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
              <BackpackItemCard
                key={item._id.toString()}
                item={item}
                isUsing={usingIds.has(item._id.toString())}
                isFavouriting={favouritingIds.has(item._id.toString())}
                showSuccess={successAnimations.has(item._id.toString())}
                showFavouriteAnimation={favouriteAnimations.has(
                  item._id.toString()
                )}
                onFavourite={handleFavouriteItem}
                handleImportItemToProject={handleImportItemToProject}
              />
            ))
          ) : (
            <div className="text-center text-zinc-500 mt-6">
              <div className="text-2xl mb-2">🎒</div>
              <p className="text-xs">
                No {selectedType === "all" ? "" : selectedType.toLowerCase()}{" "}
                items found
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
              {items.filter((item) => item.favourite).length}
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
