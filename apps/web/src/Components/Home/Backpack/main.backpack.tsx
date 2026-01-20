import React, { useState, useEffect, useCallback } from "react";
import { Search, FolderHeart } from "lucide-react";
import { Input } from "@/Components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { Skeleton } from "@/Components/ui/skeleton";
import api from "@/api";
import BackpackItemCard from "./Card.backpack";
import CreatePostModal from "./CreatePostModal.backpack";

export interface IAsset {
  _id: string;
  name: string;
  type: "video" | "audio";
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
  metadata: Record<string, any>;
  projectId: string;
  isOnTimeline: boolean;
  originalTemplateId?: string;
  scene_name: string;
  scene_description: string;
}

export interface ITemplate {
  _id: string;
  title: string;
  post_description?: string;
  type: "video" | "audio";
  thumbnail: string;
  url: string;
  duration?: number;
  scene_name?: string;
  scene_description?: string;
  code?: string;
  bytes: number;
  metadata: Record<string, any>;
  likesCount?: number;
  isLikedByUser?: boolean;
}

export interface IBackpackItem {
  _id: string;
  itemType: "Asset" | "Template";
  itemId: IAsset | ITemplate;
  favourite: boolean;
  source: "project" | "community_post" | "template_library";
  sourceId?: string;
  tags: string[];
  notes?: string;
  addedAt: string;
  isAddedToProject?: boolean;
}

export interface IBackpack {
  _id: string;
  userId: string;
  items: IBackpackItem[];
  totalItems: number;
  totalBytes: number;
  createdAt: string;
  updatedAt: string;
}

// Helper function to get the display name from either Asset or Template
const getItemName = (item: IAsset | ITemplate): string => {
  if ("name" in item && item.name) return item.name;
  if ("title" in item && item.title) return item.title;
  return "";
};

const BackpackPage: React.FC = () => {
  const [backpack, setBackpack] = useState<IBackpack | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "assets" | "templates" | "favorites"
  >("all");
  const [sortBy, setSortBy] = useState<"addedAt" | "name" | "size">("addedAt");
  const [createPostModalOpen, setCreatePostModalOpen] = useState(false);
  const [selectedItemForPost, setSelectedItemForPost] =
    useState<IBackpackItem | null>(null);

  const fetchBackpack = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/backpack`);
      if ((response.data as any).success) {
        setBackpack((response.data as any).backpack);
      }
    } catch (error) {
      console.error("Failed to fetch backpack:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackpack();
  }, [fetchBackpack]);

  const handleToggleFavorite = async (itemId: string) => {
    try {
      console.log("check1");
      const response = await api.patch(`/backpack/items/${itemId}/favorite`);
      console.log("check2", response);
      if ((response.data as any).success) {
        setBackpack((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((item) =>
                  item._id === itemId
                    ? { ...item, favourite: !item.favourite }
                    : item
                ),
              }
            : null
        );
      }
    } catch (error) {
      console.log("check2", error);
      console.error("Failed to toggle favorite:", error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await api.delete(`/backpack/items/${itemId}`);
      if ((response.data as any).success) {
        setBackpack((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((item) => item._id !== itemId),
                totalItems: prev.totalItems - 1,
              }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const handleCreatePost = async (item: IBackpackItem) => {
    setSelectedItemForPost(item);
    setCreatePostModalOpen(true);
  };

  const handleSubmitPost = async (postData: {
    title: string;
    description: string;
    tags: string[];
  }) => {
    if (!selectedItemForPost) return;
    try {
      const response = await api.post<any>("/community/posts", {
        assetId: selectedItemForPost.itemId._id,
        ...postData,
      });
      if ((response.data as any).success) {
        // Post created successfully
        console.log("Post created:", (response.data as any).data);
      }
    } catch (error) {
      console.error("Failed to create post:", error);
      throw error;
    }
  };

  // Filter and search items
  const filteredItems =
    backpack?.items.filter((item) => {
      if (!item.itemId) return false;

      const itemName = getItemName(item.itemId);

      // Search filter
      const matchesSearch =
        itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType =
        filter === "all" ||
        (filter === "assets" && item.itemType === "Asset") ||
        (filter === "templates" && item.itemType === "Template") ||
        (filter === "favorites" && item.favourite);

      return matchesSearch && matchesType;
    }) || [];

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return getItemName(a.itemId).localeCompare(getItemName(b.itemId));
      case "size":
        return (b.itemId.bytes || 0) - (a.itemId.bytes || 0);
      case "addedAt":
      default:
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
  });

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-transparent">
          <Skeleton className="w-full aspect-video bg-zinc-800 rounded-xl mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 bg-zinc-800 rounded-full" />
            <Skeleton className="h-3 w-1/2 bg-zinc-800 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-800 h-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-xl font-bold text-white tracking-tight shrink-0">
              My Backpack
            </h1>
            <div className="relative flex-1 max-w-sm hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-emerald-500/50 rounded-full h-9 text-sm transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
             {/* Mobile Search Trigger (Optional, or just show filters directly) - keeping simple for now */}
            
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                <SelectTrigger className="w-[110px] sm:w-[140px] bg-zinc-900/50 border-zinc-800 text-zinc-200 h-9 rounded-lg text-xs sm:text-sm focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  <SelectItem value="all" className="text-zinc-200 focus:bg-zinc-900 focus:text-white cursor-pointer">All Items</SelectItem>
                  <SelectItem value="assets" className="text-zinc-200 focus:bg-zinc-900 focus:text-white cursor-pointer">Assets</SelectItem>
                  <SelectItem value="templates" className="text-zinc-200 focus:bg-zinc-900 focus:text-white cursor-pointer">Templates</SelectItem>
                  <SelectItem value="favorites" className="text-zinc-200 focus:bg-zinc-900 focus:text-white cursor-pointer">Favorites</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[110px] sm:w-[140px] bg-zinc-900/50 border-zinc-800 text-zinc-200 h-9 rounded-lg text-xs sm:text-sm focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  <SelectItem value="addedAt" className="text-zinc-200 focus:bg-zinc-900 focus:text-white cursor-pointer">Recently Added</SelectItem>
                  <SelectItem value="name" className="text-zinc-200 focus:bg-zinc-900 focus:text-white cursor-pointer">Name</SelectItem>
                  <SelectItem value="size" className="text-zinc-200 focus:bg-zinc-900 focus:text-white cursor-pointer">Size</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {backpack && (
              <div className="hidden sm:block w-px h-6 bg-zinc-800 mx-2" />
            )}
            
            {backpack && (
              <div className="hidden sm:block text-xs font-medium text-zinc-500">
                {formatCount(backpack.totalItems)} items
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Filters and Sorting */}

        {/* Items Grid */}
        {loading ? (
          renderSkeleton()
        ) : sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400">
            <FolderHeart className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {searchQuery || filter !== "all"
                ? "No items found"
                : "Your backpack is empty"}
            </p>
            <p className="text-sm mt-2">
              {searchQuery || filter !== "all"
                ? "Try adjusting your search or filters"
                : "Add assets or templates from projects or community"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedItems.map((item) => (
              <BackpackItemCard
                key={item._id}
                item={item}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeleteItem}
                onCreatePost={handleCreatePost}
                formatCount={formatCount}
                formatDuration={formatDuration}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={createPostModalOpen}
        onClose={() => {
          setCreatePostModalOpen(false);
          setSelectedItemForPost(null);
        }}
        selectedItem={selectedItemForPost}
        onCreatePost={handleSubmitPost}
      />
    </div>
  );
};

export default BackpackPage;
