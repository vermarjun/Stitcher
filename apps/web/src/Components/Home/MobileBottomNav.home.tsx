import React, { useState, useRef, useEffect } from "react";
import {
  Home,
  Users,
  Backpack,
  LayoutTemplate,
  Settings,
  LogOut,
} from "lucide-react";
import type { IUser } from "@/State/Types";

interface Props {
  activeItem: string;
  onNavigate: (itemKey: string) => void;
  user: IUser;
  onSignOut: () => void;
}

const MobileBottomNav: React.FC<Props> = ({
  activeItem,
  onNavigate,
  user,
  onSignOut,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navItems = [
    { icon: Home, label: "Home", key: "home" },
    { icon: Users, label: "Community", key: "community" },
    { icon: Backpack, label: "Backpack", key: "backpack" },
    { icon: LayoutTemplate, label: "Templates", key: "templates" },
  ];

  const activeClass = "text-emerald-400";
  const inactiveClass = "text-zinc-500 hover:text-zinc-300";

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-t border-zinc-800 pb-safe md:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                activeItem === item.key ? activeClass : inactiveClass
              }`}
            >
              <item.icon size={24} strokeWidth={activeItem === item.key ? 2.5 : 2} />
              {/* <span className="text-[10px] font-medium mt-1">{item.label}</span> */}
            </button>
          ))}

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                showProfileMenu ? "text-white" : inactiveClass
              }`}
            >
              <div className={`h-6 w-6 rounded-full border ${activeItem === 'settings' ? 'border-emerald-500' : 'border-zinc-700'} overflow-hidden`}>
                 <img src={user.profilePhoto} alt="Profile" className="h-full w-full object-cover" />
              </div>
              {/* <span className="text-[10px] font-medium mt-1">Profile</span> */}
            </button>

            {showProfileMenu && (
              <div className="absolute bottom-full right-0 mb-3 w-48 rounded-lg border border-zinc-800 bg-black shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
                <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
                    <p className="text-sm font-medium text-white truncate">{user.username}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    onNavigate("settings");
                    setShowProfileMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900 transition-colors"
                >
                  <Settings size={18} />
                  Settings
                </button>
                <div className="h-px bg-zinc-800 mx-2"></div>
                <button
                  onClick={onSignOut}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-16 md:hidden" />
    </>
  );
};

export default MobileBottomNav;
