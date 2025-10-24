import {
  Heart,
  Clock,
  Play,
  Eye,
  MessageCircle,
  Backpack,
  Check,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import api from "@/api";
import { Avatar } from "./VideoModal.communitypage";
import { toast } from "sonner";
import type {ICommunityPost, IUser} from "./main.communitypage"

interface Props {
  post: ICommunityPost;
  index: number;
  formatCount: (count: number) => string;
  posts: ICommunityPost[];
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedPost: React.Dispatch<React.SetStateAction<ICommunityPost | null>>;
  lastPostRef: React.Ref<HTMLDivElement | null>;
}

export const PostCard = ({
  post,
  index,
  posts,
  formatCount,
  setSelectedPost,
  setIsModalOpen,
  lastPostRef,
}: Props) => {
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);
  const [userProfileData, setUserProfileData] = useState<IUser | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [loadingStates, setLoadingStates] = useState<{ [postId: string]: boolean }>({});

  const handleSaveToBackPack = async (post: ICommunityPost) => {
    // Set loading state for this specific post
    setLoadingStates(prev => ({ ...prev, [post._id]: true }));
    
    try {
      const response = await api.post("/backpack/items", {
        itemType: "Asset",
        itemId: post.assetId._id,
        source: "community_post",
        sourceId: post._id,
        favourite: false,
        tags: [],
        notes: "",
      });
      if (response.data.success == true) {
        toast.success("Successfully added template to backpack");
        post.isAddedToBackpack = true;
      } else {
        throw Error("Error came in saving template item to backpack");
      }
    } catch (e: any) {
      toast.error(e.message || "Error saving tempalte to backpack");
    } finally {
      // Clear loading state regardless of success or failure
      setLoadingStates(prev => ({ ...prev, [post._id]: false }));
    }
  };

  const handleUserHover = async (userId: string) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);

    const timeout = setTimeout(async () => {
      setHoveredUser(userId);
      try {
        const response = await api.get(`/users/${userId}/profile`);
        if (response.data.success) {
          setUserProfileData(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
      }
    }, 500);

    setHoverTimeout(timeout);
  };

  const handleUserLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoveredUser(null);
    setUserProfileData(null);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePostClick = async (post: ICommunityPost) => {
    try {
      const response = await api.get(`/community/posts/${post._id}`);
      if (response.data.success) {
        setSelectedPost(response.data.data);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch post details:", error);
    }
  };

  const isPostLoading = loadingStates[post._id];

  return (
    <div
      key={post._id}
      className="group bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700"
    >
      {/* Thumbnail */}
      <div
        ref={index === posts.length - 1 ? lastPostRef : null}
        onClick={() => handlePostClick(post)}
        className="relative aspect-video bg-zinc-700 cursor-pointer"
      >
        <img
          src={post.assetId.thumbnail}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Play Icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <div className="bg-white rounded-full p-3">
            <Play className="h-5 w-5 text-black" />
          </div>
        </div>

        {/* Duration */}
        {post.assetId.duration && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            {formatDuration(post.assetId.duration)}
          </div>
        )}

        {/* Stats */}
        <div className="absolute bottom-2 left-2 flex gap-2">
          {[
            {
              icon: <Heart className={`h-3 w-3 ${(post.isLiked)?"fill-red-600 text-red-500":""}`} />,
              count: post.likesCount,
              label: "Likes",
            },
            {
              icon: <MessageCircle className="h-3 w-3" />,
              count: post.commentsCount,
              label: "Comments",
            },
            {
              icon: <Eye className="h-3 w-3" />,
              count: post.analytics.views,
              label: "Views",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-md"
            >
              {stat.icon}
              <span>{formatCount(stat.count)}</span>
              <span className="text-[10px] opacity-80">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 space-y-3">
        {/* Author + Tags */}
        <div className="flex justify-between items-center border-b border-zinc-700 pb-3">
          <div
            className="flex items-center gap-2 relative"
            onMouseEnter={() => handleUserHover(post.authorId._id)}
            onMouseLeave={handleUserLeave}
          >
            <Avatar
              src={post.authorId.profilePhoto}
              alt={post.authorId.username}
              className="h-8 w-8 border border-zinc-600"
            />
            <div>
              <p className="text-sm font-medium text-white truncate">
                {post.authorId.username}
              </p>
              <p className="text-xs text-zinc-400 truncate">
                @{post.authorId.username}
              </p>
            </div>

            {/* Hover Card */}
            {hoveredUser === post.authorId._id && userProfileData && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-2xl z-50">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar
                    src={userProfileData.profilePhoto}
                    alt={userProfileData.username}
                    className="h-12 w-12 border-2 border-zinc-700"
                  />
                  <div>
                    <p className="font-semibold text-white truncate">
                      {userProfileData.username}
                    </p>
                    <p className="text-sm text-zinc-400 truncate">
                      @{userProfileData.username}
                    </p>
                  </div>
                </div>
                {userProfileData.bio && (
                  <p className="text-sm text-zinc-300 line-clamp-2">
                    {userProfileData.bio}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* Button */}
          {!post.isAddedToBackpack ? (
            <div>
              <button
                onClick={() => {
                  handleSaveToBackPack(post);
                }}
                disabled={isPostLoading}
                className="bg-zinc-600 hover:scale-105 cursor-pointer px-2 py-1 rounded-full gap-2 text-xs text-zinc-200 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
              >
                {isPostLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save to Backpack
                    <Backpack className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              <button className="bg-green-900/50 cursor-default border border-green-800 hover:scale-100 px-2 py-1 rounded-full gap-2 text-xs text-green-100 flex justify-center items-center">
                Saved to Backpack
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Title + Description */}
        <div>
          <h3 className="text-sm font-medium text-white mb-1 line-clamp-2 group-hover:text-zinc-300 transition-colors">
            {post.title}
          </h3>
          {post.description && (
            <p className="text-xs text-zinc-400 line-clamp-1 leading-relaxed">
              {post.description}
            </p>
          )}
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs px-2 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
            {post.tags.length > 3 && (
              <span className="bg-zinc-700/50 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
                +{post.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};