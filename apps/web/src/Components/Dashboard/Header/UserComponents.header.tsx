// src/Components/Dashboard/Header/UserSection.tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Button } from "@/Components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { 
  LogOut,
  Crown
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import type { User } from "@/State/Types";

interface UserSectionProps {
  user?: User
}

function UserSection({ 
  user
}: UserSectionProps) {

  const navigate = useNavigate();
  
  async function handleLogout() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/auth');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Plan Badge */}
      {user?.plan === 'pro' && (
        <Badge variant="secondary" className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-neutral-400 border-amber-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Pro
        </Badge>
      )}
      
      {user?.plan === 'plus' && (
        <Badge variant="secondary" className="bg-gradient-to-r from-red-500/30 to-red-500/20 text-neutral-200 border-red-500/30">
          Plus
        </Badge>
      )}
      
      {(!user?.plan || user?.plan === 'free') && (
        <Badge variant="outline" className="bg-gradient-to-r from-green-500/30 to-green-500/20 text-neutral-200 border-green-500/30">
          Free-tier
        </Badge>
      )}

      {/* User Dropdown Menu */}
      <DropdownMenu >
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all duration-200"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profilePhoto} alt={user?.username} />
              <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs">
                {user?.username?.charAt(0)?.toUpperCase() || 'A'}
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
                <AvatarImage src={user?.profilePhoto} alt={user?.username} />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex justify-between items-end w-full">
                <div>
                  <p className="text-sm font-medium text-white truncate">
                    {user?.username || 'User'}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-gradient-to-r from-green-500/30 to-green-500/20 text-neutral-200 border-green-500/30"
                  >
                    {user?.plan || 'Free'}
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