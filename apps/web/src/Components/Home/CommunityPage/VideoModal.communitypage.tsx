import {
  Heart,
  X,
  Send,
  MessageCircle,
  User,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { useRef, useState } from "react";
import api from "@/api";
import { toast } from "sonner";
import type { ICommunityPost } from "./main.communitypage";
import type { User as UserType } from "@/State/Types";

interface Props {
  currentUser?: UserType;
  setPosts: React.Dispatch<React.SetStateAction<ICommunityPost[]>>;
  formatCount: (count: number) => string;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedPost: ICommunityPost;
  setSelectedPost: React.Dispatch<React.SetStateAction<ICommunityPost | null>>;
}

export const Avatar = ({
  src,
  alt,
  className = "",
}: {
  src?: string;
  alt: string;
  className?: string;
}) => (
  <div
    className={`relative rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center ${className}`}
  >
    {src ? (
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    ) : (
      <User className="h-1/2 w-1/2 text-zinc-500" />
    )}
  </div>
);

export const VideoModal = ({
  currentUser,
  selectedPost,
  setSelectedPost,
  setPosts,
  formatCount,
  setIsModalOpen,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const handleLikeToggle = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const response = await api.post(`/community/posts/${postId}/like`);
      if (response.data.success) {
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? {
                  ...p,
                  isLiked: !p.isLiked,
                  likesCount: response.data.data.likesCount,
                }
              : p
          )
        );
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost({
            ...selectedPost,
            isLiked: !selectedPost.isLiked,
            likesCount: response.data.data.likesCount,
          });
        }
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (!selectedPost) return;
    try {
      const response = await api.post(
        `/community/posts/${selectedPost._id}/comments/${commentId}/like`
      );
      if (response.data.success) {
        // Refresh comments to get updated likes
        const commentsResponse = await api.get(
          `/community/posts/${selectedPost._id}/comments`
        );
        if (commentsResponse.data.success) {
          setSelectedPost({
            ...selectedPost,
            comments: commentsResponse.data.data,
          });
        }
      }
    } catch (error) {
      console.error("Failed to like comment:", error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!selectedPost || !commentText.trim()) return;
    try {
      const response = await api.post(
        `/community/posts/${selectedPost._id}/comments`,
        {
          content: commentText,
        }
      );
      if (response.data.success) {
        // Refresh comments to get the new comment with populated user data
        const commentsResponse = await api.get(
          `/community/posts/${selectedPost._id}/comments`
        );
        if (commentsResponse.data.success) {
          setSelectedPost({
            ...selectedPost,
            comments: commentsResponse.data.data,
            commentsCount: commentsResponse.data.data.length,
          });
          setCommentText("");
        }
      }
    } catch (error) {
      console.error("Failed to post comment:", error);
    }
  };

  const handleEditComment = async (commentId: string) => {
    setIsUpdatingComment(true);
    try {
      const response = await api.patch(
        `/community/posts/${selectedPost._id}/comments/${commentId}`,
        { content: editCommentContent }
      );

      if (response.data.success) {
        toast.success("Comment updated successfully");

        // Update the comment in the local state
        const updatedComments = selectedPost.comments.map((c) =>
          c._id === commentId
            ? {
                ...c,
                content: editCommentContent,
                isEdited: true,
                updatedAt: new Date().toISOString(),
              }
            : c
        );

        setSelectedPost({
          ...selectedPost,
          comments: updatedComments,
        });

        setEditingCommentId(null);
        setEditCommentContent("");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update comment");
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setIsDeletingComment(true);
    try {
      const response = await api.delete(
        `/community/posts/${selectedPost._id}/comments/${commentId}`
      );

      if (response.data.success) {
        toast.success("Comment deleted successfully");

        // Remove the comment and its replies from local state
        const updatedComments = selectedPost.comments.filter(
          (c) => c._id !== commentId && c.parentCommentId !== commentId
        );

        setSelectedPost({
          ...selectedPost,
          comments: updatedComments,
          commentsCount: updatedComments.length,
        });

        setDeleteCommentId(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete comment");
    } finally {
      setIsDeletingComment(false);
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / 1000
    );
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-6xl h-[80vh] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex">
        {/* Left Side - Video */}
        <div className="flex-1 bg-zinc-950 border-r border-zinc-600 flex items-center justify-center">
          <video
            ref={videoRef}
            src={selectedPost.assetId.url}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>
        {/* Right Side - Comments & Info */}
        <div className="w-[400px] flex flex-col bg-zinc-900 border-l border-zinc-800">
          {/* Header with Author Info */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar
                  src={selectedPost.authorId.profilePhoto}
                  alt={selectedPost.authorId.username}
                  className="h-10 w-10 border border-zinc-700"
                />
                <div>
                  <p className="font-semibold text-white text-sm">
                    {selectedPost.authorId.username}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {formatTimeAgo(selectedPost.publishedAt)}
                  </p>
                </div>
              </div>
            </div>
            {/* Title & Description */}
            <h2 className="font-semibold text-white mb-2">
              {selectedPost.title}
            </h2>
            {selectedPost.description && (
              <p className="text-sm text-zinc-300 mb-3">
                {selectedPost.description}
              </p>
            )}
            {/* Tags */}
            {selectedPost.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedPost.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {/* Action Buttons */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800">
              <button
                onClick={(e) => handleLikeToggle(selectedPost._id, e)}
                className="flex items-center gap-2 text-sm font-medium cursor-pointer transition-colors"
              >
                <Heart
                  className={`h-5 w-5 ${
                    selectedPost.isLiked
                      ? "fill-red-400 text-red-500"
                      : "text-white hover:text-zinc-300"
                  }`}
                />
                {formatCount(selectedPost.likesCount)}
              </button>
              <button className="flex items-center gap-2 text-sm font-medium text-white hover:text-zinc-300 transition-colors">
                <MessageCircle className="h-5 w-5" />
                {formatCount(selectedPost.commentsCount)}
              </button>
            </div>
          </div>
          {/* Comments Section */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedPost.comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">No comments yet</p>
                <p className="text-xs">Be the first to comment!</p>
              </div>
            ) : (
              selectedPost.comments.map((comment) => {
                const isCommentOwner = currentUser?.id === comment.userId._id;
                const isEditing = editingCommentId === comment._id;

                return (
                  <div key={comment._id} className="flex gap-3">
                    <Avatar
                      src={comment.userId.profilePhoto}
                      alt={comment.userId.username}
                      className="h-8 w-8 flex-shrink-0 border border-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value)}
                            rows={3}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
                            placeholder="Edit your comment..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditCommentContent("");
                              }}
                              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleEditComment(comment._id)}
                              disabled={
                                isUpdatingComment || !editCommentContent.trim()
                              }
                              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {isUpdatingComment ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                "Save"
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bg-zinc-800 rounded-lg p-3">
                            <div className="flex items-start justify-between mb-1">
                              <p className="text-sm font-medium text-white">
                                {comment.userId.username}
                              </p>
                              
                              {/* Edit and Delete Buttons - Positioned at top right */}
                              {isCommentOwner && (
                                <div className="flex items-center gap-1 ml-2">
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(comment._id);
                                      setEditCommentContent(comment.content);
                                    }}
                                    className="text-zinc-400 hover:text-white p-1 rounded transition-colors"
                                    title="Edit comment"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteCommentId(comment._id)}
                                    className="text-zinc-400 hover:text-red-400 p-1 rounded transition-colors"
                                    title="Delete comment"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-zinc-200">
                              {comment.content}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 mt-1 ml-1">
                            <button
                              onClick={() => handleCommentLike(comment._id)}
                              className="flex justify-center cursor-pointer items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  comment.isLiked
                                    ? "fill-red-400 text-red-500"
                                    : ""
                                }`}
                              />
                              {comment.likes.length > 0
                                ? `${comment.likes.length} likes`
                                : "Like"}
                            </button>
                            <span className="text-xs text-zinc-500">
                              {formatTimeAgo(comment.createdAt)}
                            </span>
                            {comment.isEdited && (
                              <span className="text-xs text-zinc-500">
                                (edited)
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Comment Input */}
          <div className="p-4 border-t border-zinc-800">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCommentSubmit()}
                className="flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-300"
              />
              <Button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim()}
                className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {/* Close Button */}
        <Button
          onClick={() => {
            setIsModalOpen(false);
            setSelectedPost(null);
          }}
          className="absolute cursor-pointer top-4 right-4 z-10 bg-zinc-800/80 hover:bg-zinc-700/90 text-white rounded-full backdrop-blur-md"
          size="icon"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Delete Comment Confirmation Modal */}
        {deleteCommentId && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl max-w-md w-full border border-zinc-800">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-4">
                  <Trash2 className="h-6 w-6 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Delete Comment?
                </h2>
                <p className="text-zinc-400 text-sm">
                  Are you sure you want to delete this comment? This action
                  cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 p-4 border-t border-zinc-800">
                <button
                  onClick={() => setDeleteCommentId(null)}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteComment(deleteCommentId)}
                  disabled={isDeletingComment}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeletingComment ? (
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
    </div>
  );
};