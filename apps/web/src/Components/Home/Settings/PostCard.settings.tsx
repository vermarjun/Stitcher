import type { User } from "@/State/Types";
import { useState } from "react";
import {
  Heart,
  Play,
  Clock,
  MessageCircle,
  Loader2,
  MoreHorizontal,
  UserPlus,
  UserCheck,
  Edit,
  X,
  Trash2,
  ChartColumn,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import api from "@/api";
import { toast } from "sonner";
import type { ICommunityPost } from "./MyPosts.settings";

interface PostCardProps {
  post: ICommunityPost;
  posts: ICommunityPost[];
  formatCount: (count: number) => string;
  currentUser?: User;
}

const PostCard = ({
  post,
  posts,
  formatCount,
  currentUser
}: PostCardProps) => {
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

  const isOwner = currentUser?.id === post.authorId._id;

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

      if (response.data.success) {
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

      if (response.data.success) {
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
      if (response.data.success) {
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
        if (response.data.following === false) {
          setIsFollowing(false);
        } else {
          throw new Error("Failed to unfollow");
        }
      } else {
        // Follow
        const response = await api.post(`/users/${post.authorId._id}/follow`);
        if (response.data.following === true) {
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
      // ref={index === posts.length - 1 ? lastPostRef : null}
      className="border-b border-zinc-800 hover:bg-zinc-900/30 transition-colors cursor-pointer"
    >
      <div className="flex gap-3 px-4 py-3">
        {/* Profile Picture */}
        <div className="flex-shrink-0">
          <img
            src={post.authorId.profilePhoto || "https://i.pravatar.cc/150"}
            alt={post.authorId.username}
            className="h-10 w-10 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
            // onClick={(e) => {
            //   e.stopPropagation();
            //   onProfileClick(post.authorId);
            // }}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              <span
                className="font-bold text-[15px] hover:underline cursor-pointer truncate"
                // onClick={(e) => {
                //   e.stopPropagation();
                //   onProfileClick(post.authorId);
                // }}
              >
                {post.authorId.username}
              </span>
              {getPlanBadge(post.authorId.plan)}
              <span className="text-zinc-500 text-[15px] truncate">
                @{post.authorId.username}
              </span>
              <span className="text-zinc-500 text-[15px]">·</span>
              <span className="text-zinc-500 text-[15px] hover:underline">
                {timeAgo(new Date(post.publishedAt))}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-zinc-400 hover:text-zinc-300 p-1 hover:bg-zinc-800 rounded-full transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-zinc-800 border-zinc-600 absolute right-0 w-48 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {!isOwner && (
                  <DropdownMenuItem
                    onClick={onFollowClick}
                    className="cursor-pointer focus:bg-zinc-200 text-white"
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow @{post.authorId.username}
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {/* Edit post button */}
                {isOwner && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEditModal(true);
                    }}
                    className="cursor-pointer focus:bg-zinc-200 text-white"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Post
                  </DropdownMenuItem>
                )}
                {/* Delete post button */}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteModal(true);
                  }}
                  className="cursor-pointer focus:bg-zinc-200 text-red-100"
                >
                  <Trash2 className="h-4 w-4 text-red-500 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Text Content */}
          <div 
          className="mb-3" 
          // onClick={() => onPostClick(post)}
          >
            <p className="text-[15px] leading-5 whitespace-pre-wrap break-words">
              <span className="font-semibold">{post.title}</span>
              {post.description && (
                <>
                  {" "}
                  <span className="text-zinc-300">{post.description}</span>
                </>
              )}
            </p>
          </div>

          {/* Media */}
          <div
            className="relative border border-zinc-700 rounded-2xl overflow-hidden mb-3 group"
            // onClick={() => onPostClick(post)}
          >
            <img
              src={post.assetId.thumbnail}
              alt={post.title}
              className="w-full aspect-video object-cover"
            />

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <div className="bg-white rounded-full p-3">
                <Play className="h-6 w-6 text-black fill-black" />
              </div>
            </div>

            {/* Duration Badge */}
            {post.assetId.duration && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/75 text-white text-xs px-2 py-1 rounded">
                <Clock className="h-3 w-3" />
                {formatDuration(post.assetId.duration)}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center -ml-2">
            <div className="flex gap-3">
              {/* Like */}
              <button
                className="flex items-center gap-2 group p-2 hover:bg-pink-500/10 rounded-full transition-colors"
                onClick={handleLike}
              >
                <Heart
                  className={`w-[18px] h-[18px] transition-colors ${
                    isLiked
                      ? "fill-pink-500 text-red-500"
                      : "text-zinc-500 group-hover:text-pink-500"
                  }`}
                />
                <span
                  className={`text-[13px] transition-colors ${
                    isLiked
                      ? "text-pink-500"
                      : "text-zinc-500 group-hover:text-pink-500"
                  }`}
                >
                  {formatCount(likesCount)}
                </span>
                <span
                  className={`text-[13px] transition-colors hidden sm:inline ${
                    isLiked
                      ? "text-pink-500"
                      : "text-zinc-500 group-hover:text-pink-500"
                  }`}
                >
                  Likes
                </span>
              </button>

              <button
                className="flex items-center gap-2 group cursor-pointer p-2 hover:bg-blue-500/10 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // onPostClick(post); // This will open the detailed post view for comments
                }}
              >
                <MessageCircle className="w-[18px] h-[18px] text-zinc-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-[13px] text-zinc-400 group-hover:text-blue-500 transition-colors">
                  {formatCount(post.commentsCount)}
                </span>
                <span className="text-[13px] text-zinc-400 group-hover:text-blue-500 transition-colors hidden sm:inline">
                  Comments
                </span>
              </button>

              {/* Views Badge */}
              <div className="flex items-center gap-1 bg-black/75 text-zinc-400 text-xs px-2 py-1 rounded">
                <ChartColumn className="w-[18px] h-[18px]" />
                {formatCount(post.analytics.views)}
                <span>Views</span>
              </div>
            </div>
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

export default PostCard