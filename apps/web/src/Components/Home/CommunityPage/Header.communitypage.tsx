import {
  Menu,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface HeaderProps {
  sortBy: "publishedAt" | "likesCount" | "views";
  setSortBy: (sortBy: "publishedAt" | "likesCount" | "views") => void;
  onMenuClick: () => void;
}

const Header = ({ sortBy, setSortBy, onMenuClick }: HeaderProps) => {
  return (
    <div className="h-16 top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-zinc-800 sticky">
      <div className="h-full px-5">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Community
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-white text-xs h-9 rounded-full hover:bg-zinc-800 transition-colors focus:ring-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 rounded-xl shadow-xl">
                <SelectItem value="publishedAt" className="text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white cursor-pointer rounded-lg text-xs my-0.5">
                  Latest Releases
                </SelectItem>
                <SelectItem value="likesCount" className="text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white cursor-pointer rounded-lg text-xs my-0.5">
                  Most Liked
                </SelectItem>
                <SelectItem value="views" className="text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white cursor-pointer rounded-lg text-xs my-0.5">
                  Trending Now
                </SelectItem>
              </SelectContent>
            </Select>
            <button 
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;