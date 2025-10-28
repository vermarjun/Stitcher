import {
  Search,
  Bell,
  Bookmark,
  Menu,
} from "lucide-react";
import { Input } from "@/Components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

// Types
export interface IUser {
  _id: string;
  username: string;
  profilePhoto?: string;
  bio?: string;
  createdAt: string;
}

export interface IAsset {
  _id: string;
  name: string;
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
}

export interface IComment {
  _id: string;
  userId: IUser;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  likes: string[];
  isLiked?: boolean;
  parentCommentId?: string;
}

export interface ICommunityPost {
  _id: string;
  assetId: IAsset;
  authorId: IUser;
  title: string;
  description?: string;
  tags: string[];
  likes: { userId: string; createdAt: string }[];
  likesCount: number;
  comments: IComment[];
  commentsCount: number;
  analytics: {
    views: number;
    uniqueViews: number;
    saves: number;
  };
  publishedAt: string;
  isLiked?: boolean;
  isSavedByUser?: boolean;
  isAddedToBackpack?: boolean;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: "publishedAt" | "likesCount" | "views";
  setSortBy: (sortBy: "publishedAt" | "likesCount" | "views") => void;
  onMenuClick: () => void;
}

const Header = ({ searchQuery, setSearchQuery, sortBy, setSortBy, onMenuClick }: HeaderProps) => {
  return (
    <div className="h-14 sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
      <div className="h-full px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl flex items-center justify-center gap-1 font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Community
            </h1>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-200" />
            <Input
              type="text"
              placeholder="Search posts, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-800 text-zinc-200 placeholder:text-white placeholder:font-extralight focus:border-none border-none rounded-full h-8"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
              <Bell className="h-5 w-5 text-zinc-400" />
            </button>
            <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
              <Bookmark className="h-5 w-5 text-zinc-400" />
            </button>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-white h-8 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="publishedAt" className="text-white hover:bg-zinc-700">
                  Latest
                </SelectItem>
                <SelectItem value="likesCount" className="text-white hover:bg-zinc-700">
                  Most Liked
                </SelectItem>
                <SelectItem value="views" className="text-white hover:bg-zinc-700">
                  Trending
                </SelectItem>
              </SelectContent>
            </Select>
            <button 
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <Menu className="h-5 w-5 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;