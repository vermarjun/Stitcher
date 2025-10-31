import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import type { IUser } from "@/State/Types";

interface HeaderProps {
  user: IUser;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <div className="sticky top-0 z-50 bg-black mb-6 p-6 border-b border-zinc-800 h-14 flex items-center w-full justify-between">
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Account Settings
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-white">{user.username}</p>
            <p className="text-xs text-zinc-400">{user.email}</p>
          </div>
          <Avatar className="h-10 w-10 border border-zinc-700">
            <AvatarImage
              src={user.profilePhoto}
              alt="Profile"
              className="object-cover"
            />
            <AvatarFallback className="bg-zinc-800 text-white">
              {user.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
};

export default Header;