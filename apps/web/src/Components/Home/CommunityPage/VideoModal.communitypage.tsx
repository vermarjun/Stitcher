import {
  Heart,
  X,
  Send,
  MoreVertical,
  MessageCircle,
  User
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { useRef, useState } from "react";
import api from "@/api";
import type { ICommunityPost } from "./main.communitypage";


interface Props {
  setPosts: React.Dispatch<React.SetStateAction<ICommunityPost[]>>
  formatCount: (count: number) => string;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedPost: ICommunityPost
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

export const VideoModal = ({selectedPost, setSelectedPost, setPosts, formatCount, setIsModalOpen}:Props)=>{
    const videoRef = useRef<HTMLVideoElement>(null);
    const [commentText, setCommentText] = useState("");
    console.log(selectedPost)

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
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl h-[80vh] bg-zinc-900 rounded-xl overflow-hidden flex">
            {/* Left Side - Video */}
            <div className="flex-1 bg-zinc-900 border border-zinc-900 flex items-center justify-center">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-400 hover:text-white"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
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
                    className="flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        selectedPost.isLiked
                          ? "fill-red-500 text-red-500"
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
                  selectedPost.comments.map((comment) => (
                    <div key={comment._id} className="flex gap-3">
                      <Avatar
                        src={comment.userId.profilePhoto}
                        alt={comment.userId.username}
                        className="h-8 w-8 flex-shrink-0 border border-zinc-700"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="bg-zinc-800 rounded-lg p-3">
                          <p className="text-sm font-medium text-white mb-1">
                            {comment.userId.username}
                          </p>
                          <p className="text-sm text-zinc-200">
                            {comment.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 mt-1 ml-1">
                          <button
                            onClick={() => handleCommentLike(comment._id)}
                            className="flex justify-center items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
                          >
                            <Heart className={`w-4 h-4 ${comment.isLiked?"fill-red-500 text-red-500":""}`}/>
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
                      </div>
                    </div>
                  ))
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
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleCommentSubmit()
                    }
                    className="flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
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
              className="absolute top-4 right-4 z-10 bg-zinc-800/80 hover:bg-zinc-700/90 text-white rounded-full backdrop-blur-md"
              size="icon"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
    )
}