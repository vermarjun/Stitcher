import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Trash, Loader2, Settings, Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import api from "@/api";
import { toast } from "sonner";
import { Skeleton } from "@/Components/ui/skeleton";

type ObjectId = string;

export type NotificationType =
  | "follow"
  | "post_like"
  | "post_comment"
  | "comment_like"
  | "comment_reply"
  | "new_post_from_following"
  | "mention"
  | "post_featured"
  | "milestone"
  | "profile_update"
  | "system";

export interface NotificationMetadata {
  postId?: ObjectId;
  postTitle?: string;
  commentId?: ObjectId;
  commentContent?: string;
  [key: string]: any;
}

export interface Notification {
  _id: string;
  recipientId: string;
  senderId:
    | { _id?: string; username?: string; profilePhoto?: string }
    | string
    | null;
  type: NotificationType;
  message: string;
  metadata?: NotificationMetadata;
  isRead: boolean;
  isActionable?: boolean;
  actionUrl?: string;
  createdAt: string;
  readAt?: string;
}

interface ApiResponsePaginated {
  notifications?: Notification[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
  [key: string]: any;
}

const PAGE_LIMIT = 20;

const NotificationsComponent: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [filter, setFilter] = useState<"all" | "unread" | "mentions">("all");
  const navigate = useNavigate();

  const buildQuery = (pageNum = 1) => {
    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    params.set("limit", String(PAGE_LIMIT));
    if (filter === "unread") params.set("unreadOnly", "true");
    if (filter === "mentions") params.set("type", "mention");
    return params.toString();
  };

  const fetchNotifications = useCallback(
    async (pageToLoad = 1, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const q = buildQuery(pageToLoad);
        const res = await api.get<ApiResponsePaginated>(`/notifications?${q}`);

        const payload = res.data?.data ?? res.data ?? {};
        const items: Notification[] = payload.notifications ?? [];
        const pagination = payload.pagination;

        setNotifications((prev) => (append ? [...prev, ...items] : items));

        if (pagination) {
          setHasMore(pagination.page * PAGE_LIMIT < pagination.total);
        } else {
          setHasMore(items.length === PAGE_LIMIT);
        }
        setPage(pageToLoad);
      } catch (err: any) {
        console.error("Failed to fetch notifications:", err);
        toast.error(err?.message || "Failed to load notifications");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    fetchNotifications(1, false);
  }, [fetchNotifications, filter]);

  useEffect(() => {
    const handler = () => fetchNotifications(1, false);
    window.addEventListener("notifications-updated", handler as EventListener);
    return () =>
      window.removeEventListener(
        "notifications-updated",
        handler as EventListener
      );
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const res = await api.patch<{ success: boolean; data: { readAt: string } }>(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id
            ? {
                ...n,
                isRead: true,
                readAt: res.data?.data?.readAt ?? new Date().toISOString(),
              }
            : n
        )
      );
      window.dispatchEvent(new CustomEvent("notifications-updated"));
    } catch (err: any) {
      toast.error(err?.message || "Could not mark as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch<any>("/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        }))
      );
      window.dispatchEvent(new CustomEvent("notifications-updated"));
      toast.success("Marked all as read");
    } catch (err: any) {
      toast.error("Failed to mark all as read");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      toast.success("Notification deleted");
      window.dispatchEvent(new CustomEvent("notifications-updated"));
    } catch (err: any) {
      toast.error("Failed to delete notification");
    }
  };

  const onNotificationClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n._id);
    if (n.actionUrl) {
      if (n.actionUrl.startsWith("/")) navigate(n.actionUrl);
      else window.location.href = n.actionUrl;
    } else if (n.metadata?.postId) {
      navigate(`/community/post/${n.metadata.postId}`);
    }
  };

  const loadMore = () => {
    if (!hasMore) return;
    fetchNotifications(page + 1, true);
  };

  const DEFAULT_AVATAR = "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";

  const NotificationToItem = ({ n }: { n: Notification }) => {
     const sender =
      n.senderId != null && typeof n.senderId === "object"
        ? (n.senderId as {
            username?: string;
            profilePhoto?: string;
          })
        : null;

     return (
        <div
          onClick={() => onNotificationClick(n)}
          className={`relative group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer mb-3
            ${
              n.isRead
                ? "bg-zinc-900/20 border-zinc-800/50 hover:bg-zinc-900/40 hover:border-zinc-800"
                : "bg-emerald-900/5 border-emerald-500/20 hover:bg-emerald-900/10 hover:border-emerald-500/30"
            }`}
        >
          {/* Unread indicator dot */}
          {!n.isRead && (
            <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          )}

          <div className="flex-shrink-0 pt-0.5">
            {n.senderId || n.type === "profile_update" ? (
              <div className="h-10 w-10 rounded-full bg-zinc-800 overflow-hidden ring-1 ring-zinc-800">
                <img
                  src={
                    sender?.profilePhoto ??
                    n.metadata?.profilePhoto ??
                    DEFAULT_AVATAR
                  }
                  alt={sender?.username ?? "user"}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center ring-1 ring-zinc-800">
                  <Settings className="h-5 w-5 text-zinc-400" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pr-6">
             <div className="flex items-center gap-2 mb-0.5">
                 <span className={`text-sm font-semibold ${n.isRead ? 'text-zinc-200' : 'text-white'}`}>
                    {sender?.username ?? (typeof n.senderId === "string" ? n.senderId : "System")}
                 </span>
                 <span className="text-zinc-600 text-[10px]">•</span>
                 <span className="text-xs text-zinc-500">
                   {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                 </span>
             </div>
             
             <p className={`text-[15px] leading-relaxed ${n.isRead ? 'text-zinc-400' : 'text-zinc-200'}`}>
                {n.message}
             </p>
          </div>

          {/* Hover Actions */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2">
             {!n.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(n._id);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 backdrop-blur-sm"
                  title="Mark as read"
                >
                  <Check size={14} />
                </button>
             )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(n._id);
                }}
                className="p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 backdrop-blur-sm"
                title="Delete"
              >
                <Trash size={14} />
              </button>
          </div>
        </div>
     );
  };

  return (
    <div className="min-h-screen bg-black text-white pb-20 md:pb-10">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-zinc-800 h-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
             {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-medium">
                    {notifications.filter(n => !n.isRead).length} new
                </span>
             )}
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-zinc-900/50 rounded-lg p-1 border border-zinc-800/50">
                {(['all', 'unread', 'mentions'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                      filter === f
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
             </div>

             <button
                onClick={markAllAsRead}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
         {/* List */}
         <div className="space-y-1">
            {loading && notifications.length === 0 ? (
               <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 border border-zinc-800/50 rounded-xl bg-zinc-900/20">
                      <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-1/4 bg-zinc-800" />
                        <Skeleton className="h-4 w-3/4 bg-zinc-800" />
                      </div>
                    </div>
                  ))}
               </div>
            ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500 space-y-4">
                   <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-zinc-800">
                      <Bell className="w-6 h-6 text-zinc-600" />
                   </div>
                   <p className="text-sm">You're all caught up!</p>
                </div>
            ) : (
                <>
                   {notifications.map(n => <NotificationToItem key={n._id} n={n} />)}
                   
                   {/* Load More */}
                   <div className="pt-4 flex justify-center">
                      {loadingMore ? (
                        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                      ) : hasMore && (
                        <button 
                          onClick={loadMore}
                          className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                          Load more
                        </button>
                      )}
                   </div>
                </>
            )}
         </div>
      </div>
    </div>
  );
};

export default NotificationsComponent;
