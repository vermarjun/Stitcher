import { Eye, MessageCircle, Heart } from "lucide-react";
import type { ICommunityPost } from "../main.communitypage";

function PostList({
  posts,
  emptyMessage,
  onPostClick
}: {
  posts: ICommunityPost[];
  emptyMessage: string;
  onPostClick: (post: ICommunityPost) => void;
}) {
  if (!posts?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Eye className="w-12 h-12 text-neutral-600 mb-4" />
        <p className="text-neutral-400 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-800">
      {posts.map((p) => (
        <article
          key={p._id}
          className="px-5 py-4 hover:bg-neutral-900/60 transition-colors duration-200 cursor-pointer"
        >
          {/* Header */}
          <div onClick={() => onPostClick(p)} className="flex items-start gap-3">
            <img
              src={p.authorId?.profilePhoto}
              alt={p.authorId?.username}
              className="w-10 h-10 rounded-full object-cover"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-100">
                    {p.authorId?.username}
                  </h3>
                  {p.authorId?.plan && (
                    <span className="text-xs text-neutral-500">
                      • {p.authorId.plan}
                    </span>
                  )}
                </div>

                {p.publishedAt && (
                  <span className="text-xs text-neutral-500 shrink-0">
                    {new Date(p.publishedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>

              {/* Title + Description */}
              <div className="mt-1">
                <p className="text-sm text-neutral-100 font-medium leading-snug">
                  {p.title}
                </p>
                {p.description && (
                  <p className="text-sm text-neutral-400 leading-snug mt-1">
                    {p.description}
                  </p>
                )}
              </div>

              {/* Media (if any) */}
              {p.assetId?.thumbnail && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-700">
                  <img
                    src={p.assetId.thumbnail}
                    alt={p.title}
                    className="w-full aspect-video object-cover"
                  />
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-8 mt-3 text-neutral-500 text-sm">
                <div className="flex items-center gap-1 hover:text-red-400 transition">
                  <Heart className="w-4 h-4" />
                  <span>{p.likesCount ?? 0}</span>
                </div>
                <div className="flex items-center gap-1 hover:text-blue-400 transition">
                  <MessageCircle className="w-4 h-4" />
                  <span>{p.commentsCount ?? 0}</span>
                </div>
                <div className="flex items-center gap-1 hover:text-green-400 transition">
                  <Eye className="w-4 h-4" />
                  <span>{p.analytics?.views ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default PostList;
