import { useState, useRef, useEffect } from "react";
import { Heart, Play, Share2, X, Loader2, MoreVertical } from "lucide-react";
import AudioPlayerModal from "./AudioPlayerModal.backpack";
import VideoPlayerModal from "./VideoPlayerModal.backpack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";

export interface MediaPlayerCommonProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  duration?: number;
  fileSize: number;
  mediaUrl: string;
  formatDuration: (seconds?: number) => string;
  formatBytes: (bytes: number) => string;
}

// Audio Player specific interfaces
export interface AudioPlayerProps extends MediaPlayerCommonProps {
  // State values
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  volume: number;

  // Refs
  audioRef: React.RefObject<HTMLAudioElement>;
  progressBarRef: React.RefObject<HTMLDivElement>;

  // Handlers
  togglePlayPause: () => void;
  handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  setVolume: (volume: number) => void;
}

// Video Player specific interfaces
export interface VideoPlayerProps extends MediaPlayerCommonProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoPlayerRef: React.RefObject<HTMLDivElement>;
}

// Item Data interface (common properties used by both players)
export interface MediaItemData {
  _id: string;
  url: string;
  bytes: number;
  duration?: number;
  type: "video" | "audio";
  // For display purposes
  name?: string;
  title?: string;
  scene_name?: string;
  scene_description?: string;
  post_description?: string;
}

// Utility function types
export interface MediaUtilityFunctions {
  formatDuration: (seconds?: number) => string;
  formatBytes: (bytes: number) => string;
  getDisplayName: () => string;
  getDisplayDescription: () => string | undefined;
}

interface IAsset {
  _id: string;
  name: string;
  type: "video" | "audio";
  url: string;
  scene_name: string;
  scene_description: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
  metadata: Record<string, any>;
  projectId: string;
  isOnTimeline: boolean;
  originalTemplateId?: string;
}

interface ITemplate {
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

interface IBackpackItem {
  _id: string;
  itemType: "Asset" | "Template";
  itemId: IAsset | ITemplate;
  favourite: boolean;
  source: "project" | "community_post" | "template_library";
  sourceId?: string;
  tags: string[];
  notes?: string;
  addedAt: string;
}

interface BackpackItemCardProps {
  item: IBackpackItem;
  onToggleFavorite: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onCreatePost: (item: IBackpackItem) => void;
  formatCount: (count: number) => string;
  formatDuration: (seconds?: number) => string;
}

const BackpackItemCard = ({
  item,
  onToggleFavorite,
  onDelete,
  onCreatePost,
  formatDuration,
}: BackpackItemCardProps) => {
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFavouriteLoading, setIsFavouriteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<HTMLDivElement>(null);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavouriteLoading(true);

    try {
      await onToggleFavorite(item._id);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setIsFavouriteLoading(false);
    }
  };

  const getItemData = () => {
    if (item.itemType === "Asset") {
      return item.itemId as IAsset;
    }
    return item.itemId as ITemplate;
  };

  const getDisplayName = () => {
    if (item.itemType === "Asset") {
      return (itemData as IAsset).scene_name || (itemData as IAsset).name;
    }
    return (itemData as ITemplate).title;
  };

  const getDisplayDescription = () => {
    if (item.itemType === "Asset") {
      return (itemData as IAsset).scene_description;
    }
    return (itemData as ITemplate).post_description;
  };

