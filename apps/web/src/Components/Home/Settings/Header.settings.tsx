import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import type { IUser } from "@/State/Types";

interface HeaderProps {
  user: IUser;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <div className="sticky top-0 z-40 w-full backdrop-blur-md bg-black/50 border-b border-zinc-800 h-16 mb-8">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-white via-white to-zinc-400 bg-clip-text text-transparent tracking-tight">
            Settings
          </h1>
          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block"></div>
          <span className="text-zinc-500 text-sm hidden sm:block">
            Manage your account preferences
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{user.username}</p>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
          <Avatar className="h-9 w-9 border-2 border-zinc-900 ring-2 ring-zinc-800">
            <AvatarImage
              src={user.profilePhoto}
              alt="Profile"
              className="object-cover"
            />
            <AvatarFallback className="bg-zinc-800 text-zinc-400 font-medium">
              {user.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
};

export default Header;