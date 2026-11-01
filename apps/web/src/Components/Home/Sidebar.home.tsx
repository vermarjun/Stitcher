import React, { useState, useRef, useEffect } from "react";
import {
  Home,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Clapperboard,
} from "lucide-react";
import type { IUser } from "@/State/Types";
import type { NavigateFunction } from "react-router-dom";
import { AuroraText } from "../magicui/aurora-text";

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

  const menuItems = [
    { icon: Home, label: "Home", key: "home" },
    { icon: FolderOpen, label: "All Projects", key: "projects" },
    { icon: Clapperboard, label: "Generations", key: "generations" },
  ];

  function onSignOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/auth");
  }

  // Refined active state: Minimal Green Brand Touch
  const activeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  const inactiveClass = "text-zinc-400 hover:bg-zinc-900/50 hover:text-white border-transparent hover:border-zinc-800/50";

  return (
    <>
      {!collapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <div
        className={`h-full z-50 bg-black border-r border-zinc-800 
        transition-all duration-300 ease-in-out flex flex-col
        lg:relative lg:translate-x-0
        ${
          collapsed
            ? "hidden lg:flex w-[70px] lg:translate-x-0 "
            : "w-72 translate-x-0 fixed left-0 top-0 z-50 "
        }`}
      >
        {/* Header */}
        <div className={`flex h-16 items-center ${collapsed ? 'justify-center' : 'justify-between px-5'} border-b border-zinc-800`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <AuroraText
                className="text-2xl"
                padding=""
                colors={["#19E5A1", "#02684D", "#10B981"]}
              >
                <span className="font-pacifico text-white tracking-tight">
                  Stitcher
                </span>
              </AuroraText>
            </div>
          )}
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-zinc-500 transition-all hover:bg-zinc-900 hover:text-white"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-auto py-5 px-3">
          <nav className="space-y-6">
            <div className="space-y-1">
              {!collapsed && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Main
                </h3>
              )}
              {menuItems.map((item, index) => {
                const active = activeItem === item.key;
                return (
                  <button
                    key={index}
                    onClick={() => onNavigate(item.key)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium border
                    transition-all duration-200 
                    ${active ? activeClass : inactiveClass}
                    ${collapsed ? "justify-center px-2" : ""}`}
                  >
                    <div className="relative flex items-center justify-center">
                      <item.icon size={20} className={active ? "text-emerald-400" : "text-zinc-400"} />
                    </div>
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1">
              {!collapsed && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Account
                </h3>
              )}
               <button
                onClick={() => onNavigate("settings")}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium border
                  transition-all duration-200 
                  ${
                    activeItem === "settings"
                      ? activeClass
                      : inactiveClass
                  }
                  ${collapsed ? "justify-center px-2" : ""}`}
              >
                <Settings size={20} className={activeItem === "settings" ? "text-emerald-400" : "text-zinc-400"} />
                {!collapsed && (
                  <span className="truncate">Settings</span>
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
              className={`flex w-full items-center gap-3 rounded-md px-2 py-2
                hover:bg-zinc-900 transition-all border border-transparent hover:border-zinc-800
                ${collapsed ? "justify-center" : ""}`}
            >
              <div
                className={`rounded-full border border-zinc-800 overflow-hidden bg-zinc-900/50 flex items-center justify-center flex-shrink-0
                ${collapsed ? "h-8 w-8" : "h-9 w-9"}`}
              >
                <img
                  src={user.profilePhoto}
                  className="w-full h-full object-cover opacity-90"
                />
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-white text-sm truncate">
                    {user.username}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {user.email}
                  </div>
                </div>
              )}
            </button>
            {/* User Menu */}
            {showUserMenu && !collapsed && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-lg border border-zinc-800 bg-black shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="border-b border-zinc-800 p-4 bg-zinc-900/30">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full border border-zinc-700 overflow-hidden">
                      <img
                        src={user.profilePhoto}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white text-sm truncate">
                        {user.username}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2 p-3 text-sm font-medium text-zinc-400 
                    hover:bg-red-500/10 hover:text-red-400 transition-all border-t border-zinc-800"
                >
                  <LogOut size={16} />
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
