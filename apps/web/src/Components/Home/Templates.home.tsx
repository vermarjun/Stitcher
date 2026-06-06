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
      const response = await api.get<any>("/template", { params });
      if ((response.data as any).success) {
        setTemplates((response.data as any).data.templates);
        setPagination((response.data as any).data.pagination);
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="bg-zinc-800 rounded-xl overflow-hidden">
          <Skeleton className="w-full aspect-video bg-zinc-900 rounded-t-xl" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4 bg-zinc-700 rounded-full" />
            <Skeleton className="h-3 w-1/2 bg-zinc-700 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-emerald-500/30">
      {/* Search & Header Section - Aligned with Sidebar */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800 h-16 transition-all duration-200">
        <div className="h-full container mx-auto px-3 lg:px-6">
          <div className="h-full flex items-center justify-between gap-2 md:gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors duration-200" />
              <Input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900/50 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:bg-zinc-900 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 h-9 rounded-lg transition-all duration-200 w-full text-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1.5 md:gap-3">
              {/* Mobile-only type toggle buttons */}
              <div className="flex md:hidden items-center gap-1 bg-zinc-900/50 p-0.5 rounded-lg border border-zinc-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType("all")}
                  className={`h-7 px-2 text-[10px] rounded-md transition-all duration-200 ${
                    selectedType === "all"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(TemplateType.VIDEO)}
                  className={`h-7 w-7 p-0 rounded-md transition-all duration-200 ${
                    selectedType === TemplateType.VIDEO
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <FileVideo className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(TemplateType.AUDIO)}
                  className={`h-7 w-7 p-0 rounded-md transition-all duration-200 ${
                    selectedType === TemplateType.AUDIO
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <FileAudio className="h-3 w-3" />
                </Button>
              </div>

              <div className="hidden md:flex items-center gap-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType("all")}
                  className={`h-7 px-3 text-xs rounded-md transition-all duration-200 ${
                    selectedType === "all"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(TemplateType.VIDEO)}
                  className={`h-7 px-3 text-xs rounded-md gap-1.5 transition-all duration-200 ${
                    selectedType === TemplateType.VIDEO
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <FileVideo className="h-3 w-3" />
                  Video
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(TemplateType.AUDIO)}
                  className={`h-7 px-3 text-xs rounded-md gap-1.5 transition-all duration-200 ${
                    selectedType === TemplateType.AUDIO
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <FileAudio className="h-3 w-3" />
                  Audio
                </Button>
              </div>

              <div className="h-6 w-px bg-zinc-800 hidden md:block" />

              <Select
                value={sortBy}
                onValueChange={(v) =>
                  setSortBy(v as "createdAt" | "likesCount" | "name")
                }
              >
                <SelectTrigger className="w-[110px] md:w-[140px] bg-zinc-900/50 border-zinc-800 text-zinc-300 text-xs h-9 rounded-lg hover:bg-zinc-900 hover:border-zinc-700 focus:ring-emerald-500/20 transition-all duration-200">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 rounded-lg shadow-xl shadow-black/50">
                  <SelectItem
                    value="createdAt"
                    className="text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800 text-xs cursor-pointer"
                  >
                    Latest Added
                  </SelectItem>
                  <SelectItem
                    value="likesCount"
                    className="text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800 text-xs cursor-pointer"
                  >
                    Most Popular
                  </SelectItem>
                  <SelectItem
                    value="name"
                    className="text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800 text-xs cursor-pointer"
                  >
                    Name (A-Z)
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                className="bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-zinc-700 h-9 w-9 rounded-lg transition-all duration-200"
              >
                {sortOrder === "asc" ? (
                  <span className="text-xs font-bold">↑</span>
                ) : (
                  <span className="text-xs font-bold">↓</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="container mx-auto px-3 lg:px-6 py-6 md:py-8"
        ref={scrollContainerRef}
      >
        {loading ? (
          renderSkeleton()
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-zinc-800">
              <Search className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No templates found</h3>
            <p className="text-sm text-zinc-500 max-w-sm text-center">
              We couldn't find any templates matching your search filters. Try adjusting your query.
            </p>
            <Button 
              variant="link" 
              className="mt-4 text-emerald-500 hover:text-emerald-400"
              onClick={() => {
                setSearchQuery("");
                setSelectedType("all");
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-6 pb-24 md:pb-20">
            {templates.map((template) => {
              const isHovered = hoveredCard === template._id;
              
              return (
                <div
                  key={template._id}
                  className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1"
                  onMouseEnter={() => setHoveredCard(template._id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* Thumbnail Section */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayVideo(template);
                    }}
                    className="relative cursor-pointer aspect-video bg-black border-b border-zinc-800/50 overflow-hidden"
                  >
                    {!imageLoadErrors.has(template._id) && template.thumbnail ? (
                      <img
                        src={template.thumbnail}
                        alt={template.title}
                        className="w-full h-full object-cover transition-transform duration-500"
                        onError={() => handleImageError(template._id)}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800/30 text-zinc-600 gap-3">
                        {template.type === TemplateType.VIDEO ? (
                          <FileVideo className="h-10 w-10 opacity-30" />
                        ) : (
                          <FileAudio className="h-10 w-10 opacity-30" />
                        )}
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                    {/* Play Button Overlay */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                      isHovered ? "opacity-100 scale-100" : "opacity-0 scale-90"
                    }`}>
                      <div className="bg-white/10 backdrop-blur-md rounded-full p-4 border border-white/20 hover:bg-white/20 hover:scale-110 transition-all">
                        <Play className="h-6 w-6 text-white fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="absolute top-3 right-3 flex gap-2">
                       {template.type === TemplateType.VIDEO ? (
                        <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-medium px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                          <FileVideo className="h-3 w-3" />
                         Video
                        </div>
                       ) : (
                        <div className="bg-black/40 backdrop-blur-md text-white text-[10px] font-medium px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                          <FileAudio className="h-3 w-3" />
                          Audio
                        </div>
                       )}
                    </div>

                    <div className="absolute bottom-3 right-3">
                      {template.duration && (
                        <div className="bg-black/60 backdrop-blur-md text-zinc-200 text-[10px] font-mono px-2 py-1 rounded-md border border-white/5 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {formatDuration(template.duration)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="px-2 py-2 md:px-3 md:py-3 space-y-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="text-xs md:text-sm font-semibold text-zinc-100 line-clamp-1 group-hover:text-emerald-400 transition-colors duration-200">
                          {template.title}
                        </h3>
                      </div>
                      <p className="text-[10px] md:text-xs text-zinc-500 line-clamp-1 leading-relaxed">
                        {template.post_description || "No description available"}
                      </p>
                    </div>

                    {/* Actions Divider */}
                    <div className="w-full h-px bg-zinc-800/50" />

                    {/* Interaction Buttons */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLikeToggle(template._id);
                        }}
                        className={`group/like flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-all duration-200 ${
                          template.isLikedByUser
                            ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                            : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                        }`}
                      >
                        <Heart
                          className={`h-3.5 w-3.5 transition-transform duration-200 group-hover/like:scale-110 ${
                            template.isLikedByUser ? "fill-current" : ""
                          }`}
                        />
                        {formatCount(template.likesCount || 0)}
                      </button>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Improved Pagination */}
        {pagination.pages > 1 && (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.max(1, prev.page - 1),
                  }))
                }
                disabled={pagination.page === 1}
                className="h-8 w-8 p-0 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex gap-1 px-2">
                {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                   let pageNum;
                    // Improved pagination logic for smaller display (max 5 items)
                   if (pagination.pages <= 5) {
                      pageNum = i + 1;
                   } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                   } else if (pagination.page >= pagination.pages - 2) {
                      pageNum = pagination.pages - 4 + i;
                   } else {
                      pageNum = pagination.page - 2 + i;
                   }
                   
                   return (
                    <button
                      key={pageNum}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: pageNum }))
                      }
                      className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                        pageNum === pagination.page
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                          : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(prev.pages, prev.page + 1),
                  }))
                }
                disabled={pagination.page === pagination.pages}
                className="h-8 w-8 p-0 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-zinc-600">
               Showing <span className="text-zinc-400">{(pagination.page - 1) * pagination.limit + 1}</span> - <span className="text-zinc-400">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-zinc-400">{pagination.total}</span> templates
            </p>
          </div>
        )}
      </div>

      {/* Overlays - Audio Player */}
      {isAudioPlayerVisible && playingAudio && (
        <div className="fixed inset-x-0 bottom-20 md:bottom-6 z-50 flex justify-center px-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl shadow-black/50 overflow-hidden ring-1 ring-white/10">
            <div className="relative p-1">
              {/* Progress Bar Background */}
              <div 
                ref={progressBarRef}
                className="absolute top-0 left-0 right-0 h-1 bg-zinc-800 cursor-pointer group"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-emerald-500 relative transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform duration-200" />
                </div>
              </div>

              <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto] gap-3 md:gap-6 items-center p-3 md:p-4 pt-4 md:pt-5">
                {/* Track Info */}
                <div className="flex items-center gap-3 md:gap-4 w-full md:min-w-[180px]">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700/50 shadow-inner">
                    <FileAudio className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-semibold text-white truncate max-w-[150px]">{playingAudio.title}</h4>
                    <p className="text-xs text-zinc-500 font-medium font-mono mt-0.5">
                      {formatDuration(currentTime)} / {formatDuration(duration)}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6">
                  <button className="text-zinc-400 hover:text-white transition-colors">
                     <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    className="w-10 h-10 bg-white text-black hover:bg-zinc-200 rounded-full flex items-center justify-center shadow-lg shadow-white/10 transition-transform active:scale-95"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    )}
                  </button>
                  <button className="text-zinc-400 hover:text-white transition-colors">
                     <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Volume & Close */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 group">
                    <Volume2 className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <button
                    onClick={closeAudioPlayer}
                    className="text-zinc-500 hover:text-white hover:bg-zinc-800 p-2 rounded-lg transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <audio ref={audioRef} src={playingAudio.url} autoPlay={isPlaying} />
          </div>
        </div>
      )}

      {/* Video Player Overlay */}
      {isVideoPlayerVisible && playingVideo && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div
            ref={videoPlayerRef}
            className="relative w-full max-w-5xl mx-auto bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-zinc-800"
          >
            <div className="relative aspect-video bg-black group">
              <video
                ref={videoRef}
                src={playingVideo.url}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onError={() => console.error("Video failed to load")}
              />
              <Button
                onClick={closeVideoPlayer}
                className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white border border-white/10 rounded-full h-10 w-10 p-0 backdrop-blur-md transition-all duration-200 hover:scale-105"
                size="icon"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="p-6 bg-zinc-900 border-t border-zinc-800">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {playingVideo.title}
                  </h3>
                   <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                    {playingVideo.post_description || "No description provided."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800 px-3 py-1.5 rounded-full">
                    <FileVideo className="h-3.5 w-3.5" />
                    <span className="font-medium text-white">{formatBytes(playingVideo.bytes)}</span>
                  </div>
                   {playingVideo.duration && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800 px-3 py-1.5 rounded-full">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-medium text-white">{formatDuration(playingVideo.duration)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

};

export default TemplateGallery;