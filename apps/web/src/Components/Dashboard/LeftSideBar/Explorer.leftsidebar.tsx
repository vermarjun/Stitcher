import React, { useState, useRef } from 'react';
import { Play, Music, Clock, FileText, Layers, Plus, Upload, Filter } from 'lucide-react';

// Types based on your schema
enum AssetType {
  VIDEO = 'video',
  AUDIO = 'audio',
}

enum AssetOrigin {
  TEMPLATE = 'template',
  UPLOAD = 'upload',
  GENERATED_VIDEO = 'generated_video'
}

interface IAsset {
  _id: string;
  name: string;
  type: AssetType;
  origin: AssetOrigin;
  url: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  bytes: number;
  metadata: Record<string, any>;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  isOnTimeline?: boolean;
}

// Sample data
const sampleAssets: IAsset[] = [
  {
    _id: '1',
    name: 'Opening Scene.mp4',
    type: AssetType.VIDEO,
    origin: AssetOrigin.UPLOAD,
    url: 'https://example.com/video1.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&h=120&fit=crop',
    duration: 45,
    width: 1920,
    height: 1080,
    bytes: 25600000,
    metadata: {},
    projectId: 'project1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isOnTimeline: true
  },
  {
    _id: '2',
    name: 'Background Music.mp3',
    type: AssetType.AUDIO,
    origin: AssetOrigin.TEMPLATE,
    url: 'https://example.com/audio1.mp3',
    thumbnail: '',
    duration: 180,
    bytes: 5120000,
    metadata: {},
    projectId: 'project1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isOnTimeline: true
  },
  {
    _id: '3',
    name: 'Logo Animation.mp4',
    type: AssetType.VIDEO,
    origin: AssetOrigin.GENERATED_VIDEO,
    url: 'https://example.com/video2.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=120&fit=crop',
    duration: 8,
    width: 1920,
    height: 1080,
    bytes: 12800000,
    metadata: {},
    projectId: 'project1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isOnTimeline: false
  },
  {
    _id: '4',
    name: 'Transition Effect.mp4',
    type: AssetType.VIDEO,
    origin: AssetOrigin.TEMPLATE,
    url: 'https://example.com/video3.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=120&fit=crop',
    duration: 3,
    width: 1920,
    height: 1080,
    bytes: 8960000,
    metadata: {},
    projectId: 'project1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isOnTimeline: false
  },
  {
    _id: '5',
    name: 'Narration Track.mp3',
    type: AssetType.AUDIO,
    origin: AssetOrigin.UPLOAD,
    url: 'https://example.com/audio2.mp3',
    thumbnail: '',
    duration: 95,
    bytes: 3840000,
    metadata: {},
    projectId: 'project1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isOnTimeline: false
  }
];

