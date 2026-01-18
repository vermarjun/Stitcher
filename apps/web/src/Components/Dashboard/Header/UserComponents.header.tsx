import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Button } from "@/Components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { LogOut, Crown, Rocket, Zap } from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "@/api";
import type { IUser } from "@/State/Types";
import type { UserCreditsResponse } from "@/types/api.types";
import { useRefreshHeader } from "../context";

interface UserSectionProps {
  user?: IUser;
}

function UserSection({ user }: UserSectionProps) {
  const navigate = useNavigate();
  const { refreshHeader } = useRefreshHeader();

  async function handleLogout() {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const [tier, setTier] = useState("free");
  const [editingCredits, setEditingCredits] = useState(0);
  const [generationCredits, setGenerationCredits] = useState(0);

  const fetchData = async () => {
    const response = await api.get<UserCreditsResponse>("/users/me/credits");
    const data = response.data as any;
    if (data.success) {
      setTier(data.message.plan);
      setEditingCredits(data.message.credits.editing);
      setGenerationCredits(data.message.credits.generation);
    } else {
      console.error("Cant fetch latest credits details!");
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshHeader]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <p className="text-xs flex gap-1 border-r px-2 py-0.5 border-zinc-500">
          <span className="text-[#19E5A1]">{generationCredits}</span>
          <span className="capitalize">generations</span>
        </p>
        <p className="text-xs flex gap-1 border-r px-2 py-0.5 border-zinc-500">
          <span className="text-[#19E5A1]">{editingCredits}</span>
          <span className="capitalize">edits</span>
        </p>
      </div>

      {/* Plan Badge */}
      {tier === "max" && (
        <Badge
          variant="secondary"
          className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 
               text-cyan-300 border-cyan-500/30"
        >
          <Rocket className="w-3 h-3 mr-1 text-cyan-300" />
          Max Tier
        </Badge>
      )}

      {tier === "plus" && (
        <Badge
          variant="secondary"
          className="bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 
               text-purple-300 border-purple-500/30"
        >
          <Crown className="w-3 h-3 mr-1 text-purple-300" />
          Plus Tier
        </Badge>
      )}

      {tier === "basic" && (
        <Badge
          variant="secondary"
          className="bg-gradient-to-r from-blue-500/20 to-sky-500/20 
               text-blue-300 border-blue-500/30"
        >
          <Zap className="w-3 h-3 mr-1 text-blue-300" />
          Basic Tier
        </Badge>
      )}

      {(!tier || user?.plan === "free") && (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-zinc-700/30 to-zinc-800/20 
               text-zinc-300 border-zinc-600/40"
        >
          <Crown className="w-3 h-3 mr-1 text-zinc-400" />
          Free Tier
        </Badge>
      )}

      {/* User Dropdown Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-zinc-400 hover:bg-zinc-700 rounded-full hover:text-white transition-all duration-200"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profilePhoto} alt={user?.username} />
              <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs">
                {user?.username?.charAt(0)?.toUpperCase() || "A"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-64 border-neutral-700 bg-neutral-800/95 backdrop-blur-sm text-zinc-300 shadow-xl z-50"
          align="end"
        >
          {/* User Info Header */}
          <div className="px-3 py-3 border-b border-neutral-600 z-50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={user?.profilePhoto}
                  alt={user?.username}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                  {user?.username?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex justify-between items-end w-full">
                <div>
                  <p className="text-sm font-medium text-white truncate">
                    {user?.username || "User"}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {user?.email}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-gradient-to-r from-green-500/30 to-green-500/20 text-neutral-200 border-green-500/30"
                  >
                    {user?.plan || "Free"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="py-1">
            <DropdownMenuItem
              className="focus:text-red-100 focus:bg-red-700/40 cursor-pointer text-red-400 py-2.5 px-3"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-4 w-4 focus:text-red-100" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default UserSection;
