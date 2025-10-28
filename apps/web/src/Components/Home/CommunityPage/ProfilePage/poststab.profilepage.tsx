import { useEffect, useState } from "react";
import api from "@/api";
import PostList from "./PostList.profilepage";
import type { ICommunityPost } from "../main.communitypage";

// Skeleton Component
function SkeletonPostList() {
  // Render 3 skeleton posts
  return (
    <div className="flex flex-col divide-y divide-neutral-800 w-full animate-pulse">
      {[...Array(3)].map((_, i) => (
        <article
          key={i}
          className="px-5 py-4 hover:bg-neutral-900/60 transition-colors duration-200"
        >
          <div className="flex items-start gap-3">
            {/* Profile Picture */}
            <div className="w-10 h-10 rounded-full bg-neutral-800" />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 bg-neutral-800 rounded" />
                  <div className="h-3 w-12 bg-neutral-800 rounded" />
                </div>
                <div className="h-3 w-10 bg-neutral-800 rounded" />
              </div>

              {/* Title + Description */}
              <div className="mt-2 space-y-2">
                <div className="h-4 w-3/4 bg-neutral-800 rounded" />
                <div className="h-3 w-1/2 bg-neutral-800 rounded" />
              </div>

              {/* Media */}
              <div className="mt-3 w-full aspect-video bg-neutral-900 rounded-2xl border border-zinc-700" />

              {/* Stats */}
              <div className="flex items-center gap-8 mt-3">
                <div className="h-3 w-12 bg-neutral-800 rounded" />
                <div className="h-3 w-12 bg-neutral-800 rounded" />
                <div className="h-3 w-12 bg-neutral-800 rounded" />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

interface Props {
  userId: string;
  onPostClick: (post: ICommunityPost) => void;
}

function PostsTab({ userId, onPostClick }: Props) {
  const [posts, setPosts] = useState<ICommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchPosts() {
      try {
        setLoading(true);
        const res = await api.get(`/community/users/${userId}/posts?limit=20`);
        if (mounted) setPosts(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch posts", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPosts();
    return () => {
      mounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center py-6 w-full">
        <SkeletonPostList />
      </div>
    );
  }

  return (
    <PostList 
      onPostClick={onPostClick}
      posts={posts}
      emptyMessage="No posts yet. Start sharing your thoughts!"
    />
  );
}

export default PostsTab;