  const itemData = getItemData();

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item._id);
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle share with community from dropdown
  const handleShareWithCommunity = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreatePost(item);
  };

  // Handle remove from backpack from dropdown
  const handleRemoveFromBackpack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  // Audio player effects
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const updateTime = () => setCurrentTime(audioElement.currentTime);
    const updateDuration = () => setDuration(audioElement.duration);
    const handleEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audioElement.addEventListener("timeupdate", updateTime);
    audioElement.addEventListener("loadedmetadata", updateDuration);
    audioElement.addEventListener("ended", handleEnd);

    return () => {
      audioElement.removeEventListener("timeupdate", updateTime);
      audioElement.removeEventListener("loadedmetadata", updateDuration);
      audioElement.removeEventListener("ended", handleEnd);
    };
  }, [isAudioPlayerVisible]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Video player intersection observer
  useEffect(() => {
    if (!videoPlayerRef.current || !videoRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(videoPlayerRef.current);
    return () => observer.disconnect();
  }, [isVideoPlayerVisible]);

  const handleCardClick = () => {
    if (itemData.type === "video") {
      setIsVideoPlayerVisible(true);
    } else if (itemData.type === "audio") {
      setIsAudioPlayerVisible(true);
      setIsPlaying(true);
    }
  };

  const closeVideoPlayer = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsVideoPlayerVisible(false);
  };

  const closeAudioPlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsAudioPlayerVisible(false);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && progressBarRef.current) {
      const progressBar = progressBarRef.current;
      const clickPosition =
        e.clientX - progressBar.getBoundingClientRect().left;
      const progressBarWidth = progressBar.offsetWidth;
      const newTime = (clickPosition / progressBarWidth) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <>
      {/* Delete Confirmation Modal */}
      <Dialog
        open={showDeleteModal}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelDelete();
          }
        }}
      >
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              Remove Item?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm pt-2">
              Are you sure you want to remove this item from your backpack? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audio Player Modal */}
      {isAudioPlayerVisible && (
        <AudioPlayerModal
          isOpen={isAudioPlayerVisible}
          onClose={closeAudioPlayer}
          title={getDisplayName()}
          description={getDisplayDescription()}
          duration={itemData.duration}
          fileSize={itemData.bytes}
          mediaUrl={itemData.url}
          formatDuration={formatDuration}
          formatBytes={formatBytes}
          isPlaying={isPlaying}
          currentTime={currentTime}
          volume={volume}
          audioRef={audioRef as React.RefObject<HTMLAudioElement>}
          progressBarRef={progressBarRef as React.RefObject<HTMLDivElement>}
          togglePlayPause={togglePlayPause}
          handleProgressClick={handleProgressClick}
          setVolume={setVolume}
        />
      )}

      {/* Video Player Modal */}
      {isVideoPlayerVisible && (
        <VideoPlayerModal
          isOpen={isVideoPlayerVisible}
          onClose={closeVideoPlayer}
          title={getDisplayName()}
          description={getDisplayDescription()}
          duration={itemData.duration}
          fileSize={itemData.bytes}
          mediaUrl={itemData.url}
          formatDuration={formatDuration}
          formatBytes={formatBytes}
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          videoPlayerRef={videoPlayerRef as React.RefObject<HTMLDivElement>}
        />
      )}

      {/* Main Card Component */}
      <div
        className="group cursor-pointer bg-zinc-800 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all duration-300"
        onClick={handleCardClick}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-zinc-700 rounded-t-xl overflow-hidden">
          <img
            src={itemData.thumbnail}
            alt={itemData._id}
            className="w-full h-full rounded-t-2xl object-cover"
          />

          {/* Three Dot Menu Button - Top Right */}
          <div className="absolute top-3 right-3 z-10 text-white">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="bg-zinc-800 hover:bg-zinc-700 cursor-pointer text-white p-1.5 rounded-full"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border border-zinc-700 rounded-lg w-60 absolute right-0 text-white">
                <DropdownMenuItem
                  onClick={handleShareWithCommunity}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-white cursor-pointer"
                >
                  <Share2 className="h-4 w-4" />
                  Share with community
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleRemoveFromBackpack}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 hover:text-red-300 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Remove from backpack
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex rounded-xl items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="bg-white rounded-full p-3 shadow-lg">
              <Play className="h-5 w-5 text-black fill-current" />
            </div>
          </div>

          {/* Duration Badge */}
          {itemData.duration && (
            <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
              {formatDuration(itemData.duration)}
            </div>
          )}

          {/* Add to Favorites Button - Bottom Left Overlay */}
          <div className="absolute bottom-3 left-3">
            <button
              onClick={handleToggleFavorite}
              className="bg-white/20 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
            >
              {isFavouriteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  className={`h-5 w-5 ${
                    item.favourite
                      ? "fill-red-400 text-red-500"
                      : "text-zinc-200 hover:text-red-400"
                  }`}
                />
              )}
            </button>
          </div>
        </div>

        {/* Item Info */}
        <div className="w-full p-3">
          {/* Title and Bytes in flex container */}
          <div className="w-full flex justify-between items-center">
            <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-zinc-300 transition-colors flex-1 pr-2">
              {getDisplayName()}
            </h3>
            <div className="bg-black/20 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm whitespace-nowrap">
              <span>{(itemData.bytes / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          </div>

          {/* Description */}
          <div className="">
            <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed mt-2">
              {getDisplayDescription()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default BackpackItemCard;
