import {
  Heart,
  Play,
  Clock,
  MessageCircle,
  Check,
  Loader2,
  Backpack,
  MoreHorizontal,
  UserPlus,
  UserCheck,
  Edit,
  X,
  Trash2,
  ChartColumn,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import api from "@/api";
import type { IUser } from "@/State/Types";
import type { ICommunityPost } from "./main.communitypage";
import { toast } from "sonner";

interface Props {
  post: ICommunityPost;
  index: number;
  posts: ICommunityPost[];
  lastPostRef?: React.RefObject<HTMLDivElement | null>;
  formatCount: (count: number) => string;
  currentUser?: IUser;
  onPostClick: (post: ICommunityPost) => void;
  onProfileClick: (user: IUser) => void;
}

const PostCard = ({
  post,
  index,
  onPostClick,
  posts,
  lastPostRef,
  onProfileClick,
  formatCount,
  currentUser,
}: Props) => {
  const [loadingStates, setLoadingStates] = useState<{
    [postId: string]: boolean;
  }>({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [editTitle, setEditTitle] = useState(post.title);
  const [editDescription, setEditDescription] = useState(
    post.description || ""
  );
  const [editTags, setEditTags] = useState(post.tags.join(", "));
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPostLoading = loadingStates[post._id];

  const isOwner = currentUser?._id === post.authorId._id;

  const handleSaveToBackPack = async (post: ICommunityPost) => {
    setLoadingStates((prev) => ({ ...prev, [post._id]: true }));

    try {
      const response = await api.post<any>("/backpack/items", {
        itemType: "Asset",
        itemId: post.assetId._id,
        source: "community_post",
        sourceId: post._id,
        favourite: false,
        tags: [],
        notes: "",
      });
      if ((response.data as any).success == true) {
        post.isAddedToBackpack = true;
      } else {
        throw Error("Error came in saving template item to backpack");
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [post._id]: false }));
    }
  };

  const handleUpdatePost = async () => {
    setIsUpdating(true);
    try {
      const tagsArray = editTags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const response = await api.patch(`/community/posts/${post._id}`, {
        title: editTitle,
        description: editDescription,
        tags: tagsArray,
      });

      if ((response.data as any).success) {
        toast.success("Post updated successfully");
        // Update the post in the local state
        post.title = editTitle;
        post.description = editDescription;
        post.tags = tagsArray;
        setShowEditModal(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update post");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePost = async () => {
    setIsDeleting(true);
    try {
      const response = await api.delete(`/community/posts/${post._id}`);

      if ((response.data as any).success) {
        toast.success("Post deleted successfully");
        // Remove the post from the posts array
        const postIndex = posts.findIndex((p) => p._id === post._id);
        if (postIndex > -1) {
          posts.splice(postIndex, 1);
        }
        setShowDeleteModal(false);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic update
    const previousIsLiked = isLiked;
    const previousLikesCount = likesCount;

    try {
      const response = await api.post(`/community/posts/${post._id}/like`);
      if ((response.data as any).success) {
        // Update with actual data from server
        setIsLiked(!isLiked);
        setLikesCount((prev) => (previousIsLiked ? prev - 1 : prev + 1));
      }
    } catch (error) {
      // Revert optimistic update on error
      setIsLiked(previousIsLiked);
      setLikesCount(previousLikesCount);
      console.error("Failed to toggle like:", error);
    }
  };

  const onFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic update
    const previousIsFollowing = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (isFollowing) {
        // Unfollow
        const response = await api.delete(
          `/users/${post.authorId._id}/unfollow`
        );
        if ((response.data as any).following === false) {
          setIsFollowing(false);
        } else {
          throw new Error("Failed to unfollow");
        }
      } else {
        // Follow
        const response = await api.post(`/users/${post.authorId._id}/follow`);
        if ((response.data as any).following === true) {
          setIsFollowing(true);
        } else {
          throw new Error("Failed to follow");
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      setIsFollowing(previousIsFollowing);
      console.error(
        `Failed to ${isFollowing ? "unfollow" : "follow"} user:`,
        error
      );
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  function timeAgo(date: Date) {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    const years = Math.floor(days / 365);
    return `${years}y`;
  }

  const getPlanBadge = (plan?: string) => {
    if (!plan || plan === "free") return null;

    const badgeConfig = {
      pro: {
        color: "text-blue-500",
        bgColor: "bg-blue-500",
      },
      legend: {
        color: "text-yellow-500",
        bgColor: "bg-yellow-500",
      },
    };

    const config = badgeConfig[plan as keyof typeof badgeConfig];
    if (!config) return null;

    return (
      <svg
        className={`w-[18px] h-[18px] ${config.color} fill-current flex-shrink-0`}
        viewBox="0 0 22 22"
      >
        <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
      </svg>
    );
  };

  return (
    <div
      key={post._id}
      ref={index === posts.length - 1 ? lastPostRef : null}
      className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-all duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex gap-4 px-5 py-5">
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          <img
            src={post.authorId.profilePhoto || "https://i.pravatar.cc/150"}
            alt={post.authorId.username}
            className="h-11 w-11 rounded-full object-cover cursor-pointer hover:opacity-90 transition-opacity ring-2 ring-transparent hover:ring-zinc-800"
            onClick={(e) => {
              e.stopPropagation();
              onProfileClick(post.authorId);
            }}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 relative space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col min-w-0 pr-2">
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <span
                  className="font-bold text-[15px] text-white hover:underline cursor-pointer truncate flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProfileClick(post.authorId);
                  }}
                >
                  {post.authorId.username}
                </span>
                {getPlanBadge(post.authorId.plan)}
                <span className="text-zinc-500 text-[15px] truncate flex-shrink min-w-0">
                  @{post.authorId.username}
                </span>
                <span className="text-zinc-500 text-[15px] flex-shrink-0">·</span>
                <span className="text-zinc-500 text-[15px] hover:text-zinc-400 transition-colors flex-shrink-0 whitespace-nowrap">
                  {timeAgo(new Date(post.publishedAt))}
                </span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-zinc-500 hover:text-zinc-300 p-1.5 hover:bg-zinc-800/80 rounded-full transition-all flex-shrink-0 -mt-1 -mr-2"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-black/95 border-zinc-800 absolute right-0 w-48 z-50 backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {!isOwner && (
                  <DropdownMenuItem
                    onClick={onFollowClick}
                    className="cursor-pointer focus:bg-zinc-900 text-zinc-200 focus:text-white py-2.5"
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2.5" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2.5" />
                        Follow @{post.authorId.username}
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {/* Edit post button */}
                {isOwner && (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEditModal(true);
                      }}
                      className="cursor-pointer focus:bg-zinc-900 text-zinc-200 focus:text-white py-2.5"
                    >
                      <Edit className="h-4 w-4 mr-2.5" />
                      Edit Post
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteModal(true);
                      }}
                      className="cursor-pointer focus:bg-red-950/30 text-red-400 focus:text-red-300 py-2.5"
                    >
                      <Trash2 className="h-4 w-4 mr-2.5" />
                      Delete Post
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Text Content */}
          <div className="space-y-1.5" onClick={() => onPostClick(post)}>
            <h3 className="text-[16px] font-semibold text-white leading-snug">
              {post.title}
            </h3>
            {post.description && (
              <p className="text-[15px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                {post.description}
              </p>
            )}
             {/* Tags if available could go here, but relying on description for now */}
          </div>

          {/* Media */}
          <div
            className="relative border border-zinc-800 rounded-xl overflow-hidden group bg-zinc-900/30"
            onClick={() => onPostClick(post)}
          >
            <img
              src={post.assetId.thumbnail}
              alt={post.title}
              className="w-full aspect-video object-cover transition-transform duration-500"
            />

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/30 backdrop-blur-[1px]">
              <div className="bg-white/90 rounded-full p-3.5 shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300 hover:bg-white hover:scale-110">
                <Play className="h-6 w-6 text-black fill-black ml-0.5" />
              </div>
            </div>

            {/* Duration Badge */}
            {post.assetId.duration && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/80 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-1 rounded-md border border-white/10 shadow-sm">
                <Clock className="h-3 w-3" />
                {formatDuration(post.assetId.duration)}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-1">
            <div className="flex gap-1 -ml-2">
              {/* Like */}
              <button
                className="flex items-center gap-1.5 group p-2 hover:bg-pink-500/10 rounded-full transition-all duration-200"
                onClick={handleLike}
              >
                <Heart
                  className={`w-5 h-5 transition-all duration-200 ${
                    isLiked
                      ? "fill-pink-500 text-pink-500 scale-110"
                      : "text-zinc-400 group-hover:text-pink-500 group-hover:scale-110"
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors ${
                    isLiked
                      ? "text-pink-500"
                      : "text-zinc-500 group-hover:text-pink-500"
                  }`}
                >
                  {formatCount(likesCount)}
                </span>
              </button>

              <button
                className="flex items-center gap-1.5 group cursor-pointer p-2 hover:bg-blue-500/10 rounded-full transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onPostClick(post); 
                }}
              >
                <MessageCircle className="w-5 h-5 text-zinc-400 group-hover:text-blue-500 transition-all duration-200 group-hover:scale-110" />
                <span className="text-xs font-medium text-zinc-500 group-hover:text-blue-500 transition-colors">
                  {formatCount(post.commentsCount)}
                </span>
              </button>

              {/* Views Badge */}
              <div className="ml-2 flex items-center gap-1.5 text-zinc-500 text-xs px-2 py-1.5">
                <ChartColumn className="w-4 h-4 opacity-70" />
                <span className="font-medium">{formatCount(post.analytics.views)}</span>
              </div>
            </div>

            {/* Backpack/Save */}
            <button
              className="flex items-center gap-2 group p-2 hover:bg-blue-500/10 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                if (!post.isAddedToBackpack) {
                  handleSaveToBackPack(post);
                }
              }}
              disabled={isPostLoading}
            >
              {isPostLoading ? (
                <>
                  <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                </>
              ) : post.isAddedToBackpack ? (
                <>
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-green-500 font-medium hidden sm:inline">
                    Saved
                  </span>
                </>
              ) : (
                <>
                  <Backpack className="w-5 h-5 text-zinc-400 group-hover:text-blue-500 transition-all duration-200 group-hover:scale-110" />
                  {/* <span className="text-xs text-zinc-500 group-hover:text-blue-500 transition-colors hidden sm:inline font-medium">
                    Save
                  </span> */}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Edit Post Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-lg w-full border border-zinc-800">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Edit Post</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                  placeholder="Enter post title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
                  placeholder="Enter post description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
                  placeholder="e.g., react, typescript, web"
                />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-zinc-800">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePost}
                disabled={isUpdating || !editTitle.trim()}
                className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-800 cursor-pointer text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Post"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full border border-zinc-800">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Delete Post?
              </h2>
              <p className="text-zinc-400 text-sm">
                Are you sure you want to delete this post? This action cannot be
                undone and will remove all comments and engagement data.
              </p>
            </div>
            <div className="flex gap-3 p-4 border-t border-zinc-800">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-zinc-300 hover:bg-red-200 border border-zinc-400 hover:border-red-500 cursor-pointer text-red-600 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
