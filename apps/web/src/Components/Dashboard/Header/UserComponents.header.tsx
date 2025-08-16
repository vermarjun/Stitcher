// src/Components/Dashboard/Header/UserSection.tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Button } from "@/Components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { Badge } from "@/Components/ui/badge";
import { 
  Settings, 
  User, 
  LogOut,
  CreditCard,
  HelpCircle,
  Palette,
  Key,
  Shield,
  Activity,
  Crown
} from "lucide-react";

interface UserSectionProps {
  user: any; // Replace with proper user type
}

function UserSection({ 
  user
}: UserSectionProps) {

  async function handleLogout() {
    try {
      // TODO: Logout API call
      // await api.auth.logout();
      window.location.href = '/login';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Plan Badge */}
      {user?.plan === 'pro' && (
        <Badge variant="secondary" className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Pro
        </Badge>
      )}
      
      {user?.plan === 'plus' && (
        <Badge variant="secondary" className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border-blue-500/30">
          Plus
        </Badge>
      )}
      
      {(!user?.plan || user?.plan === 'free') && (
        <Badge variant="outline" className="text-zinc-400 border-zinc-600">
          Free
        </Badge>
      )}

      {/* User Dropdown Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all duration-200"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-64 border-zinc-800/50 bg-zinc-900/95 backdrop-blur-sm text-zinc-300 shadow-xl"
          align="end"
        >
          {/* User Info Header */}
          <div className="px-3 py-3 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 border-purple-500/30"
                  >
                    {user?.plan || 'Free'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Account Section */}
          <div className="py-1">
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <User className="mr-3 h-4 w-4 text-zinc-400" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <CreditCard className="mr-3 h-4 w-4 text-zinc-400" />
              <span>Billing & Usage</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <Key className="mr-3 h-4 w-4 text-zinc-400" />
              <span>API Keys</span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="bg-zinc-800/50" />

          {/* Preferences Section */}
          <div className="py-1">
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <Settings className="mr-3 h-4 w-4 text-zinc-400" />
              <span>Preferences</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <Palette className="mr-3 h-4 w-4 text-zinc-400" />
              <span>Theme</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <Shield className="mr-3 h-4 w-4 text-zinc-400" />
              <span>Privacy</span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="bg-zinc-800/50" />

          {/* Support Section */}
          <div className="py-1">
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <HelpCircle className="mr-3 h-4 w-4 text-zinc-400" />
              <span>Help & Support</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-zinc-800/50 focus:bg-zinc-800/50 cursor-pointer py-2.5 px-3">
              <Activity className="mr-3 h-4 w-4 text-zinc-400" />
              <span>Activity Log</span>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="bg-zinc-800/50" />

          {/* Logout */}
          <div className="py-1">
            <DropdownMenuItem 
              className="hover:bg-red-950/50 focus:bg-red-950/50 cursor-pointer text-red-400 py-2.5 px-3"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default UserSection;