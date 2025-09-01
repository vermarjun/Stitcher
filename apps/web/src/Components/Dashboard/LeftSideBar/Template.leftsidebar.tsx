import React, { useState, useEffect } from 'react';
import { Search, Download, FileAudio, FileVideo, Check, Loader2, Heart } from 'lucide-react';
import { toast } from 'sonner';
import  { type Project, type Template, TemplateType } from '@/State/Types';
import api from '@/api';
import BeautifulLoader from '@/Components/LoadingScreens/Templatestore.loader';

interface TemplateStoreProps {
  onImportTemplate?: (template: Template) => Promise<void>;
  currentProject?: Project;
}

const TemplateStore: React.FC<TemplateStoreProps> = ({ 
  onImportTemplate,
  currentProject
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<TemplateType | 'all'>('all');
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [successAnimations, setSuccessAnimations] = useState<Set<string>>(new Set());
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [likeAnimations, setLikeAnimations] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Filter templates based on search, type, and liked status
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || template.type === selectedType;
    return matchesSearch && matchesType;
  });

  async function fetchTemplates() {
    try {
      setIsLoading(true);

      // FETCH TEMPLATE DATA FOR THIS PROJECT ID
      const templateResponse = await api.get(
        `/template?projectId=${currentProject?._id}`
      );

      if (templateResponse.status === 200 || templateResponse.status === 201) {
        setTemplates(templateResponse.data.data.templates);
      } else {
        throw new Error(
          templateResponse.data?.message || "Failed to fetch project"
        );
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch project";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  },[]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLikeTemplate = async (template: Template) => {
    setLikingIds(prev => new Set(prev).add(template._id));
    
    // Store the current liked state to determine if we should show animation
    const wasLiked = template.isLikedByUser;
    
    try {
      const response = await api.post(`/template/${template._id}/like`);
      console.log(response.data)
      if (!response.data.success) {
        throw new Error('Network connection failed. Please try again.');
      } else {
        toast.success(response.data.message)
      }

      // Update template state - toggle the like status
      setTemplates(prev => prev.map(t => 
        t._id === template._id 
          ? { 
              ...t, 
              isLikedByUser: !t.isLikedByUser,
              likesCount: response.data.data.likesCount
            }
          : t
      ));

      // Show animation only if the item is being liked (not unliked)
      if (!wasLiked) {
        setLikeAnimations(prev => new Set(prev).add(template._id));
        
        // Remove animation after delay
        setTimeout(() => {
          setLikeAnimations(prev => {
            const newSet = new Set(prev);
            newSet.delete(template._id);
            return newSet;
          });
        }, 1000);
      }
      
    } catch (error) {
      toast.error('Like unsuccessful', {
        description: error instanceof Error ? error.message : 'Failed to like template',
        duration: 4000,
      });
    } finally {
      setLikingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template._id);
        return newSet;
      });
    }
  };

  const handleImportTemplate = async (template: Template) => {
    if (template.isInProject) {
      toast.error('Template already in project');
      return;
    }

    setImportingIds(prev => new Set(prev).add(template._id));

    try {
      const response = await api.post(`/template/${template._id}/add-to-project`,{
        projectId: currentProject?._id,
        customName: template.name
      });

      console.log(response);

      if (onImportTemplate) {
        await onImportTemplate(template);
      }

      // Update template state to show it's now in project
      setTemplates(prev => prev.map(t => 
        t._id === template._id 
          ? { ...t, isInProject: true, projectAssetId: `asset-${Date.now()}` }
          : t
      ));

      // Show success animation
      setSuccessAnimations(prev => new Set(prev).add(template._id));
      
      // Success toast with custom styling
      toast.success('Template imported successfully!', {
        description: `${template.name} has been added to your project`,
        duration: 3000,
      });

      // Remove success animation after delay
      setTimeout(() => {
        setSuccessAnimations(prev => {
          const newSet = new Set(prev);
          newSet.delete(template._id);
          return newSet;
        });
      }, 2000);

    } catch (error) {
      toast.error('Failed to import template', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        duration: 4000,
      });
    } finally {
      setImportingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(template._id);
        return newSet;
      });
    }
  };

  const TemplateCard: React.FC<{ template: Template }> = ({ template }) => {
    const isImporting = importingIds.has(template._id);
    const showSuccess = successAnimations.has(template._id);
    const isLiking = likingIds.has(template._id);
    const showLikeAnimation = likeAnimations.has(template._id);

    return (
      <div className={`relative bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group hover:bg-zinc-800 transition-all duration-200 ${
        template.isInProject 
          ? 'shadow-lg shadow-green-500/20 ring-1 ring-green-500/30' 
          : 'hover:shadow-lg'
      }`}>
        <div className="flex items-center p-2.5 gap-2.5">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-12 h-12 bg-zinc-800 rounded-md flex items-center justify-center relative overflow-hidden">
            {template.thumbnail ? (
              <img
                src={template.thumbnail}
                alt={template.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-zinc-500">
                {template.type === TemplateType.VIDEO ? (
                  <FileVideo className="w-4 h-4" />
                ) : (
                  <FileAudio className="w-4 h-4" />
                )}
              </div>
            )}
            
            {/* Duration overlay */}
            {template.duration && (
              <div className="absolute bottom-0 right-0 bg-black bg-opacity-80 text-white text-[9px] px-1 py-0.5 leading-none">
                {formatDuration(template.duration)}
              </div>
            )}
          </div>
          
          {/* Template Info */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-white truncate pr-1 leading-tight">
                {template.name}
              </h3>
              <div className="text-zinc-400 flex-shrink-0 ml-1">
                {template.type === TemplateType.VIDEO ? (
                  <FileVideo className="w-3 h-3" />
                ) : (
                  <FileAudio className="w-3 h-3" />
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
              <span className="uppercase font-medium tracking-wide">
                {template.type}
              </span>
              <span className="text-zinc-500">{formatFileSize(template.bytes)}</span>
            </div>
            
            {/* Likes and Actions Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Like Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLikeTemplate(template);
                  }}
                  disabled={isLiking}
                  className={`relative flex items-center justify-center w-5 h-5 rounded-full transition-all duration-200 ${
                    template.isLikedByUser 
                      ? 'text-red-500 hover:text-red-600' 
                      : 'text-white hover:text-red-400 hover:bg-red-500/10'
                  }`}
                >
                  {isLiking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Heart 
                      className={`w-3 h-3 transition-all duration-200 ${
                        template.isLikedByUser ? 'fill-current' : ''
                      }`} 
                    />
                  )}
                  
                  {/* Cute animation overlay - only shows when liking (not unliking) */}
                  {showLikeAnimation && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-red-500 fill-current animate-bounce" />
                    </div>
                  )}
                </button>
                
                {/* Likes Count */}
                <span className="text-[10px] font-medium text-white rounded-full">
                  {template.likesCount} Likes
                </span>
              </div>
              
              {/* Import Status / Button */}
              <div className="flex-shrink-0">
                {isImporting ? (
                  <div className="w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center">
                    <Loader2 className="w-2.5 h-2.5 text-zinc-400 animate-spin" />
                  </div>
                ) : showSuccess ? (
                  <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center animate-pulse">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                ) : template.isInProject ? (
                  <div className="text-green-400 text-[9px] font-medium px-1.5 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                    Added
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImportTemplate(template);
                    }}
                    className="bg-zinc-300 hover:bg-zinc-200 rounded-md flex items-center justify-center transition-all duration-200 py-0.5 px-2"
                  >
                    <div className='flex items-center justify-center gap-1'>
                      <Download className="w-2.5 h-2.5 text-black" /> 
                      <span className='text-[10px] text-black font-medium'>
                        Import
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Success overlay animation */}
        {showSuccess && (
          <div className="absolute inset-0 bg-green-600/20 flex items-center justify-center animate-in fade-in duration-300">
            <div className="bg-green-600 text-white rounded-full p-3 animate-in zoom-in duration-300">
              <Check className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading){
    return <BeautifulLoader/>;
  }

  return (
    <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        {/* <h2 className="text-base font-semibold text-white mb-2">Template Store</h2> */}
        
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors"
          />
        </div>

        {/* Type Filter Tabs */}
        <div className="flex bg-zinc-900 rounded-lg p-1 mb-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedType === 'all' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedType(TemplateType.VIDEO)}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedType === TemplateType.VIDEO 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Video
          </button>
          <button
            onClick={() => setSelectedType(TemplateType.AUDIO)}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              selectedType === TemplateType.AUDIO 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Audio
          </button>
        </div>
      </div>

      {/* Templates List - Single Column Tiles */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => (
              <TemplateCard key={template._id} template={template} />
            ))
          ) : (
            <div className="text-center text-zinc-500 mt-6">
              <div className="text-2xl mb-2">🎬</div>
              <p className="text-xs">No {selectedType === 'all' ? '' : selectedType} templates found</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer Stats */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950">
        <div className="text-[10px] text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>Total Templates:</span>
            <span className="text-white">{templates.length}</span>
          </div>
          <div className="flex justify-between">
            <span>In Project:</span>
            <span className="text-white">{templates.filter(t => t.isInProject).length}</span>
          </div>
        </div>
      </div>
    </div>  
  );
};

export default TemplateStore;