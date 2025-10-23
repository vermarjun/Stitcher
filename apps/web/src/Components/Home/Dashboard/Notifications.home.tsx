import React, { useState } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, X, Sparkles, Ghost } from 'lucide-react';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'reply' | 'follow';
  message: string;
  user: string;
  timestamp: Date;
}

const NotificationsComponent: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'like',
      message: 'liked your post "Building React Components"',
      user: 'Sarah Chen',
      timestamp: new Date(Date.now() - 5 * 60000)
    },
    {
      id: '2',
      type: 'comment',
      message: 'commented on your post',
      user: 'Alex Kumar',
      timestamp: new Date(Date.now() - 60 * 60000)
    },
  ]);

  function timeAgo(date: Date) {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} sec${seconds !== 1 ? 's' : ''} ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }

  const handleDismiss = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-400" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-blue-400" />;
      case 'reply':
        return <MessageCircle className="w-4 h-4 text-green-400" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  const GhostPlaceholder = () => (
    <>
      {[1, 2, 3].map((index) => (
        <tr
          key={index}
          className="border-b border-zinc-800 last:border-b-0 animate-pulse relative"
        >
          <td className="py-4 px-6">
            <div className="flex items-center space-x-3">
              <Ghost className="w-4 h-4 text-zinc-700 animate-float flex-shrink-0" />
              <div
                className="h-3 bg-gradient-to-r from-zinc-800 to-zinc-700 rounded blur-[0.5px] opacity-50"
                style={{ width: `${120 + index * 30}px` }}
              ></div>
            </div>
          </td>
          <td className="py-4 px-6">
            <div
              className="h-3 bg-gradient-to-r from-zinc-800 to-zinc-700 rounded blur-[0.5px] opacity-50"
              style={{ width: `${70 + index * 12}px` }}
            ></div>
          </td>
          <td className="py-4 px-6">
            <div className="h-8 w-8 bg-gradient-to-r from-red-900/30 to-red-800/30 rounded blur-[0.5px] opacity-40"></div>
          </td>
        </tr>
      ))}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-3 left-16 animate-bounce delay-300">
          <Sparkles className="w-2 h-2 text-zinc-600 opacity-30" />
        </div>
        <div className="absolute top-10 right-28 animate-bounce delay-700">
          <Sparkles className="w-1.5 h-1.5 text-zinc-600 opacity-25" />
        </div>
        <div className="absolute bottom-5 left-32 animate-bounce delay-1000">
          <Sparkles className="w-1.5 h-1.5 text-zinc-600 opacity-35" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-transparent">
          <div className="bg-black/5 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-4 mt-10 shadow-2xl text-center">
            <div className="bg-white/10 border border-white/20 rounded-full p-2 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-white/90" />
            </div>
            <p className="text-zinc-400 text-sm font-light max-w-[240px] mx-auto">
              No new notifications for now. If someone likes your posts, comments or replies to your comments they will appear here.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  if (notifications.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-white">Notifications</h2>
            <p className="text-zinc-400 text-sm">Loading your notifications...</p>
          </div>
        </div>
        <div className="bg-black border border-zinc-800 rounded-lg shadow-2xl relative">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                    Activity
                  </th>
                  <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                    Time
                  </th>
                  <th className="text-center py-3 px-6 text-zinc-300 text-xs font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                <GhostPlaceholder />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
          <p className="text-zinc-400 text-xs">
            {notifications.length === 0
              ? "Your notifications will appear here"
              : `You have ${notifications.length} new notification${notifications.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div className="bg-black border border-zinc-800 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                  Activity
                </th>
                <th className="text-left py-3 px-6 text-zinc-300 text-xs font-medium">
                  Time
                </th>
                <th className="text-center py-3 px-6 text-zinc-300 text-xs font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification, index) => (
                <tr
                  key={notification.id}
                  className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900/50 transition-colors duration-200 animate-in fade-in slide-in-from-left-4"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <td className="py-3 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center flex-shrink-0">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white text-sm font-medium">
                          {notification.user}
                        </span>
                        <span className="text-zinc-400 text-xs">
                          {notification.message}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-6 text-zinc-400 text-sm">
                    {timeAgo(notification.timestamp)}
                  </td>
                  <td className="py-3 px-6 flex justify-center items-center">
                    <button
                      onClick={() => handleDismiss(notification.id)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 h-8 w-8 rounded-md transition-colors duration-200 flex items-center justify-center"
                      title="Dismiss notification"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .slide-in-from-left-4 {
          animation: slideInFromLeft 0.4s ease-out forwards;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default NotificationsComponent;