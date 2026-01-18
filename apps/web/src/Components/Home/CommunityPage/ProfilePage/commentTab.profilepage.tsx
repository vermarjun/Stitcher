import { MessageCircle, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/api";

interface IMedia {
  mediaType: string;
  thumbnailUrl: string;
  order: number;
}

interface IComment {
  postId: string;
  postTitle: string;
  commentId: string;
  content: string;
  media: IMedia[];
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
}

// Skeleton component for comment list
function SkeletonCommentList() {
  return (
    <div className="flex flex-col divide-y divide-neutral-800 w-full animate-pulse">
      {[...Array(4)].map((_, i) => (
        <article
          key={i}
          className="px-5 py-4 hover:bg-neutral-900/60 transition-colors duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Replied to */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3 w-20 bg-neutral-800 rounded" />
                <div className="h-3 w-32 bg-neutral-800 rounded" />
              </div>

              {/* Comment content (2 lines of text) */}
              <div className="space-y-2 mt-1">
                <div className="h-3 w-5/6 bg-neutral-800 rounded" />
                <div className="h-3 w-2/3 bg-neutral-800 rounded" />
              </div>

              {/* Optional media */}
              <div className="mt-3 w-full aspect-video bg-neutral-900 rounded-2xl border border-neutral-800" />

              {/* Stats + Timestamp */}
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-12 bg-neutral-800 rounded" />
                </div>
                <div className="h-3 w-16 bg-neutral-800 rounded" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CommentList({
  comments,
  emptyMessage,
}: {
  comments: IComment[];
  emptyMessage: string;
}) {
  if (!comments?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageCircle className="w-12 h-12 text-neutral-600 mb-4" />
        <p className="text-neutral-400 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-800">
      {comments.map((c) => (
        <article
          key={c.commentId}
          className="px-5 py-4 hover:bg-neutral-900/60 transition-colors duration-200 cursor-pointer"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Replied to */}
              <p className="text-sm text-neutral-500 mb-1">
                <span className="text-neutral-400">Replied to</span>{" "}
                <span className="text-blue-400 hover:underline">
                  {c.postTitle || "a post"}
                </span>
              </p>

              {/* Comment Content */}
              <p className="text-sm text-neutral-100 leading-snug whitespace-pre-line">
                {c.content}
              </p>

              {/* Media (if present) */}
              {c.media?.length > 0 && c.media[0]?.thumbnailUrl && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-neutral-800">
                  <img
                    src={c.media[0].thumbnailUrl}
                    alt="Comment media"
                    className="w-full aspect-video object-cover"
                  />
                </div>
              )}

              {/* Stats + Timestamp */}
              <div className="flex items-center justify-between mt-3 text-sm text-neutral-500">
                <div className="flex items-center gap-1 hover:text-red-400 transition">
                  <Heart className="w-4 h-4" />
                  <span>{c.likesCount ?? 0}</span>
                </div>
                <span className="text-xs text-neutral-500">
                  {new Date(c.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {c.isEdited && (
                    <span className="ml-1 text-neutral-600">(edited)</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CommentsTab({ userId }: { userId: string }) {
  const [comments, setComments] = useState<IComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchComments() {
      try {
        setLoading(true);
        const res = await api.get<{ success: boolean; comments: IComment[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/community/users/${userId}/comments?limit=20`);
        if (mounted) {
          setComments(res.data.comments || []);
        }
      } catch (err) {
        console.error("Failed to fetch comments", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchComments();
    return () => {
      mounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center py-6 w-full">
        {/* Skeleton for comment list */}
        <SkeletonCommentList />
      </div>
    );
  }

  return (
    <CommentList
      comments={comments}
      emptyMessage="No comments yet. Join the conversation!"
    />
  );
}

export default CommentsTab;