const AssetStashSidebar: React.FC = () => {
  const [assets, setAssets] = useState<IAsset[]>(sampleAssets);
  const [filter, setFilter] = useState<'all' | 'video' | 'audio'>('all');
  const [originFilter, setOriginFilter] = useState<AssetOrigin | 'all'>('all');
  const [showOriginFilter, setShowOriginFilter] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const getOriginIcon = (origin: AssetOrigin) => {
    switch (origin) {
      case AssetOrigin.TEMPLATE:
        return <FileText className="w-3 h-3" />;
      case AssetOrigin.UPLOAD:
        return <Layers className="w-3 h-3" />;
      case AssetOrigin.GENERATED_VIDEO:
        return <Play className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getOriginLabel = (origin: AssetOrigin): string => {
    switch (origin) {
      case AssetOrigin.TEMPLATE:
        return 'Template';
      case AssetOrigin.UPLOAD:
        return 'Upload';
      case AssetOrigin.GENERATED_VIDEO:
        return 'AI Generated';
      default:
        return '';
    }
  };

  const handleAddToTimeline = (assetId: string) => {
    setAssets(prevAssets => 
      prevAssets.map(asset => 
        asset._id === assetId 
          ? { ...asset, isOnTimeline: true }
          : asset
      )
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      
      if (!isVideo && !isAudio) return;

      const newAsset: IAsset = {
        _id: `upload_${Date.now()}_${index}`,
        name: file.name,
        type: isVideo ? AssetType.VIDEO : AssetType.AUDIO,
        origin: AssetOrigin.UPLOAD,
        url: URL.createObjectURL(file),
        thumbnail: isVideo ? 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&h=120&fit=crop' : '',
        bytes: file.size,
        metadata: {},
        projectId: 'project1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOnTimeline: false
      };

      setAssets(prev => [newAsset, ...prev]);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      
      if (!isVideo && !isAudio) return;

      const newAsset: IAsset = {
        _id: `drop_${Date.now()}_${index}`,
        name: file.name,
        type: isVideo ? AssetType.VIDEO : AssetType.AUDIO,
        origin: AssetOrigin.UPLOAD,
        url: URL.createObjectURL(file),
        thumbnail: isVideo ? 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&h=120&fit=crop' : '',
        bytes: file.size,
        metadata: {},
        projectId: 'project1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOnTimeline: false
      };

      setAssets(prev => [newAsset, ...prev]);
    });
  };

  const filteredAssets = assets.filter(asset => {
    const typeMatch = filter === 'all' || asset.type === filter;
    const originMatch = originFilter === 'all' || asset.origin === originFilter;
    return typeMatch && originMatch;
  });

  return (
    <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <h2 className="text-base font-semibold text-white mb-2">Asset Stash</h2>
        
        {/* Filter Tabs */}
        <div className="flex bg-zinc-900 rounded-lg p-1 mb-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('video')}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'video' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Video
          </button>
          <button
            onClick={() => setFilter('audio')}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'audio' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Audio
          </button>
        </div>

        {/* Origin Filter Button */}
        <div className="relative">
          <button
            onClick={() => setShowOriginFilter(!showOriginFilter)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-xs text-zinc-300 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              <span>Filter by Origin</span>
            </div>
            <span className="text-[10px] text-zinc-500">
              {originFilter === 'all' ? 'All' : getOriginLabel(originFilter as AssetOrigin)}
            </span>
          </button>

          {/* Origin Filter Dropdown */}
          {showOriginFilter && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 rounded-lg border border-zinc-700 z-10">
              <button
                onClick={() => {
                  setOriginFilter('all');
                  setShowOriginFilter(false);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors rounded-t-lg"
              >
                All Origins
              </button>
              {Object.values(AssetOrigin).map(origin => (
                <button
                  key={origin}
                  onClick={() => {
                    setOriginFilter(origin);
                    setShowOriginFilter(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                >
                  {getOriginIcon(origin)}
                  {getOriginLabel(origin)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div className="p-3 border-b border-zinc-800">
        <div
          className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
            isDragOver 
              ? 'border-green-500 bg-green-500/10' 
              : 'border-zinc-700 hover:border-zinc-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,audio/*"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="w-5 h-5 text-zinc-400" />
            <p className="text-xs text-zinc-400">
              Drop files here or click to upload
            </p>
            <p className="text-[10px] text-zinc-500">
              Supports video and audio files
            </p>
          </div>
        </div>
      </div>
      
      {/* Asset List - Single Column Tiles */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {filteredAssets.map((asset) => (
            <div
              key={asset._id}
              className={`relative bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group hover:bg-zinc-800 transition-all duration-200 ${
                asset.isOnTimeline 
                  ? 'shadow-lg shadow-green-500/20 ring-1 ring-green-500/30' 
                  : 'hover:shadow-lg'
              }`}
            >
              <div className="flex items-center p-2.5 gap-2.5">
                {/* Thumbnail/Icon */}
                <div className="flex-shrink-0 w-12 h-12 bg-zinc-800 rounded-md flex items-center justify-center relative overflow-hidden">
                  {asset.type === AssetType.VIDEO && asset.thumbnail ? (
                    <img
                      src={asset.thumbnail}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-zinc-500">
                      {asset.type === AssetType.VIDEO ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Music className="w-4 h-4" />
                      )}
                    </div>
                  )}
                  
                  {/* Duration overlay */}
                  {asset.duration && (
                    <div className="absolute bottom-0 right-0 bg-black bg-opacity-80 text-white text-[9px] px-1 py-0.5 leading-none">
                      {formatDuration(asset.duration)}
                    </div>
                  )}
                </div>
                
                {/* Asset Info */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-medium text-white truncate pr-1 leading-tight">
                      {asset.name}
                    </h3>
                    <div className="text-zinc-400 flex-shrink-0 ml-1">
                      {getOriginIcon(asset.origin)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                    <span className="uppercase font-medium tracking-wide">
                      {asset.type}
                    </span>
                    <span className="text-zinc-500">{formatFileSize(asset.bytes)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                    <div className="text-[10px] text-zinc-500 truncate">
                      {getOriginLabel(asset.origin)}
                    </div>
                    {/* Timeline Status / Add Button */}
                    <div className="flex-shrink-0">
                      {asset.isOnTimeline ? (
                        <div className="text-green-400 text-[10px] font-medium px-1  bg-green-500/10 rounded-xl border border-green-500/20">
                          On Timeline
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToTimeline(asset._id);
                          }}
                          className="w-6 h-6 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                    </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {filteredAssets.length === 0 && (
          <div className="text-center text-zinc-500 mt-6">
            <div className="text-2xl mb-2">📁</div>
            <p className="text-xs">No {filter === 'all' ? '' : filter} assets found</p>
            {originFilter !== 'all' && (
              <p className="text-[10px] mt-1">for {getOriginLabel(originFilter as AssetOrigin)}</p>
            )}
          </div>
        )}
      </div>
      
      {/* Footer Stats */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950">
        <div className="text-[10px] text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>Total Assets:</span>
            <span className="text-white">{assets.length}</span>
          </div>
          <div className="flex justify-between">
            <span>On Timeline:</span>
            <span className="text-white">{assets.filter(a => a.isOnTimeline).length}</span>
          </div>
          <div className="flex justify-between">
            <span>Filtered:</span>
            <span className="text-white">{filteredAssets.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetStashSidebar;