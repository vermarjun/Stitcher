import { useState, useEffect } from 'react';
import { Play, Music, Type, Volume2, Eye, Trash2 } from 'lucide-react';
import api from '@/api';
import type { Project } from '@/State/Types';
import { TrackType } from '@/State/Types';
import type { IAudioTimelineItem, IVideoTimelineItem, ITextTimelineItem, ITrack } from '@/State/Types';
import BeautifulLoader from '@/Components/LoadingScreens/Templatestore.loader';
import { useRefreshTracks } from "../RefreshContextProvider";

interface Props {
  currentProject?: Project
}

const TimelineTracksSidebar = ({ currentProject }: Props) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'text'>('video');
  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const { refreshKey: refreshFromAssetStashAndTimeline } = useRefreshTracks();
  const timelineId = currentProject?.timeline._id; 

  const fetchTracks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/track/timeline/${timelineId}`);
      
      if (response.data.success) {
        setTracks(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch tracks');
      }
    } catch (err: any) {
      console.error('Error fetching tracks:', err);
      setError(err.response?.data?.message || 'Failed to fetch tracks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, [refreshFromAssetStashAndTimeline]);

  const formatDuration = (seconds: any) => {
    if (!seconds && seconds !== 0) return '0:00.00';
    const totalSeconds = Number(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    const formattedSeconds = remainingSeconds.toFixed(2).padStart(5, '0');
    return `${minutes}:${formattedSeconds}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const getActiveItems = () => {
    const relevantTracks = tracks.filter(track => {
      if (activeTab === 'video') return track.type === TrackType.VIDEO;
      if (activeTab === 'audio') return track.type === TrackType.AUDIO;
      if (activeTab === 'text') return track.type === TrackType.TEXT;
      return false;
    });

    return relevantTracks.flatMap(track =>
      track.items.map(item => ({ ...item, track }))
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/timeline-item/${itemId}`);
      fetchTracks();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handlePlayItem = (item: any) => {
    // Implement play functionality to load asset into video player
    console.log('Play item:', item);
  };

  if (loading) {
    return <BeautifulLoader />;
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 text-sm mb-2">Error: {error}</p>
        <button 
          onClick={fetchTracks}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const renderVideoItem = (item: IVideoTimelineItem & { track: ITrack }) => (
    <div key={item._id} className="bg-zinc-800 rounded-lg overflow-hidden group hover:bg-zinc-700 transition-all duration-200">
      <div className="flex-col items-start gap-3">
        {/* Thumbnail */}
        <div className="flex-shrink-0 relative p-1 mb-2">
          <div className="aspect-video  bg-zinc-700 rounded-md overflow-hidden">
            {item.assetId?.thumbnail ? (
              <img
                src={item.assetId.thumbnail}
                alt={item.assetId.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-600">
                <Play className="w-5 h-5 text-zinc-400" />
              </div>
            )}
            <div className="absolute bottom-3 right-3 bg-zinc-600 bg-opacity-80 text-white text-[9px] px-2 py-1 rounded leading-none">
              {formatDuration(item.assetId?.duration || 0)}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 px-3 pb-3">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 max-w-[70%]">
              <Play className="w-3 h-3 text-green-400 flex-shrink-0" />
              <h3 className="text-xs font-medium text-white truncate leading-tight">
                {item.assetId?.name || 'Video Item'}
              </h3>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handlePlayItem(item)}
                className="p-1 hover:bg-zinc-600 rounded transition-colors"
                title="Play in video player"
              >
                <Play className="w-3 h-3 text-green-400" />
              </button>
              <button 
                onClick={() => handleDeleteItem(item._id)}
                className="p-1 hover:bg-red-500 rounded transition-colors"
                title="Delete item"
              >
                <Trash2 className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Timeline Info */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-zinc-700 rounded px-2 py-1">
              <div className="text-zinc-400 text-[10px] mb-0.5">Timeline</div>
              <div className="text-white text-[10px] font-medium">
                {formatDuration(item.startTime)} - {formatDuration(item.endTime)}
              </div>
            </div>
            <div className="bg-zinc-700 rounded px-2 py-1">
              <div className="text-zinc-400 text-[10px] mb-0.5">Source</div>
              <div className="text-white text-[10px] font-medium">
                {formatDuration(item.sourceStartTime)} - {formatDuration(item.sourceEndTime)}
              </div>
            </div>
          </div>

          {/* Properties */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-400 mb-2">
            <div className="flex items-center gap-1">
              <span>Speed:</span>
              <span className="text-white font-medium">{item.speed}x</span>
            </div>
            <div className="flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              <span className="text-white font-medium">{Math.round((item.volume || 1) * 100)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span className="text-white font-medium">{Math.round((item.opacity || 1) * 100)}%</span>
            </div>
          </div>

          {/* File Info */}
          {item.assetId && (
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>{item.assetId.width}x{item.assetId.height}</span>
              <span>{formatFileSize(item.assetId.bytes)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAudioItem = (item: IAudioTimelineItem & { track: ITrack }) => (
    <div key={item._id} className="bg-zinc-800 rounded-lg overflow-hidden group hover:bg-zinc-700  transition-all duration-200">
      <div className="flex items-start p-3 gap-3">
        {/* Audio Icon */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-blue-900/20 rounded-md flex items-center justify-center">
            <Music className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 max-w-[70%]">
              <Music className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <h3 className="text-xs font-medium text-white truncate leading-tight">
                {item.assetId?.name || 'Audio Item'}
              </h3>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handlePlayItem(item)}
                className="p-1 hover:bg-zinc-600 rounded transition-colors"
                title="Play in video player"
              >
                <Play className="w-3 h-3 text-green-400" />
              </button>
              <button 
                onClick={() => handleDeleteItem(item._id)}
                className="p-1 hover:bg-red-500 rounded transition-colors"
                title="Delete item"
              >
                <Trash2 className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Audio Waveform */}
          <div className="bg-zinc-700 rounded-md h-6 mb-2 flex items-center justify-center px-2">
            <div className="flex items-end gap-0.5 w-full">
              {Array.from({length: 16}).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-500 rounded-full opacity-60"
                  style={{height: `${Math.random() * 12 + 4}px`}}
                />
              ))}
            </div>
          </div>

          {/* Timeline Info */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-zinc-700 rounded px-2 py-1">
              <div className="text-zinc-400 text-[10px] mb-0.5">Timeline</div>
              <div className="text-white text-[10px] font-medium">
                {formatDuration(item.startTime)} - {formatDuration(item.endTime)}
              </div>
            </div>
            <div className="bg-zinc-700 rounded px-2 py-1">
              <div className="text-zinc-400 text-[10px] mb-0.5">Source</div>
              <div className="text-white text-[10px] font-medium">
                {formatDuration(item.sourceStartTime)} - {formatDuration(item.sourceEndTime)}
              </div>
            </div>
          </div>

          {/* Audio Properties */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-400 mb-2">
            <div className="flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              <span className="text-white font-medium">{Math.round(item.volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Speed:</span>
              <span className="text-white font-medium">{item.speed}x</span>
            </div>
            {(item.fadeIn || item.fadeOut) && (
              <div className="flex items-center gap-1">
                <span>Fade:</span>
                <span className="text-white font-medium">
                  {item.fadeIn || 0}s/{item.fadeOut || 0}s
                </span>
              </div>
            )}
          </div>

          {/* File Info */}
          {item.assetId && (
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Duration: {formatDuration(item.assetId.duration || 0)}</span>
              <span>{formatFileSize(item.assetId.bytes)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTextItem = (item: ITextTimelineItem & { track: ITrack }) => (
    <div key={item._id} className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-lg overflow-hidden group hover:from-zinc-700 hover:to-zinc-800 transition-all duration-200">
      <div className="flex items-start p-3 gap-3">
        {/* Text Icon */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-purple-900/20 rounded-md flex items-center justify-center">
            <Type className="w-6 h-6 text-purple-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 max-w-[70%]">
              <Type className="w-3 h-3 text-purple-400 flex-shrink-0" />
              <h3 className="text-xs font-medium text-white truncate leading-tight">
                Text Overlay
              </h3>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handlePlayItem(item)}
                className="p-1 hover:bg-zinc-600 rounded transition-colors"
                title="Preview in video player"
              >
                <Eye className="w-3 h-3 text-green-400" />
              </button>
              <button 
                onClick={() => handleDeleteItem(item._id)}
                className="p-1 hover:bg-red-500 rounded transition-colors"
                title="Delete item"
              >
                <Trash2 className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Text Preview */}
          <div className="bg-zinc-700 rounded-md p-2 mb-2 min-h-[40px] flex items-center justify-center">
            <div 
              className="text-center w-full truncate leading-tight"
              style={{
                fontFamily: item.fontFamily,
                fontSize: `${Math.min(item.fontSize / 3, 14)}px`,
                color: item.color,
                opacity: item.opacity || 1
              }}
            >
              {item.content}
            </div>
          </div>

          {/* Timeline Info */}
          <div className="bg-zinc-700 rounded px-2 py-1 mb-2 text-center">
            <div className="text-zinc-400 text-[10px] mb-0.5">Timeline</div>
            <div className="text-white text-[10px] font-medium">
              {formatDuration(item.startTime)} - {formatDuration(item.endTime)}
            </div>
          </div>

          {/* Text Properties */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-400">
            <div className="flex items-center gap-1">
              <span>Size:</span>
              <span className="text-white font-medium">{item.fontSize}px</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Position:</span>
              <span className="text-white font-medium">{item.x},{item.y}</span>
            </div>
            <div className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded border border-zinc-600"
                style={{backgroundColor: item.color}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const activeItems = getActiveItems();

  return (
    <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        {/* Tab Buttons */}
        <div className="flex bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'video' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Play className="w-3 h-3" />
            Video
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'audio' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Music className="w-3 h-3" />
            Audio
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'text' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Type className="w-3 h-3" />
            Text
          </button>
        </div>
      </div>
      
      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 mb-10">
        <div className="space-y-2">
          {activeItems.map((item) => {
            if (item.type === 'video') {
              return renderVideoItem(item as IVideoTimelineItem & { track: ITrack });
            } else if (item.type === 'audio') {
              return renderAudioItem(item as IAudioTimelineItem & { track: ITrack });
            } else if (item.type === 'text') {
              return renderTextItem(item as ITextTimelineItem & { track: ITrack });
            }
            return null;
          })}
        </div>
        
        {activeItems.length === 0 && (
          <div className="text-center text-zinc-500 mt-8">
            <div className="text-2xl mb-2">
              {activeTab === 'video' ? '🎬' : activeTab === 'audio' ? '🎵' : '📝'}
            </div>
            <p className="text-xs">No {activeTab} items found</p>
            <p className="text-[10px] mt-1 text-zinc-600">
              Add {activeTab} items to your timeline to see them here
            </p>
          </div>
        )}
      </div>
      
      {/* Footer Stats */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950">
        <div className="text-[10px] text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Items:</span>
            <span className="text-white">{activeItems.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Duration:</span>
            <span className="text-white">
              {formatDuration(
                activeItems.reduce((sum, item) => sum + (item.endTime - item.startTime), 0)
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineTracksSidebar;