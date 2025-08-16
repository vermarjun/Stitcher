import { useState, useEffect } from 'react';
import { 
  Search,
  ChevronDown
} from 'lucide-react';

import api from '@/api';

// TO DO:
// 1) SEARCH BAR IMPLEMENT KARNA HAI
// 2) HANDLE SORT CHANGE FEATURE KO ADD KARNA HAI

// Types
interface Template {
  _id: string;
  name: string;
  description?: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// interface TemplatesResponse {
//   success: boolean;
//   data: {
//     templates: Template[];
//     pagination: PaginationInfo;
//   };
// }

// Mock API function - replace with your actual api import
// const api = {
//   get: async (url: string) => {
//     // This is a mock - replace with your actual api.get call
//     const mockData: TemplatesResponse = {
//       success: true,
//       data: {
//         templates: Array.from({ length: 12 }, (_, i) => ({
//           _id: `template_${i + 1}`,
//           name: `Template ${i + 1}`,
//           description: `Description for template ${i + 1}`,
//           type: ['images', 'videos', 'audio', 'gifs'][i % 4],
//           createdAt: new Date().toISOString(),
//           updatedAt: new Date().toISOString(),
//         })),
//         pagination: {
//           page: 1,
//           limit: 20,
//           total: 12,
//           pages: 1
//         }
//       }
//     };
//     return { data: mockData };
//   }
// };

const TemplatesComponent = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  
  // Filter states
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const categories = [
    { id: '', name: 'All', count: 0 },
    { id: 'images', name: 'Images', count: 0 },
    { id: 'videos', name: 'Videos', count: 0 },
    { id: 'audio', name: 'Audio', count: 0 },
    { id: 'gifs', name: 'GIFs', count: 0 },
  ];

  const sortOptions = [
    { value: 'createdAt', label: 'Created Date' },
    { value: 'updatedAt', label: 'Updated Date' },
    { value: 'name', label: 'Name' },
  ];

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (activeCategory) params.append('type', activeCategory);
      if (searchQuery) params.append('search', searchQuery);
      params.append('page', currentPage.toString());
      params.append('limit', '20');
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      // Replace this with: const response = await api.get(`/template?${params.toString()}`);
      const response = await api.get(`/template?${params.toString()}`);
      
      if (response.data.success) {
        setTemplates(response.data.data.templates);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [
    activeCategory, 
    // searchQuery, 
    sortBy, 
    sortOrder, 
    currentPage
  ]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    setCurrentPage(1);
  };

  // ADD THIS

  // const handleSortChange = (newSortBy: string) => {
  //   if (newSortBy === sortBy) {
  //     setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  //   } else {
  //     setSortBy(newSortBy);
  //     setSortOrder('desc');
  //   }
  //   setCurrentPage(1);
  // };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-neutral-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Templates</h2>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              setSortBy(newSortBy);
              setSortOrder(newSortOrder as 'asc' | 'desc');
              setCurrentPage(1);
            }}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
          >
            {sortOptions.map(option => (
              <>
                <option key={`${option.value}-desc`} value={`${option.value}-desc`}>
                  {option.label} (Newest First)
                </option>
                <option key={`${option.value}-asc`} value={`${option.value}-asc`}>
                  {option.label} (Oldest First)
                </option>
              </>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Category Tabs */}
        <div className="border-b border-neutral-800 p-2 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activeCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-neutral-400 text-sm">Loading templates...</div>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-neutral-400 text-sm">No templates found</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {templates.map(template => (
                  <div
                    key={template._id}
                    className="bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 hover:border-neutral-600 cursor-pointer group transition-all"
                  >
                    <div className="aspect-video bg-neutral-800 relative">
                      <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                        {template.type.toUpperCase()}
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-neutral-300 truncate font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-neutral-500 truncate mt-1">{template.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-neutral-800">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <span className="text-xs text-neutral-400">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                    disabled={currentPage === pagination.pages}
                    className="px-3 py-1 text-xs bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Results info */}
              {pagination && (
                <div className="text-center mt-2">
                  <p className="text-xs text-neutral-500">
                    Showing {templates.length} of {pagination.total} templates
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplatesComponent;