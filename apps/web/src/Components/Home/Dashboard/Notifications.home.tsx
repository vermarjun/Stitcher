import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Trash, Loader2, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import api from "@/api";
import { toast } from "sonner";

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
  // NOTE: senderId may be an object, a string (id), or null
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
        // you mentioned api instance already prefixes /api, so request the route directly
        const res = await api.get<ApiResponsePaginated>(`/notifications?${q}`);

        // backend returns: { success: true, data: { notifications: [...], pagination: {...} } }
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
      console.error("markAsRead error", err);
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
      console.error("markAllAsRead", err);
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
      console.error("deleteNotification", err);
      toast.error("Failed to delete notification");
    }
  };

  const onNotificationClick = (n: Notification) => {
    if (!n.isRead) markAsRead(n._id);
    if (n.actionUrl) {
      if (n.actionUrl.startsWith("/")) navigate(n.actionUrl);
      else window.location.href = n.actionUrl;
    } else if (n.metadata?.postId) {
      navigate(`/posts/${n.metadata.postId}`);
    }
  };

  const loadMore = () => {
    if (!hasMore) return;
    fetchNotifications(page + 1, true);
  };

  // default avatar
  const DEFAULT_AVATAR =
    "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";

  return (
    <div className="min-h-full">
      <div className="max-w-full mx-auto">
        <div className="p-6 flex items-center justify-between mb-4 h-14 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Notifications
              </h1>
              {/* <p className="text-sm text-zinc-400">All activity, mentions and updates for you.</p> */}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-zinc-900 rounded-md p-1">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-md text-sm ${
                  filter === "all"
                    ? "bg-green-600/20 text-green-400"
                    : "text-zinc-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1 rounded-md text-sm ${
                  filter === "unread"
                    ? "bg-green-600/20 text-green-400"
                    : "text-zinc-300"
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter("mentions")}
                className={`px-3 py-1 rounded-md text-sm ${
                  filter === "mentions"
                    ? "bg-green-600/20 text-green-400"
                    : "text-zinc-300"
                }`}
              >
                Mentions
              </button>
            </div>
            <button
              onClick={markAllAsRead}
              className="text-sm px-3 py-1 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              Mark all read
            </button>
          </div>
        </div>

        <div className="px-6">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
            {loading && (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-zinc-800" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                        <div className="h-3 w-1/4 bg-zinc-800 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="p-6 text-center text-zinc-400">
                No notifications yet, You're all caught up ✨
              </div>
            )}

            {!loading &&
              notifications.map((n) => {
                // Safe sender extraction: account for null, string id or object
                const sender =
                  n.senderId != null && typeof n.senderId === "object"
                    ? (n.senderId as {
                        username?: string;
                        profilePhoto?: string;
                      })
                    : null;

                return (
                  <div
                    key={n._id}
                    onClick={() => onNotificationClick(n)}
                    className={`flex items-start gap-4 p-4 hover:bg-zinc-900/60 cursor-pointer transition-colors ${
                      n.isRead
                        ? ""
                        : "bg-zinc-900/10 border-l-4 border-green-600/30"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {n.senderId || n.type === "profile_update" ? (
                        <div className="h-12 w-12 rounded-full bg-zinc-800 overflow-hidden">
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
                        <Settings className="h-12 w-12 text-zinc-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm">
                            <span className="font-medium text-white">
                              {sender?.username ??
                                (typeof n.senderId === "string"
                                  ? n.senderId
                                  : "System")}
                            </span>
                          </div>

                          <span className="text-xs mt-1 text-zinc-400 truncate break-words">
                            {n.message}
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-zinc-400">
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-2">
                            {!n.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(n._id);
                                }}
                                title="Mark as read"
                                className="rounded-md p-1 hover:bg-zinc-800/60"
                              >
                                <Check size={16} className="text-white" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n._id);
                              }}
                              title="Delete"
                              className="rounded-md p-1 hover:bg-zinc-800/60"
                            >
                              <Trash size={16} className="text-white" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

            <div className="p-4 flex items-center justify-center">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Loader2 className="animate-spin" />
                  Loading...
                </div>
              ) : hasMore ? (
                <button
                  onClick={loadMore}
                  className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm text-white"
                >
                  Load more
                </button>
              ) : notifications.length > 0 ? (
                <div className="text-xs text-zinc-500">
                  You're all caught up
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsComponent;
