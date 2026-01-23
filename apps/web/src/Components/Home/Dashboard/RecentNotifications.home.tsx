import { Bell, ArrowRight, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import api from "@/api";

interface Notification {
  _id: string;
  recipientId: string;
  senderId:
    | { _id?: string; username?: string; profilePhoto?: string }
    | string
    | null;
  type: string;
  message: string;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

const RecentNotifications = ({ onNavigate }: { onNavigate: (key: string) => void }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentNotifications = async () => {
      try {
        setLoading(true);
        const res = await api.get<any>("/notifications?page=1&limit=2");
        const payload = res.data?.data ?? res.data ?? {};
        const items: Notification[] = payload.notifications ?? [];
        setNotifications(items);
      } catch (err) {
        console.error("Failed to fetch recent notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentNotifications();

    // Listen for notification updates
    const handler = () => fetchRecentNotifications();
    window.addEventListener("notifications-updated", handler as EventListener);
    return () => {
      window.removeEventListener("notifications-updated", handler as EventListener);
    };
  }, []);

  const DEFAULT_AVATAR = "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";

  // Empty state
  if (!loading && notifications.length === 0) {
    return (
      <div className="space-y-4 md:hidden">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold text-white">Recent Notifications</h2>
        </div>
        
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
            <Bell size={24} className="text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 mb-1">You don't have any new notifications</p>
          <p className="text-xs text-zinc-500 mb-5">Start sharing posts or follow people to stay connected</p>
          <button
            onClick={() => onNavigate("community")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-all"
          >
            <Users size={16} />
            Explore Community
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:hidden">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-white">Recent Notifications</h2>
        <button 
            onClick={() => onNavigate("notifications")}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
        >
            View All
            <ArrowRight size={12} />
        </button>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-zinc-800 h-10 w-10 flex-shrink-0"></div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 bg-zinc-800 rounded w-3/4"></div>
                  <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const sender =
              notif.senderId != null && typeof notif.senderId === "object"
                ? (notif.senderId as { username?: string; profilePhoto?: string })
                : null;

            return (
              <div
                key={notif._id}
                className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:bg-zinc-900 group cursor-pointer"
                onClick={() => onNavigate("notifications")}
              >
                {!notif.isRead && (
                  <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-emerald-500"></div>
                )}
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-zinc-800 overflow-hidden h-10 w-10 flex-shrink-0 ring-1 ring-zinc-800">
                    <img
                      src={sender?.profilePhoto ?? DEFAULT_AVATAR}
                      alt={sender?.username ?? "user"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-white text-sm truncate">
                        {sender?.username ?? "System"}
                      </p>
                      <span className="text-zinc-600 text-[10px]">•</span>
                      <span className="text-[10px] text-zinc-500">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecentNotifications;
