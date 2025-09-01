import { useState, useEffect } from 'react';
import { Play, Music, Type, Volume2, VolumeX, Eye, Lock } from 'lucide-react';
import api from '@/api';
import type { Project } from '@/State/Types';

import { TrackType } from '@/State/Types';
import type { IAudioTimelineItem, IVideoTimelineItem, ITextTimelineItem, ITrack } from '@/State/Types';
import BeautifulLoader from '@/Components/LoadingScreens/Templatestore.loader';

interface Props {
  currentProject?:Project
}

// FIX UI:

// 1) ADD A DELETE BUTTON
// 2) hOVER EFFECT AND ANIMATIONS FIX KAR BC
// 3) THUMBNAIL LOOKS UGLY AF FIX IT
// 4) ADD BUTTONS TO UPDATE THE VARIABLES LIKE VOLUME, MUTE, OPACITY ETC
// 5) DISPLAY THE INFORMATION PROPERLY, EVERYTHING LOOKS REALLY REALLY UGLY RN
// 6) Add a play button that will load the asset into video player directly
// 7) What wrong with that green color stupid button at top right corner? Use proper labels to represent origin

const TimelineTracksSidebar = ({currentProject}:Props) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'text'>('video');
  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // You'll need to get this from props, context, or route params
  const timelineId = currentProject?.timeline._id; // Replace with actual timeline ID

  // Fetch tracks from backend
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

  // Load tracks on component mount
  useEffect(() => {
      fetchTracks();
  }, []);

  // Your existing helper functions remain the same
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (loading){
    return <BeautifulLoader/>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={fetchTracks}>Retry</button>
      </div>
    );
  }
  const renderVideoItem = (item: IVideoTimelineItem & { track: ITrack }) => (
    <div key={item._id} className="bg-zinc-900 rounded-lg p-3 hover:bg-zinc-800 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-medium text-white truncate">
            {item.assetId?.name || 'Video Item'}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {item.track.locked && <Lock className="w-3 h-3 text-yellow-400" />}
          {item.track.muted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-zinc-400" />}
        </div>
      </div>

      {/* Thumbnail */}
      {item.assetId?.thumbnail && (
        <div className="relative mb-2 rounded-md overflow-hidden bg-zinc-800">
          <img
            src={item.assetId.thumbnail}
            alt={item.assetId.name}
            className="w-full h-20 object-cover"
          />
          <div className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-[10px] px-1.5 py-0.5 rounded">
            {formatDuration(item.assetId.duration || 0)}
          </div>
        </div>
      )}

      {/* Timeline Info */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="bg-zinc-800 rounded px-2 py-1">
          <div className="text-zinc-400 text-[10px]">Timeline</div>
          <div className="text-white">{formatDuration(item.startTime)} - {formatDuration(item.endTime)}</div>
        </div>
        <div className="bg-zinc-800 rounded px-2 py-1">
          <div className="text-zinc-400 text-[10px]">Source</div>
          <div className="text-white">{formatDuration(item.sourceStartTime)} - {formatDuration(item.sourceEndTime)}</div>
        </div>
      </div>

      {/* Properties */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="text-zinc-400 text-[10px]">Speed</div>
          <div className="text-white">{item.speed}x</div>
        </div>
        <div className="text-center">
          <div className="text-zinc-400 text-[10px]">Volume</div>
          <div className="text-white">{Math.round((item.volume || 1) * 100)}%</div>
        </div>
        <div className="text-center">
          <div className="text-zinc-400 text-[10px]">Opacity</div>
          <div className="text-white">{Math.round((item.opacity || 1) * 100)}%</div>
        </div>
      </div>

      {/* File info */}
      {item.assetId && (
        <div className="mt-2 pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
          <div className="flex justify-between">
            <span>{item.assetId.width}x{item.assetId.height}</span>
            <span>{formatFileSize(item.assetId.bytes)}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderAudioItem = (item: IAudioTimelineItem & { track: ITrack }) => (
    <div key={item._id} className="bg-zinc-900 rounded-lg p-3 hover:bg-zinc-800 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white truncate">
            {item.assetId?.name || 'Audio Item'}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {item.track.locked && <Lock className="w-3 h-3 text-yellow-400" />}
          {item.track.muted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-zinc-400" />}
        </div>
      </div>

      {/* Audio Waveform Placeholder */}
      <div className="bg-zinc-800 rounded-md h-12 mb-2 flex items-center justify-center">
        <div className="flex items-end gap-0.5">
          {Array.from({length: 20}).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-blue-500 rounded-full opacity-60"
              style={{height: `${Math.random() * 20 + 8}px`}}
            />
          ))}
        </div>
      </div>

      {/* Timeline Info */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="bg-zinc-800 rounded px-2 py-1">
          <div className="text-zinc-400 text-[10px]">Timeline</div>
          <div className="text-white">{formatDuration(item.startTime)} - {formatDuration(item.endTime)}</div>
        </div>
        <div className="bg-zinc-800 rounded px-2 py-1">
          <div className="text-zinc-400 text-[10px]">Source</div>
          <div className="text-white">{formatDuration(item.sourceStartTime)} - {formatDuration(item.sourceEndTime)}</div>
        </div>
      </div>

      {/* Audio Properties */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="bg-zinc-800 rounded px-2 py-1 text-center">
          <div className="text-zinc-400 text-[10px]">Volume</div>
          <div className="text-white">{Math.round(item.volume * 100)}%</div>
        </div>
        <div className="bg-zinc-800 rounded px-2 py-1 text-center">
          <div className="text-zinc-400 text-[10px]">Speed</div>
          <div className="text-white">{item.speed}x</div>
        </div>
      </div>

      {/* Fade Effects */}
      {(item.fadeIn || item.fadeOut) && (
        <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
          <div className="text-center">
            <div className="text-zinc-400 text-[10px]">Fade In</div>
            <div className="text-white">{item.fadeIn ? `${item.fadeIn}s` : 'None'}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-400 text-[10px]">Fade Out</div>
            <div className="text-white">{item.fadeOut ? `${item.fadeOut}s` : 'None'}</div>
          </div>
        </div>
      )}

      {/* File info */}
      {item.assetId && (
        <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
          <div className="flex justify-between">
            <span>Duration: {formatDuration(item.assetId.duration || 0)}</span>
            <span>{formatFileSize(item.assetId.bytes)}</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderTextItem = (item: ITextTimelineItem & { track: ITrack }) => (
    <div key={item._id} className="bg-zinc-900 rounded-lg p-3 hover:bg-zinc-800 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">Text Overlay</h3>
        </div>
        <div className="flex items-center gap-1">
          {item.track.locked && <Lock className="w-3 h-3 text-yellow-400" />}
          <Eye className="w-3 h-3 text-zinc-400" />
        </div>
      </div>

      {/* Text Content Preview */}
      <div className="bg-zinc-800 rounded-md p-2 mb-2 min-h-[60px] flex items-center">
        <div 
          className="text-center w-full leading-tight"
          style={{
            fontFamily: item.fontFamily,
            fontSize: `${Math.min(item.fontSize / 3, 16)}px`,
            color: item.color
          }}
        >
          {item.content}
        </div>
      </div>

      {/* Timeline Info */}
      <div className="bg-zinc-800 rounded px-2 py-1 mb-2 text-xs text-center">
        <div className="text-zinc-400 text-[10px]">Timeline</div>
        <div className="text-white">{formatDuration(item.startTime)} - {formatDuration(item.endTime)}</div>
      </div>

      {/* Text Properties */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="text-center">
          <div className="text-zinc-400 text-[10px]">Font Size</div>
          <div className="text-white">{item.fontSize}px</div>
        </div>
        <div className="text-center">
          <div className="text-zinc-400 text-[10px]">Opacity</div>
          <div className="text-white">{Math.round((item.opacity || 1) * 100)}%</div>
        </div>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="text-center">
          <div className="text-zinc-400 text-[10px]">Position X</div>
          <div className="text-white">{item.x}px</div>
        </div>
        <div className="text-center">
          <div className="text-zinc-400 text-[10px]">Position Y</div>
          <div className="text-white">{item.y}px</div>
        </div>
      </div>

      {/* Animations */}
      {(item.animationIn || item.animationOut) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center">
            <div className="text-zinc-400 text-[10px]">In Animation</div>
            <div className="text-white text-[10px]">{item.animationIn || 'None'}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-400 text-[10px]">Out Animation</div>
            <div className="text-white text-[10px]">{item.animationOut || 'None'}</div>
          </div>
        </div>
      )}

      {/* Font & Color Info */}
      <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
        <div className="flex justify-between items-center">
          <span>Font: {item.fontFamily}</span>
          <div className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded border border-zinc-600"
              style={{backgroundColor: item.color}}
            />
            <span>{item.color}</span>
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
        {/* <h2 className="text-base font-semibold text-white mb-3">Timeline Tracks</h2> */}
        
        {/* Tab Buttons */}
        <div className="flex bg-zinc-900 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'text' 
                ? 'bg-white text-black' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Type className="w-3 h-3" />
            Overlay
          </button>
        </div>
      </div>
      
      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          {activeItems.map((item) => {
            console.log(item);
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