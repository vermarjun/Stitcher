import { Search, X } from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { useState, useEffect, useRef } from "react";
import api from "@/api";
import type { IUser } from "@/State/Types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Components/ui/dialog";
import { useNav } from "@/Context/HomeNavigation.context";

interface SearchResponse {
  success: boolean;
  count: number;
  data: IUser[];
}

interface Props {
  onProfileClick: (user: IUser) => void;
  onBack: () => void;
}

const SearchSection = ({ onProfileClick, onBack }: Props) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const { setActiveItem } = useNav();
  // Debounce search to avoid too many API calls
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchUsers = async (query: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<SearchResponse>(
        `/users/search?q=${encodeURIComponent(query)}`
      );

      if (response.data.success) {
        setSearchResults(response.data.data);
        setShowDropdown(true);
      } else {
        setError("Failed to fetch results");
        setSearchResults([]);
      }
    } catch (err) {
      setError("Error searching users");
      setSearchResults([]);
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = (user: IUser): void => {
    onBack();
    onProfileClick(user);
    // console.log("Selected user:", user);
    // setShowDropdown(false);
    // setSearchQuery("");
  };

  const clearSearch = (): void => {
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  return (
    <>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-200 z-10" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search users.."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setShowDropdown(true)}
          className="pl-10 pr-10 bg-zinc-900 h-10 border border-zinc-600 text-zinc-200 placeholder:text-white placeholder:font-extralight focus:border-zinc-500 rounded-full"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50"
          >
            {isLoading ? (
              <div className="p-4 text-center text-zinc-400">Searching...</div>
            ) : error ? (
              <div className="p-4 text-center text-red-400">{error}</div>
            ) : searchResults.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => handleUserClick(user)}
                    className="flex items-center gap-3 p-3 hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    <img
                      src={user.profilePhoto}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-200 font-medium truncate">
                        {user.username}
                      </p>
                      <p className="text-zinc-500 text-sm capitalize">
                        {user.plan} plan
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-zinc-400">
                No users found
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        size="lg"
        className="bg-white text-black rounded-full w-full hover:bg-zinc-300 cursor-pointer"
        onClick={() => setOpenCreateDialog(true)}
      >
        Create Post
      </Button>

      {/* ✅ Create Post Dialog */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-center">
              Create Post
            </DialogTitle>
          </DialogHeader>

          <div className="text-center text-zinc-300 leading-relaxed px-4">
            You can only share in community what you have in your backpack. You
            can save the videos that you generate in your backpack and then
            share those videos here in community.
          </div>

          <DialogFooter className="flex justify-center mt-4">
            <Button
              className="bg-white text-black hover:bg-zinc-300 rounded-full px-6"
              onClick={() => {
                setActiveItem("backpack")
                setOpenCreateDialog(false);
              }}
            >
              Go to Backpack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SearchSection;
