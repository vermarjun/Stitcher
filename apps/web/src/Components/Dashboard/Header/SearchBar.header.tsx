import { Input } from "@/Components/ui/input";
import { Search, Command } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import api from "@/api"; // Adjust import path as needed

interface SearchSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  projectId?: string; // Add projectId prop for the search
}

interface SearchResult {
  _id: string;
  prompt: string;
  createdAt: string;
}

function SearchSection({ searchQuery, setSearchQuery, projectId }: SearchSectionProps) {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle search functionality
  const performSearch = async (query: string) => {
    if (!query.trim() || !projectId) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.get(`/search/prompts`, {
        params: {
          projectId,
          q: query
        }
      });
      setSearchResults(response.data);
      setShowDropdown(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, projectId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle search shortcuts
    if (e.key === 'Enter' && searchQuery.trim()) {
      performSearch(searchQuery);
    }
    
    // Clear search on Escape
    if (e.key === 'Escape') {
      setSearchQuery('');
      setShowDropdown(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Handle what happens when a search result is clicked
    console.log('Selected prompt:', result);
    setShowDropdown(false);
    // You can add more functionality here, like navigating to the prompt or selecting it
  };

  const handleInputFocus = () => {
    if (searchQuery && searchResults.length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <div className="mx-6 flex flex-1 max-w-md items-center">
      <div className="relative w-full group" ref={dropdownRef}>
        {/* Search Icon */}
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors duration-200" />
        
        {/* Search Input */}
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search projects, videos, or prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          className="h-9 w-full rounded-lg border-zinc-800/50 bg-zinc-900/50 pl-10 pr-12 text-sm text-white placeholder-zinc-500 focus-visible:ring focus-visible:border-neutral-400 transition-all duration-200"
        />
        
        {/* Command Key Hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-zinc-500 group-focus-within:text-zinc-400 transition-colors duration-200">
          <Command className="h-3 w-3" />
          <span className="text-xs font-mono">K</span>
        </div>
        
        {/* Search Results Count */}
        {searchQuery && !isLoading && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2 text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded">
            {searchResults.length} results
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2 text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded">
            Searching...
          </div>
        )}
        
        {/* Search Results Dropdown */}
        {showDropdown && searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800/50 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-zinc-500 text-sm">
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="py-2">
                {searchResults.map((result) => (
                  <div
                    key={result._id}
                    onClick={() => handleResultClick(result)}
                    className="px-4 py-3 hover:bg-zinc-800/50 cursor-pointer transition-colors duration-150 border-b border-zinc-800/30 last:border-b-0"
                  >
                    <div className="text-sm text-white line-clamp-2">
                      {result.prompt}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {new Date(result.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-zinc-500 text-sm">
                No results found for "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchSection;