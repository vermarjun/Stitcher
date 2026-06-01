import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import type { IUser } from "@/State/Types";

interface HeaderProps {
  user: IUser;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
  return (
    <div className="sticky top-0 z-40 mb-6 h-14 w-full border-b border-zinc-800/80 bg-black/60 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight text-white">
            Settings
          </h1>
          <div className="hidden h-3.5 w-px bg-zinc-800 sm:block" />
          <span className="hidden text-xs text-zinc-500 sm:block">
            Manage your account preferences
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium leading-tight text-white">
              {user.username}
            </p>
            <p className="text-[11px] leading-tight text-zinc-500">
              {user.email}
            </p>
          </div>
          <Avatar className="h-8 w-8 ring-1 ring-zinc-800">
            <AvatarImage
              src={user.profilePhoto}
              alt="Profile"
              className="object-cover"
            />
            <AvatarFallback className="bg-zinc-800 text-xs font-medium text-zinc-400">
              {user.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
};

export default Header;
