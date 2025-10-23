import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart,
  Clock,
  FileAudio,
  FileVideo,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  X,
  Pause,
  Volume2,
  Backpack,
  Check,
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { Skeleton } from "@/Components/ui/skeleton";
import api from "@/api";
import { toast } from "sonner";

enum TemplateType {
  VIDEO = "video",
  AUDIO = "audio",
}

interface ITemplate {
  _id: string;
  title: string;
  post_description?: string;
  type: TemplateType;
  thumbnail?: string;
  url: string;
  duration?: number;
  bytes: number;
  metadata: Record<string, any>;
  likesCount?: number;
  isLikedByUser?: boolean;
  isInProject?: boolean;
  projectAssetId?: string;
  isAddedToBackpack?: Boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const TemplateGallery: React.FC = () => {
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<TemplateType | "all">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "likesCount" | "name">(
    "likesCount"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(
    new Set()
  );
  const [playingVideo, setPlayingVideo] = useState<ITemplate | null>(null);
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<ITemplate | null>(null);
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoPlayerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
        isAddedToBackpackAttach: true,
      };
      if (searchQuery) params.search = searchQuery;
      if (selectedType !== "all") params.type = selectedType;
      const response = await api.get("/template", { params });
      if (response.data.success) {
        setTemplates(response.data.data.templates);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchQuery,
    selectedType,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchQuery, selectedType, sortBy, sortOrder]);

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
  }, [playingVideo]);

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
  }, [playingAudio]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handlePlayVideo = (template: ITemplate) => {
    if (template.type === TemplateType.VIDEO) {
      setPlayingVideo(template);
      setIsVideoPlayerVisible(true);
    } else if (template.type === TemplateType.AUDIO) {
      setPlayingAudio(template);
      setIsAudioPlayerVisible(true);
      setIsPlaying(true);
    }
  };

  const closeVideoPlayer = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setPlayingVideo(null);
    setIsVideoPlayerVisible(false);
  };

  const closeAudioPlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingAudio(null);
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

  const handleSaveToBackPack = async (template: ITemplate) => {
    try {
      const response = await api.post("/backpack/items", {
        itemType: "Template",
        itemId: template._id,
        source: "template_library",
        sourceId: template._id,
        favourite: false,
        tags: [],
        notes: "",
      });
      if (response.data.success == true) {
        toast.success("Successfully added template to backpack");
      } else {
        throw Error("Error came in saving template item to backpack");
      }
    } catch (e: any) {
      toast.error(e.message || "Error saving tempalte to backpack");
    }
  };

  const handleLikeToggle = async (templateId: string) => {
    try {
      const template = templates.find((t) => t._id === templateId);
      if (!template) return;
      await api.post(`/template/${templateId}/like`);
      setTemplates((prev) =>
        prev.map((t) =>
          t._id === templateId
            ? {
                ...t,
                isLikedByUser: !t.isLikedByUser,
                likesCount: t.isLikedByUser
                  ? (t.likesCount || 1) - 1
                  : (t.likesCount || 0) + 1,
              }
            : t
        )
      );
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const handleImageError = (templateId: string) => {
    setImageLoadErrors((prev) => new Set([...prev, templateId]));
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="bg-zinc-800 rounded-xl overflow-hidden">
          <Skeleton className="w-full aspect-video bg-zinc-700 rounded-t-xl" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4 bg-zinc-700 rounded-full" />
            <Skeleton className="h-3 w-1/2 bg-zinc-700 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Audio Player Overlay */}
      {isAudioPlayerVisible && playingAudio && (
        <div className="fixed px-4 left-1/2 transform -translate-x-1/2 w-full bottom-4 flex justify-center items-center z-50">
          <div className="relative bg-zinc-900 w-full max-w-4xl rounded-lg shadow-2xl border border-zinc-800">
            <div className="p-4">
              <Button
                onClick={closeAudioPlayer}
                className="absolute top-2 right-2 z-10 bg-zinc-800/80 hover:bg-zinc-700/90 text-white rounded-full p-1 backdrop-blur-md transition-all duration-200 hover:scale-105"
                size="icon"
                aria-label="Close audio player"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-zinc-800 to-zinc-700 rounded-md flex items-center justify-center mr-3">
                  <FileAudio className="h-6 w-6 text-zinc-400" />
                </div>
                <div className="flex-grow overflow-hidden">
                  <h3 className="text-sm font-medium text-white truncate">
                    {playingAudio.title}
                  </h3>
                  {playingAudio.post_description && (
                    <p className="text-xs text-zinc-400 truncate">
                      {playingAudio.post_description}
                    </p>
                  )}
                  <div className="flex items-center text-xs text-zinc-500 mt-1">
                    <span className="mr-3">
                      {formatBytes(playingAudio.bytes)}
                    </span>
                    {playingAudio.duration && (
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(playingAudio.duration)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  onClick={togglePlayPause}
                  className="bg-white hover:bg-zinc-200 text-black rounded-full h-8 w-8 p-0 flex items-center justify-center"
                  size="icon"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  )}
                </Button>
                <div className="flex-grow mx-4">
                  <div
                    ref={progressBarRef}
                    className="h-1.5 bg-zinc-800 rounded-full cursor-pointer"
                    onClick={handleProgressClick}
                  >
                    <div
                      className="h-full bg-white rounded-full relative"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    >
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(duration)}</span>
                  </div>
                </div>
                <div className="flex items-center">
                  <Volume2 className="h-4 w-4 text-zinc-400 mr-2" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 accent-white"
                  />
                </div>
              </div>
            </div>
            <audio ref={audioRef} src={playingAudio.url} autoPlay={isPlaying} />
          </div>
        </div>
      )}

      {/* Video Player Overlay */}
      {isVideoPlayerVisible && playingVideo && (
        <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={videoPlayerRef}
            className="relative w-full max-w-4xl mx-auto"
          >
            <div className="bg-zinc-900 rounded-lg overflow-hidden shadow-2xl border border-zinc-800">
              <div className="relative">
                <video
                  ref={videoRef}
                  src={playingVideo.url}
                  controls
                  autoPlay
                  className="w-full object-cover"
                  onError={() => console.error("Video failed to load")}
                />
              </div>
              <Button
                onClick={closeVideoPlayer}
                className="absolute top-2 right-2 z-10 bg-zinc-800/80 hover:bg-zinc-700/90 text-white rounded-full p-1.5 backdrop-blur-md transition-all duration-200 hover:scale-105"
                size="icon"
                aria-label="Close video player"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="p-4">
                <h3 className="text-sm font-medium text-white mb-2 line-clamp-1">
                  {playingVideo.title}
                </h3>
                {playingVideo.post_description && (
                  <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                    {playingVideo.post_description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 bg-zinc-800/60 px-2 py-1 rounded-full">
                    {formatBytes(playingVideo.bytes)}
                  </span>
                  {playingVideo.duration && (
                    <span className="flex items-center gap-1 text-zinc-400 bg-zinc-800/60 px-2 py-1 rounded-full">
                      <Clock className="h-3 w-3" />
                      {formatDuration(playingVideo.duration)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Filters */}
      <div className="sticky top-0 z-10 bg-black border-b border-zinc-800 h-14">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 focus:border-zinc-600 text-xs h-8 rounded-lg"
              />
            </div>
            <div className="flex gap-2 items-center w-full md:w-auto">
              <Select
                value={selectedType}
                onValueChange={(v) =>
                  setSelectedType(v as TemplateType | "all")
                }
              >
                <SelectTrigger className="w-28 bg-zinc-900 border-zinc-800 text-white text-xs h-8 rounded-lg">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 rounded-lg">
                  <SelectItem
                    value="all"
                    className="text-white hover:bg-zinc-800 text-xs rounded-md"
                  >
                    All Types
                  </SelectItem>
                  <SelectItem
                    value={TemplateType.VIDEO}
                    className="text-white hover:bg-zinc-800 text-xs rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <FileVideo className="h-3.5 w-3.5" />
                      Video
                    </div>
                  </SelectItem>
                  <SelectItem
                    value={TemplateType.AUDIO}
                    className="text-white hover:bg-zinc-800 text-xs rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <FileAudio className="h-3.5 w-3.5" />
                      Audio
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortBy}
                onValueChange={(v) =>
                  setSortBy(v as "createdAt" | "likesCount" | "name")
                }
              >
                <SelectTrigger className="w-32 bg-zinc-900 border-zinc-800 text-white text-xs h-8 rounded-lg">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 rounded-lg">
                  <SelectItem
                    value="createdAt"
                    className="text-white hover:bg-zinc-800 text-xs rounded-md"
                  >
                    Latest
                  </SelectItem>
                  <SelectItem
                    value="likesCount"
                    className="text-white hover:bg-zinc-800 text-xs rounded-md"
                  >
                    Most Liked
                  </SelectItem>
                  <SelectItem
                    value="name"
                    className="text-white hover:bg-zinc-800 text-xs rounded-md"
                  >
                    Name
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                className="text-white hover:bg-zinc-800 rounded-lg h-8 w-8"
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="container mx-auto px-4 py-6 md:mt-0 mt-6"
        ref={scrollContainerRef}
      >
        {loading ? (
          renderSkeleton()
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-zinc-400">
            <FileVideo className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">No templates found</p>
            <p className="text-xs mt-1">
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 auto-rows-max">
            {templates.map((template) => (
              <div
                key={template._id}
                className="bg-zinc-800 rounded-xl overflow-hidden group transition-all duration-200 hover:-translate-y-0.5"
                onMouseEnter={() => setHoveredCard(template._id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Video Thumbnail */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayVideo(template);
                  }}
                  className="relative cursor-pointer aspect-video bg-zinc-700 border border-zinc-800 rounded-t-xl overflow-hidden"
                >
                  {!imageLoadErrors.has(template._id) && template.thumbnail ? (
                    <img
                      src={template.thumbnail}
                      alt={template.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={() => handleImageError(template._id)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-700">
                      {template.type === TemplateType.VIDEO ? (
                        <FileVideo className="h-8 w-8 text-zinc-600" />
                      ) : (
                        <FileAudio className="h-8 w-8 text-zinc-600" />
                      )}
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Play Button Overlay */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                      hoveredCard === template._id ? "opacity-100" : "opacity-0"
                    } bg-black/40`}
                  >
                    <div className="bg-white rounded-full p-4">
                      <Play className="h-6 w-6 text-black fill-current" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  {template.duration && (
                    <div className="absolute bottom-2 right-2 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(template.duration)}
                    </div>
                  )}

                  {/* Type Badge */}
                  <div className="absolute bottom-2 left-2">
                    <div className=" text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      {template.type === TemplateType.VIDEO ? (
                        <FileVideo className="h-3 w-3" />
                      ) : (
                        <FileAudio className="h-3 w-3" />
                      )}
                      {template.type}
                    </div>
                  </div>

                  {/* Stats Overlay */}
                  {/* <div className="absolute bottom-2 left-2">
                    <div className="bg-zinc-700 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      <Heart
                        className={`h-3 w-3 ${
                          template.isLikedByUser ? "fill-white" : ""
                        }`}
                      />
                      {formatCount(template.likesCount || 0)}
                      <span className="text-[10px]">Likes</span>
                    </div>
                  </div> */}
                </div>

                {/* Post Info */}
                <div className="pb-4">
                  {/* File Size Info */}
                  <div className="px-3 flex justify-between items-center border-b border-zinc-600 mb-4 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikeToggle(template._id);
                      }}
                      className="flex hover:scale-105 cursor-pointer items-center justify-center gap-1.5 text-xs text-zinc-200 hover:text-white transition-colors"
                    >
                      <Heart
                        className={`h-5 w-5 transition-all ${
                          template.isLikedByUser
                            ? "fill-red-500 text-red-500"
                            : ""
                        }`}
                      />
                      {formatCount(template.likesCount || 0)} Likes
                    </button>
                    {!template.isAddedToBackpack ? (
                      <div>
                        <div
                          onClick={() => {
                            handleSaveToBackPack(template);
                          }}
                          className="bg-zinc-600 hover:scale-105 cursor-pointer px-2 py-1 rounded-full gap-2 text-xs text-zinc-200 flex justify-center items-center"
                        >
                          Save to backpack
                          <Backpack className="h-4 w-4" />
                        </div>
                      </div>
                    ) : (
                      <div
                          onClick={() => {
                            handleSaveToBackPack(template);
                          }}
                          className="bg-green-900/50 border border-green-800 hover:scale-100 cursor-pointer px-2 py-1 rounded-full gap-2 text-xs text-green-100 flex justify-center items-center"
                        >
                          Added to backpack
                          <Check className="h-4 w-4" />
                        </div>
                    )}
                  </div>

                  <div className="px-3">
                    {/* Title */}
                    <h3 className="text-sm font-medium text-white mb-2 line-clamp-2 group-hover:text-zinc-300 transition-colors">
                      {template.title}
                    </h3>
                    {template.post_description && (
                      <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed">
                        {template.post_description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              disabled={pagination.page === 1}
              className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 hover:text-white disabled:opacity-50 rounded-lg h-7 w-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="flex gap-1">
              {[...Array(Math.min(7, pagination.pages))].map((_, i) => {
                let pageNum;
                if (pagination.pages <= 7) {
                  pageNum = i + 1;
                } else if (pagination.page <= 4) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.pages - 3) {
                  pageNum = pagination.pages - 6 + i;
                } else {
                  pageNum = pagination.page - 3 + i;
                }
                if (pageNum < 1 || pageNum > pagination.pages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={
                      pageNum === pagination.page ? "default" : "outline"
                    }
                    size="icon"
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: pageNum }))
                    }
                    className={
                      pageNum === pagination.page
                        ? "bg-white text-black hover:bg-zinc-200 rounded-lg h-7 w-7 text-xs"
                        : "bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 hover:text-white rounded-lg h-7 w-7 text-xs"
                    }
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.min(prev.pages, prev.page + 1),
                }))
              }
              disabled={pagination.page === pagination.pages}
              className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 hover:text-white disabled:opacity-50 rounded-lg h-7 w-7"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <div className="mt-3 text-center text-xs text-zinc-500">
          Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} templates
        </div>
      </div>
    </div>
  );
};

export default TemplateGallery;
