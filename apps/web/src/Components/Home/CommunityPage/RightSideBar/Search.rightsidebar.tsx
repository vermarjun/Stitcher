import { Search, X } from "lucide-react";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { useState, useEffect, useRef } from "react";
import api from "@/api";

interface User {
  _id: string;
  username: string;
  profilePhoto: string;
  plan: "free" | "premium";
}

interface SearchResponse {
  success: boolean;
  count: number;
  data: User[];
}

const SearchSection = () => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const response = await api.get<SearchResponse>(`/users/search?q=${encodeURIComponent(query)}`);
      
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

  const handleUserClick = (user: User): void => {
    // Handle user selection - you can navigate to profile or do other actions
    console.log("Selected user:", user);
    setShowDropdown(false);
    setSearchQuery("");
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
              <div className="p-4 text-center text-zinc-400">
                Searching...
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-400">
                {error}
              </div>
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
      >
        Create Post
      </Button>
    </>
  );
};

export default SearchSection;