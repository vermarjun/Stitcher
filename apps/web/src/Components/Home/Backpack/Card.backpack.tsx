import { useState, useRef, useEffect } from "react";
import { Heart, Trash2, MoreVertical, Play, Share2 } from "lucide-react";
import AudioPlayerModal from "./AudioPlayerModal.backpack";
import VideoPlayerModal from "./VideoPlayerModal.backpack";

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
  const [showMenu, setShowMenu] = useState(false);
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<HTMLDivElement>(null);

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
      setShowMenu(false);
      setIsVideoPlayerVisible(true);
    } else if (itemData.type === "audio") {
      setShowMenu(false);
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
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
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

          {/* File Size Badge */}
          {itemData.bytes && (
            <div className="absolute bottom-3 left-3 bg-black/80 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
              <span>{(itemData.bytes / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          )}

          {/* Menu Button */}
          <div className="absolute top-3 right-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="bg-black/60 hover:bg-black/80 rounded-full p-2 transition-all duration-200 backdrop-blur-sm"
            >
              <MoreVertical className="h-4 w-4 text-white" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-10 overflow-hidden">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreatePost(item);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                >
                  <Share2 className="h-4 w-4" />
                  Create Community Post
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item._id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete from Backpack
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Item Info */}
        <div className="w-full">
          <div className="px-4 py-3 w-full flex justify-between items-center border-b border-zinc-700">
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item._id);
              }}
              className="cursor-pointer w-fit flex justify-center items-center gap-2"
            >
              <button className="flex items-center justify-center rounded-full p-2 hover:bg-zinc-700 transition-colors text-zinc-200 gap-2">
                <Heart
                  className={`h-5 w-5 ${
                    item.favourite
                      ? "fill-red-500 text-red-500"
                      : "text-zinc-200 hover:text-red-400"
                  }`}
                />
              </button>
              {item.favourite ? (
                <p className="text-xs text-red-400">Favourite</p>
              ) : (
                <p className="text-xs text-zinc-400">Mark Favourite</p>
              )}
            </div>
            <div className="flex items-center w-fit gap-2">
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreatePost(item);
                    setShowMenu(false);
                  }}
                  className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded-lg gap-2 justify-center w-fit text-left text-xs text-zinc-200 transition-colors flex items-center"
                >
                  <p className="text-xs">Community</p>
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
              {/* <div className="flex justify-center items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item._id);
                    setShowMenu(false);
                  }}
                  className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded-lg gap-2 justify-center w-fit text-left text-xs text-zinc-200 transition-colors flex items-center"
                >
                  <p className="text-xs">Remove</p>
                  <X className="h-4 w-4" />
                </button>
              </div> */}
            </div>
          </div>
          <div className="p-4">
            {/* Title */}
            <h3 className="text-sm font-medium text-white mb-2 line-clamp-2 group-hover:text-zinc-300 transition-colors">
              {getDisplayName()}
            </h3>
            <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed mb-3">
              {getDisplayDescription()}
            </p>

            {/* Tags */}
            {item.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {item.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-block bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full border border-blue-500/30"
                  >
                    #{tag}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="inline-block bg-zinc-700/50 text-zinc-400 text-xs px-3 py-1 rounded-full">
                    +{item.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {item.notes && (
              <div className="bg-zinc-700/30 rounded-lg p-3">
                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                  {item.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BackpackItemCard;