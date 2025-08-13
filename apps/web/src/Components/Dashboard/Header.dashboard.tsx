import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Search, Settings, User } from "lucide-react";
import { useRecoilState } from "recoil";
import { activeMenuState } from "@/State/Header.dashboard.state";

function Header() {
  const [activeMenu, setActiveMenu] = useRecoilState(activeMenuState);

  const menuItems = ["File", "Edit", "Selection", "View", "Go"];

  return (
    <header className="flex h-10 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 text-sm">
      {/* Left section - Logo and Menu */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Stitcher</span>
        </div>

        {/* Menu Items */}
        <div className="flex items-center">
          {menuItems.map((item) => (
            <DropdownMenu key={item}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`px-3 py-1 text-zinc-300 hover:bg-zinc-800/50 hover:text-white ${
                    activeMenu === item ? "bg-zinc-800/50 text-white" : ""
                  }`}
                  onClick={() => setActiveMenu(item)}
                >
                  {item}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 border-zinc-800 bg-zinc-900 text-zinc-300"
                align="start"
              >
                <DropdownMenuItem className="hover:bg-zinc-800 focus:bg-zinc-800">
                  New File
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-zinc-800 focus:bg-zinc-800">
                  Open File...
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-zinc-800 focus:bg-zinc-800">
                  Save
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}

          {/* Three dots menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 py-1 text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
              >
                ⋯
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 border-zinc-800 bg-zinc-900 text-zinc-300"
              align="start"
            >
              <DropdownMenuItem className="hover:bg-zinc-800 focus:bg-zinc-800">
                Preferences
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-zinc-800 focus:bg-zinc-800">
                Keyboard Shortcuts
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-zinc-800 focus:bg-zinc-800">
                Help
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Middle section - Search */}
      <div className="mx-4 flex flex-1 max-w-md items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-zinc-500" />
          <Input
            type="text"
            placeholder="Search projects, videos, or prompts..."
            className="h-8 w-full rounded-md border-zinc-800 bg-zinc-900/50 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-purple-500/50 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent"
          />
        </div>
      </div>

      {/* Right section - User controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

export default Header