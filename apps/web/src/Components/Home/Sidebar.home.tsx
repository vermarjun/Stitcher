import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Home,
  FolderOpen,
  Key,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutTemplate,
  Users,
  Backpack,
  BellIcon,
} from "lucide-react";
import type { IUser } from "@/State/Types";
import type { NavigateFunction } from "react-router-dom";
import { AuroraText } from "../magicui/aurora-text";
import api from "@/api";

interface Props {
  collapsed: Boolean;
  onToggle: () => void;
  user: IUser;
  activeItem: string;
  onNavigate: (itemKey: string) => void;
  navigate: NavigateFunction;
}

const Sidebar: React.FC<Props> = ({
  collapsed,
  onToggle,
  user,
  activeItem,
  onNavigate,
  navigate,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (collapsed) {
      setShowUserMenu(false);
    }
  }, [collapsed]);

  const fetchUnread = async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      const count = res.data?.data?.count ?? 0;
      setUnreadCount(count);
    } catch (err: any) {
      console.error("fetchUnread", err);
      // silently fail (don't spam toasts on sidebar polling)
      // toast.error("Failed to fetch unread count");
    }
  };

  useEffect(() => {
    fetchUnread();
    const handler = () => fetchUnread();
    window.addEventListener("notifications-updated", handler as EventListener);
    // poll every 30s for live feel
    const interval = setInterval(fetchUnread, 30000);
    return () => {
      window.removeEventListener(
        "notifications-updated",
        handler as EventListener
      );
      clearInterval(interval);
    };
  }, []);

  const menuItems = {
    create: [
      { icon: Home, label: "Home", key: "home" },
      { icon: FolderOpen, label: "All Projects", key: "projects" },
      { icon: Users, label: "Community", key: "community" },
      { icon: Backpack, label: "Backpack", key: "backpack" },
      { icon: BellIcon, label: "Notifications", key: "notifications" },
    ],
    api_keys: [
      { icon: CreditCard, label: "Pricing", key: "pricing" },
      { icon: Key, label: "API Keys", key: "api-keys" },
    ],
    browse: [{ icon: LayoutTemplate, label: "Templates", key: "templates" }],
  };

  function onSignOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/auth");
  }

  const emeraldActive =
    "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_6px_rgba(16,185,129,0.35)]";

  return (
    <>
      {!collapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <div
        className={`h-full z-50 bg-[#0B0D0F] border-r border-zinc-800 
        transition-all duration-300 ease-in-out flex flex-col
        lg:relative lg:translate-x-0
        ${
          collapsed
            ? "w-14 lg:translate-x-0 "
            : "md:w-72 xl:w-80 translate-x-0 fixed left-0 top-0 z-50 "
        }`}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between p-3 border-b border-zinc-800">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <AuroraText
                className="text-2xl"
                padding=""
                colors={["#19E5A1", "#02684D"]}
              >
                <span className="font-pacifico text-white tracking-tight mr-1">
                  Stitcher
                </span>
              </AuroraText>
            </div>
          )}
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-zinc-400 transition-all hover:bg-zinc-800 hover:text-white active:scale-95"
          >
            {collapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
          </button>
        </div>

        <div className="text-white flex justify-center items-center w-full">
          <p className="text-sm">
            Free
          </p>
        </div>

        {/* Search */}
        {/* {!collapsed && (
          <div className="p-3 z-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                className="w-full rounded-lg border border-zinc-700 bg-[#111315] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500
                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                placeholder="Search your projects"
                type="search"
              />
            </div>
          </div>
        )} */}

        {/* Navigation */}
        <div className="flex-1 overflow-auto p-3 pb-3">
          <nav className="space-y-4">
            <div className="space-y-1 pb-2">
              {!collapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Create
                </h3>
              )}
              {collapsed && <div className="pt-4"></div>}
              {menuItems.create.map((item, index) => {
                const active = activeItem === item.key;
                return (
                  <button
                    key={index}
                    onClick={() => onNavigate(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium
                    transition-all duration-200 hover:hover:bg-[#1A1D21] hover:text-white
                    ${
                      active
                            ? emeraldActive
                            : "text-zinc-300 hover:bg-[#1A1D21] hover:text-white"
                    }
                    ${collapsed ? "justify-center px-2.5" : ""}`}
                  >
                    <div className="relative">
                      <item.icon size={20} className="flex-shrink-0" />
                      {/* show unread badge for notifications */}
                      {item.key === "notifications" && unreadCount > 0 && (
                        <div className="absolute -top-2 -right-3 min-w-[18px] px-1.5 text-xs leading-4 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </div>
                      )}
                    </div>
                    {!collapsed && (
                      <span className="truncate text-sm">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1 pb-2">
              {!collapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  API Keys
                </h3>
              )}
              {menuItems.api_keys.map((item, index) => {
                const active = activeItem === item.key;
                return (
                  <button
                    key={index}
                    onClick={() => onNavigate(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium
                    transition-all duration-200 hover:bg-[#1A1D21] hover:text-white
                    ${
                      active
                        ? "bg-green-600/10 text-green-400 border border-green-600/20"
                        : "text-zinc-300"
                    }
                    ${collapsed ? "justify-center px-2.5" : ""}`}
                  >
                    <item.icon size={20} className="flex-shrink-0" />
                    {!collapsed && (
                      <span className="truncate text-sm">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1">
              {!collapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Browse
                </h3>
              )}
              {menuItems.browse.map((item, index) => {
                const active = activeItem === item.key;
                return (
                  <button
                    key={index}
                    onClick={() => onNavigate(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium
                    transition-all duration-200 hover:bg-[#1A1D21] hover:text-white
                    ${
                      active
                        ? "bg-green-600/10 text-green-400 border border-green-600/20"
                        : "text-zinc-300"
                    }
                    ${collapsed ? "justify-center px-2.5" : ""}`}
                  >
                    <item.icon size={20} className="flex-shrink-0" />
                    {!collapsed && (
                      <span className="truncate text-sm">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1">
              <button
                onClick={() => onNavigate("settings")}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium
                  transition-all duration-200 hover:bg-[#1A1D21] hover:text-white
                  ${collapsed ? "justify-center" : ""}
                ${
                  activeItem === "settings"
                    ? emeraldActive
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Settings size={20} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="truncate text-sm">Settings</span>
                )}
              </button>
            </div>
          </nav>
        </div>

        {/* User Profile */}
        <div className="border-t border-zinc-800 p-3">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm
                hover:bg-zinc-800 transition-all border border-emerald-800/40 bg-emerald-700/10
                ${collapsed ? "justify-center border-0" : ""}`}
            >
              <div
                className={`rounded-full border border-zinc-700 overflow-hidden bg-[#1A1D21] flex items-center justify-center 
                ${collapsed ? "h-8 w-8" : "h-9 w-9"}`}
              >
                <img src={user.profilePhoto} className="w-full h-full object-cover" />
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-white truncate">{user.username}</div>
                  <div className="text-xs text-zinc-400 truncate">{user.email}</div>
                </div>
              )}
            </button>

            {/* User Menu */}
            {showUserMenu && !collapsed && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-zinc-700 bg-[#111315] shadow-xl z-40">
                <div className="border-b border-zinc-700 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full border border-zinc-700 overflow-hidden">
                      <img src={user.profilePhoto} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{user.username}</div>
                      <div className="text-xs text-zinc-400 truncate">{user.email}</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2 p-3 text-sm text-red-400 
                    hover:bg-red-500/10 transition-all rounded-b-lg"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
