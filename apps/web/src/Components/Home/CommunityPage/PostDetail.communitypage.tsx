import {
  ArrowLeft,
  Heart,
  Backpack,
  Check,
  User,
  Edit,
  Trash2,
  Loader2,
  BarChart3,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  X,
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { useEffect, useState } from "react";
import { useRef } from "react";
import api from "@/api";
import { toast } from "sonner";
import type { ICommunityPost } from "./main.communitypage";
import type { IUser } from "@/State/Types";

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

interface CommentInputProps {
  currentUser?: IUser;
  handleCommentSubmit: (
    commentText: string,
    attachedImage?: File | null
  ) => void;
}

const CommentInput = ({
  currentUser,
  handleCommentSubmit,
}: CommentInputProps) => {
  const [commentText, setCommentText] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setAttachedImage(null);
    setPreviewUrl(null);
  };

  const submitComment = () => {
    if (!commentText.trim() && !attachedImage) return;
    handleCommentSubmit(commentText, attachedImage);
    setCommentText("");
    removeImage();
  };

  return (
    <div className="bg-black border-b border-zinc-800 w-full px-4 pb-3">
      <div className="flex items-start gap-3">
        <Avatar
          src={currentUser?.profilePhoto}
          alt="me"
          className="h-12 w-12 shrink-0"
        />
        <div className="flex-1">
          {/* Text Input */}
          <Input
            type="text"
            placeholder="Post your reply"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitComment()}
            className="border-none placeholder:text-md bg-zinc-900 text-white h-12 rounded-md focus:ring-0"
          />
          {/* Image Preview */}
          {previewUrl && (
            <div className="relative mt-3 w-fit">
              <img
                src={previewUrl}
                alt="preview"
                className="rounded-2xl border border-zinc-700 max-h-60 object-contain"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 bg-black/70 p-1 rounded-full hover:bg-black transition"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          )}
          {/* Action Row */}
          <div className="flex justify-between items-center mt-3">
            <div className="flex justify-center items-center gap-1">
              <span className="text-zinc-400 text-sm">Replying to </span>
              <span className="text-sky-500">@{currentUser?.username}</span>
            </div>
            <div className="flex justify-center items-center gap-5">
              <label
                htmlFor="commentImage"
                className="cursor-pointer gap-1 flex text-sm justify-center items-center text-zinc-400 hover:text-sky-500 transition"
              >
                {/* <span>Add image</span> */}
                <ImageIcon size={20} />
                <input
                  id="commentImage"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </label>
              <Button
                disabled={!commentText.trim() && !attachedImage}
                onClick={submitComment}
                className="bg-sky-500 hover:bg-sky-600 rounded-full text-white font-semibold px-4 py-1.5"
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PostDetail = ({
  post,
  formatCount,
  currentUser,
  onBack,
  onProfileClick,
}: {
  post: ICommunityPost;
  formatCount: (count: number) => string;
  currentUser?: IUser;
  onBack: () => void;
  onProfileClick: (user: IUser) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ICommunityPost>(post);
  const [savingToBackPack, setSavingToBackPack] = useState(false);
  const [fetchingPost, setFetchingPost] = useState(false);
  // New state for reply functionality
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set()
  );
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  const fetchPost = async () => {
    try {
      setFetchingPost(true);
      const response = await api.get(`/community/posts/${selectedPost._id}`);
      setSelectedPost(response.data.data);
    } catch (e: any) {
      console.log(e);
      toast.error(e?.message || "Error fetching post data");
    } finally {
      setFetchingPost(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, []);

  const formatTimeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    const min = diff / 60;
    if (min < 60) return `${Math.floor(min)}m`;
    const hr = min / 60;
    if (hr < 24) return `${Math.floor(hr)}h`;
    const d = hr / 24;
    if (d < 30) return `${Math.floor(d)}d`;
    return new Date(date).toLocaleDateString();
  };

  const handleSaveToBackPack = async (post: ICommunityPost) => {
    setSavingToBackPack(true);
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
        post.isAddedToBackpack = true;
      } else {
        throw Error("Error came in saving template item to backpack");
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setSavingToBackPack(false);
    }
  };

  const handleLikeToggle = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.post(`/community/posts/${postId}/like`);
      if (res.data.success) {
        setSelectedPost({
          ...selectedPost,
          isLiked: !selectedPost.isLiked,
          likesCount: res.data.data.likesCount,
        });
      }
    } catch (err) {
      console.error("Like toggle failed:", err);
    }
  };

  const handleCommentSubmit = async (
    postId: string,
    userId: string,
    commentText: string,
    attachedImage?: File | null
  ) => {
    try {
      const formData = new FormData();
      formData.append("content", commentText);
      formData.append("userId", userId);
      if (attachedImage) formData.append("image", attachedImage);

      const response = await api.post(
        `/community/posts/${postId}/comments`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.status === 201 || response.status === 200) {
        toast.success("Comment posted!");
        // Refresh the post data to get the latest comments
        await fetchPost();
        return response.data;
      }
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast.error(error?.response?.data?.message || "Failed to post comment.");
    }
  };

  const handleCommentLike = async (id: string) => {
    try {
      await api.post(
        `/community/posts/${selectedPost._id}/comments/${id}/like`
      );
      // Refresh comments to get updated likes
      const res = await api.get(
        `/community/posts/${selectedPost._id}/comments`
      );
      if (res.data.success)
        setSelectedPost({ ...selectedPost, comments: res.data.data });
    } catch (err) {
      console.error("Comment like failed:", err);
    }
  };

  const handleEditComment = async (id: string) => {
    setIsUpdatingComment(true);
    try {
      const res = await api.patch(
        `/community/posts/${selectedPost._id}/comments/${id}`,
        { content: editCommentContent }
      );
      if (res.data.success) {
        // Refresh the post data to get the latest comments
        await fetchPost();
        setEditingCommentId(null);
      }
    } catch {
      toast.error("Failed to update comment");
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    setIsDeletingComment(true);
    try {
      const res = await api.delete(
        `/community/posts/${selectedPost._id}/comments/${id}`
      );
      if (res.data.success) {
        // Refresh the post data to get the latest comments
        await fetchPost();
        toast.success("Comment deleted");
        setDeleteCommentId(null);
      }
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setIsDeletingComment(false);
    }
  };

  // --- NEW REPLY FUNCTIONS ---
  const handleReplySubmit = async (parentCommentId: string) => {
    if (!replyText.trim()) return;
    try {
      await api.post(`/community/posts/${selectedPost._id}/comments`, {
        content: replyText,
        parentCommentId: parentCommentId,
      });
      // Refresh the post data to get the latest comments and replies
      await fetchPost();
      setReplyText("");
      setReplyingTo(null);
    } catch (err) {
      console.error("Reply post failed:", err);
      toast.error("Failed to post reply");
    }
  };

  const toggleReplies = async (commentId: string) => {
    const newExpanded = new Set(expandedReplies);
    const newLoading = new Set(loadingReplies);

    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId);
      setExpandedReplies(newExpanded);
    } else {
      newLoading.add(commentId);
      setLoadingReplies(newLoading);
      try {
        // Fetch replies for this specific comment
        const res = await api.get(
          `/community/posts/${selectedPost._id}/comments?parentCommentId=${commentId}`
        );
        if (res.data.success) {
          // We don't need to update state here since we're using the same comments array
          newExpanded.add(commentId);
          setExpandedReplies(newExpanded);
        }
      } catch (err) {
        console.error("Failed to fetch replies:", err);
        toast.error("Failed to load replies");
      } finally {
        newLoading.delete(commentId);
        setLoadingReplies(newLoading);
      }
    }
  };

  const getRepliesForComment = (commentId: string) => {
    return selectedPost.comments.filter(
      (comment) => comment.parentCommentId === commentId
    );
  };

  const isTopLevelComment = (comment: any) => !comment.parentCommentId;

  // Skeleton Component
  if (fetchingPost) {
    return (
      <div className="flex flex-col items-center w-full min-h-screen bg-black text-white">
        {/* Header Skeleton */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg w-full border-b border-zinc-800 flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-zinc-800 animate-pulse"></div>
          <div className="h-6 w-20 bg-zinc-800 rounded animate-pulse"></div>
        </div>

        {/* Post Card Skeleton */}
        <div className="w-full px-4 py-5">
          {/* Author Info Skeleton */}
          <div className="flex gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-zinc-800 animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 w-24 bg-zinc-800 rounded mb-2 animate-pulse"></div>
              <div className="h-3 w-32 bg-zinc-800 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Post Body Skeleton */}
          <div className="ml-[52px]">
            <div className="h-4 w-full bg-zinc-800 rounded mb-2 animate-pulse"></div>
            <div className="h-4 w-3/4 bg-zinc-800 rounded mb-3 animate-pulse"></div>
            
            {/* Video Skeleton */}
            <div className="w-full h-64 bg-zinc-800 rounded-2xl border border-zinc-800 my-3 animate-pulse"></div>

            {/* Tags Skeleton */}
            <div className="flex gap-2 mb-3">
              <div className="h-6 w-16 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-6 w-20 bg-zinc-800 rounded animate-pulse"></div>
            </div>

            {/* Post Footer Skeleton */}
            <div className="flex justify-between border-t border-b border-zinc-800 py-2 items-center text-zinc-500 text-sm gap-5">
              <div className="flex items-center gap-5 w-full">
                <div className="h-6 w-16 bg-zinc-800 rounded animate-pulse"></div>
                <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse"></div>
              </div>
              <div className="flex justify-center items-center gap-10 w-full">
                <div className="h-6 w-20 bg-zinc-800 rounded animate-pulse"></div>
                <div className="h-6 w-24 bg-zinc-800 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Comment Input Skeleton */}
        <div className="bg-black border-b border-zinc-800 w-full px-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-zinc-800 animate-pulse"></div>
            <div className="flex-1">
              <div className="h-12 w-full bg-zinc-800 rounded-md animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Comments Skeleton */}
        <div className="w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-t border-zinc-800 px-4 py-3 flex gap-3">
              <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse"></div>
                </div>
                <div className="h-3 w-full bg-zinc-800 rounded mb-1 animate-pulse"></div>
                <div className="h-3 w-3/4 bg-zinc-800 rounded animate-pulse"></div>
                <div className="flex gap-3 mt-2">
                  <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse"></div>
                  <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg w-full border-b border-zinc-800 flex items-center gap-3 px-4 py-3">
        <button onClick={onBack} className="hover:bg-zinc-800 rounded-full p-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Post</h2>
      </div>

      {/* Post Card */}
      <div className="w-full px-4 py-5">
        {/* Author Info */}
        <div className="flex gap-3 mb-3">
          <Avatar
            src={selectedPost.authorId.profilePhoto}
            alt={selectedPost.authorId.username}
            className="h-10 w-10 cursor-pointer"
          />
          <div>
            <p
              className="font-semibold cursor-pointer hover:underline"
              onClick={() => onProfileClick(selectedPost.authorId)}
            >
              {selectedPost.authorId.username}
            </p>
            <p className="text-sm text-zinc-500">
              @{selectedPost.authorId.username.toLowerCase()} ·{" "}
              {formatTimeAgo(selectedPost.publishedAt)}
            </p>
          </div>
        </div>

        {/* Post Body */}
        <div className="ml-[52px]">
          <p className="text-base mb-2">{selectedPost.title}</p>
          {selectedPost.description && (
            <p className="text-zinc-300 mb-3">{selectedPost.description}</p>
          )}
          {selectedPost.assetId?.url && (
            <video
              ref={videoRef}
              autoPlay
              controls
              className="rounded-2xl border border-zinc-800 w-full max-h-[60vh] my-3"
              src={selectedPost.assetId.url}
            />
          )}

          {/* Tags */}
          {selectedPost.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedPost.tags.map((tag, i) => (
                <span
                  key={i}
                  className="text-blue-400 hover:underline text-sm cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Post Footer */}
          <div className="flex justify-between border-t border-b border-zinc-800 py-2 items-center text-zinc-500 text-sm gap-5">
            {/* Action Bar */}
            <div className="flex items-center text-zinc-500 gap-5 w-full">
              <button
                onClick={(e) => handleLikeToggle(selectedPost._id, e)}
                className="flex items-center gap-2 hover:text-red-500 transition"
              >
                <Heart
                  className={`h-5 w-5 ${
                    selectedPost.isLiked ? "fill-red-500 text-red-500" : ""
                  }`}
                />
                Like
              </button>
              <button
                className="flex items-center gap-2 group p-2 hover:bg-blue-500/10 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!post.isAddedToBackpack) {
                    handleSaveToBackPack(post);
                  }
                }}
                disabled={savingToBackPack}
              >
                {savingToBackPack ? (
                  <>
                    <Loader2 className="w-[18px] h-[18px] text-zinc-500 animate-spin" />
                    <span className="text-[13px] text-zinc-500 hidden sm:inline">
                      Saving...
                    </span>
                  </>
                ) : post.isAddedToBackpack ? (
                  <>
                    <Check className="w-[18px] h-[18px] text-green-500" />
                    <span className="text-[13px] text-green-500 hidden sm:inline">
                      Saved
                    </span>
                  </>
                ) : (
                  <>
                    <Backpack className="w-[18px] h-[18px] text-zinc-500 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[13px] text-zinc-500 group-hover:text-blue-500 transition-colors hidden sm:inline">
                      Save to Backpack
                    </span>
                  </>
                )}
              </button>
            </div>
            <div className="flex justify-center items-center gap-10 w-full">
              <p>
                <span className="text-white font-semibold">
                  {formatCount(selectedPost.likesCount)}
                </span>{" "}
                Likes
              </p>
              <p>
                <span className="text-white font-semibold">
                  {formatCount(selectedPost.commentsCount)}
                </span>{" "}
                Comments
              </p>
              <p className="hidden sm:inline">
                <BarChart3 className="inline w-4 h-4 mr-1" />
                {formatCount(selectedPost.analytics.views)} Views
              </p>
            </div>
          </div>
        </div>
      </div>

      <CommentInput
        handleCommentSubmit={(commentText, attachedImage) =>
          handleCommentSubmit(
            post._id,
            currentUser?._id || "",
            commentText,
            attachedImage
          )
        }
        currentUser={currentUser}
      />

      {/* Comments */}
      <div className="w-full">
        {selectedPost.comments.filter(isTopLevelComment).map((comment) => {
          const isOwner = currentUser?._id === comment.userId._id;
          const isEditing = editingCommentId === comment._id;
          const replies = getRepliesForComment(comment._id);
          const hasReplies = replies.length > 0;
          const isExpanded = expandedReplies.has(comment._id);
          const isLoading = loadingReplies.has(comment._id);
          const hasMedia = comment.media && comment.media.length > 0;

          return (
            <div key={comment._id}>
              {/* Main Comment */}
              <div className="border-t border-zinc-800 px-4 py-3 flex gap-3">
                <Avatar
                  src={comment.userId.profilePhoto}
                  alt={comment.userId.username}
                  className="h-9 w-9"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {comment.userId.username}
                      </span>
                      <span className="text-zinc-500 text-sm">
                        {formatTimeAgo(comment.createdAt)}
                      </span>
                    </div>
                    {isOwner && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCommentId(comment._id);
                            setEditCommentContent(comment.content);
                          }}
                          className="text-zinc-500 hover:text-white"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteCommentId(comment._id)}
                          className="text-zinc-500 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-2">
                      <textarea
                        value={editCommentContent}
                        onChange={(e) => setEditCommentContent(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditCommentContent("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEditComment(comment._id)}
                          disabled={!editCommentContent.trim()}
                        >
                          {isUpdatingComment ? (
                            <Loader2 className="animate-spin h-4 w-4" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-zinc-200 text-sm">
                        {comment.content}
                      </p>

                      {/* Comment Media */}
                      {hasMedia && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {comment.media.map((mediaItem, index) => (
                            <div key={index} className="relative group">
                              {mediaItem.mediaType === 'image' && (
                                <img
                                  src={mediaItem.thumbnailUrl}
                                  alt={`Comment media ${index + 1}`}
                                  className="max-w-[200px] max-h-[200px] rounded-lg border border-zinc-700 object-cover hover:opacity-90 transition-opacity cursor-pointer"
                                  onClick={() => window.open(mediaItem.thumbnailUrl, '_blank')}
                                />
                              )}
                              {mediaItem.mediaType === 'video' && (
                                <div className="relative">
                                  <video
                                    src={mediaItem.thumbnailUrl}
                                    className="max-w-[200px] max-h-[200px] rounded-lg border border-zinc-700 object-cover"
                                    controls
                                  />
                                </div>
                              )}
                              {/* Media type badge */}
                              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                                {mediaItem.mediaType}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                    <button
                      onClick={() => handleCommentLike(comment._id)}
                      className="flex items-center gap-1 hover:text-red-400 transition"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          comment.isLiked ? "fill-red-500 text-red-500" : ""
                        }`}
                      />
                      {comment.likes.length > 0
                        ? `${comment.likes.length} Likes`
                        : "Like"}
                    </button>
                    <button
                      onClick={() =>
                        setReplyingTo(
                          replyingTo === comment._id ? null : comment._id
                        )
                      }
                      className="flex items-center gap-1 hover:text-blue-400 transition"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Reply
                    </button>
                    {hasReplies && (
                      <button
                        onClick={() => toggleReplies(comment._id)}
                        className="flex items-center gap-1 hover:text-zinc-300 transition"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        {replies.length}{" "}
                        {replies.length === 1 ? "Reply" : "Replies"}
                      </button>
                    )}
                    {comment.isEdited && <span>(edited)</span>}
                  </div>

                  {/* Reply Input */}
                  {replyingTo === comment._id && (
                    <div className="mt-3 flex gap-2">
                      <Input
                        type="text"
                        placeholder="Write a reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleReplySubmit(comment._id)
                        }
                        className="flex-1 bg-zinc-900 border-zinc-700 text-white text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleReplySubmit(comment._id)}
                        disabled={!replyText.trim()}
                      >
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Replies Section */}
              {isExpanded && hasReplies && (
                <div className="ml-12 border-zinc-700">
                  {replies.map((reply) => {
                    const isReplyOwner = currentUser?._id === reply.userId._id;
                    const isEditingReply = editingCommentId === reply._id;
                    const replyHasMedia = reply.media && reply.media.length > 0;

                    return (
                      <div
                        key={reply._id}
                        className="px-4 py-3 flex gap-3 border-zinc-800"
                      >
                        <Avatar
                          src={reply.userId.profilePhoto}
                          alt={reply.userId.username}
                          className="h-8 w-8"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {reply.userId.username}
                              </span>
                              <span className="text-zinc-500 text-xs">
                                {formatTimeAgo(reply.createdAt)}
                              </span>
                            </div>
                            {isReplyOwner && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingCommentId(reply._id);
                                    setEditCommentContent(reply.content);
                                  }}
                                  className="text-zinc-500 hover:text-white"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setDeleteCommentId(reply._id)}
                                  className="text-zinc-500 hover:text-red-500"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditingReply ? (
                            <div className="mt-2">
                              <textarea
                                value={editCommentContent}
                                onChange={(e) =>
                                  setEditCommentContent(e.target.value)
                                }
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs"
                              />
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditCommentContent("");
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleEditComment(reply._id)}
                                  disabled={!editCommentContent.trim()}
                                >
                                  {isUpdatingComment ? (
                                    <Loader2 className="animate-spin h-3 w-3" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="mt-1 text-zinc-200 text-xs">
                                {reply.content}
                              </p>

                              {/* Reply Media */}
                              {replyHasMedia && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {reply.media.map((mediaItem, index) => (
                                    <div key={index} className="relative group">
                                      {mediaItem.mediaType === 'image' && (
                                        <img
                                          src={mediaItem.thumbnailUrl}
                                          alt={`Reply media ${index + 1}`}
                                          className="max-w-[150px] max-h-[150px] rounded-lg border border-zinc-700 object-cover hover:opacity-90 transition-opacity cursor-pointer"
                                          onClick={() => window.open(mediaItem.thumbnailUrl, '_blank')}
                                        />
                                      )}
                                      {mediaItem.mediaType === 'video' && (
                                        <div className="relative">
                                          <video
                                            src={mediaItem.thumbnailUrl}
                                            className="max-w-[150px] max-h-[150px] rounded-lg border border-zinc-700 object-cover"
                                            controls
                                          />
                                        </div>
                                      )}
                                      {/* Media type badge */}
                                      <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded-md backdrop-blur-sm">
                                        {mediaItem.mediaType}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                            <button
                              onClick={() => handleCommentLike(reply._id)}
                              className="flex items-center gap-1 hover:text-red-400 transition"
                            >
                              <Heart
                                className={`w-3 h-3 ${
                                  reply.isLiked
                                    ? "fill-red-500 text-red-500"
                                    : ""
                                }`}
                              />
                              {reply.likes.length > 0
                                ? `${reply.likes.length} Likes`
                                : "Like"}
                            </button>
                            {reply.isEdited && <span>(edited)</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Modal */}
      {deleteCommentId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full p-6">
            <h3 className="text-lg font-semibold mb-2 text-white">
              Delete Comment?
            </h3>
            <p className="text-zinc-400 text-sm mb-5">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setDeleteCommentId(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteComment(deleteCommentId)}
                disabled={isDeletingComment}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isDeletingComment ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostDetail;