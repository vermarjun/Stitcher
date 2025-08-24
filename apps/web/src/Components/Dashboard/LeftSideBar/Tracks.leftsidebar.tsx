import React, { useState } from 'react';
import { Play, Music, Type, Clock, Volume2, VolumeX, Eye, EyeOff, Lock, Unlock } from 'lucide-react';

// Enums based on your schema
enum TrackType {
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text'
}

enum AssetType {
  VIDEO = 'video',
  AUDIO = 'audio',
}

enum AssetOrigin {
  TEMPLATE = 'template',
  UPLOAD = 'upload',
  GENERATED_VIDEO = 'generated_video'
}

enum TextAnimationType {
  FADE_IN = 'fadeIn',
  FADE_OUT = 'fadeOut',
  NONE = 'none'
}

// Interfaces based on your schema
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
}

interface ITimelineItemBase {
  _id: string;
  type: 'video' | 'audio' | 'text';
  trackId: string;
  startTime: number;
  endTime: number;
  assetId?: string;
  metadata: Record<string, any>;
  volume?: number;
  opacity?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
}

interface IVideoTimelineItem extends ITimelineItemBase {
  type: 'video';
  assetId: string;
  sourceStartTime: number;
  sourceEndTime: number;
  speed: number;
  asset?: IAsset;
}

interface IAudioTimelineItem extends ITimelineItemBase {
  type: 'audio';
  assetId: string;
  sourceStartTime: number;
  sourceEndTime: number;
  speed: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  asset?: IAsset;
}

interface ITextTimelineItem extends ITimelineItemBase {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  animationIn?: TextAnimationType;
  animationOut?: TextAnimationType;
}

type ITimelineItem = IVideoTimelineItem | IAudioTimelineItem | ITextTimelineItem;

interface ITrack {
  _id: string;
  type: TrackType;
  projectId: string;
  timelineId: string;
  order: number;
  locked: boolean;
  muted: boolean;
  items: ITimelineItem[];
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
    updatedAt: '2024-01-01T00:00:00Z'
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
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

const sampleTracks: ITrack[] = [
  {
    _id: 'track1',
    type: TrackType.VIDEO,
    projectId: 'project1',
    timelineId: 'timeline1',
    order: 1,
    locked: false,
    muted: false,
    items: [
      {
        _id: 'item1',
        type: 'video',
        trackId: 'track1',
        startTime: 0,
        endTime: 30,
        assetId: '1',
        sourceStartTime: 5,
        sourceEndTime: 35,
        speed: 1,
        volume: 0.8,
        opacity: 1,
        metadata: {},
        asset: sampleAssets[0]
      } as IVideoTimelineItem,
      {
        _id: 'item2',
        type: 'video',
        trackId: 'track1',
        startTime: 35,
        endTime: 50,
        assetId: '1',
        sourceStartTime: 10,
        sourceEndTime: 25,
        speed: 1.2,
        volume: 1,
        opacity: 0.9,
        metadata: {},
        asset: sampleAssets[0]
      } as IVideoTimelineItem
    ]
  },
  {
    _id: 'track2',
    type: TrackType.AUDIO,
    projectId: 'project1',
    timelineId: 'timeline1',
    order: 2,
    locked: false,
    muted: true,
    items: [
      {
        _id: 'item3',
        type: 'audio',
        trackId: 'track2',
        startTime: 0,
        endTime: 60,
        assetId: '2',
        sourceStartTime: 0,
        sourceEndTime: 60,
        speed: 1,
        volume: 0.6,
        fadeIn: 2,
        fadeOut: 3,
        metadata: {},
        asset: sampleAssets[1]
      } as IAudioTimelineItem
    ]
  },
  {
    _id: 'track3',
    type: TrackType.TEXT,
    projectId: 'project1',
    timelineId: 'timeline1',
    order: 3,
    locked: true,
    muted: false,
    items: [
      {
        _id: 'item4',
        type: 'text',
        trackId: 'track3',
        startTime: 10,
        endTime: 25,
        content: 'Welcome to our Video',
        fontFamily: 'Arial',
        fontSize: 48,
        color: '#ffffff',
        x: 100,
        y: 50,
        opacity: 1,
        animationIn: TextAnimationType.FADE_IN,
        animationOut: TextAnimationType.FADE_OUT,
        metadata: {}
      } as ITextTimelineItem,
      {
        _id: 'item5',
        type: 'text',
        trackId: 'track3',
        startTime: 30,
        endTime: 40,
        content: 'Subscribe for more!',
        fontFamily: 'Helvetica',
        fontSize: 36,
        color: '#ff6b6b',
        x: 200,
        y: 400,
        opacity: 0.9,
        animationIn: TextAnimationType.FADE_IN,
        metadata: {}
      } as ITextTimelineItem
    ]
  }
];

const TimelineTracksSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'text'>('video');
  const [tracks] = useState<ITrack[]>(sampleTracks);

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

  const renderVideoItem = (item: IVideoTimelineItem & { track: ITrack }) => (
    <div key={item._id} className="bg-zinc-900 rounded-lg p-3 hover:bg-zinc-800 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-medium text-white truncate">
            {item.asset?.name || 'Video Item'}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {item.track.locked && <Lock className="w-3 h-3 text-yellow-400" />}
          {item.track.muted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-zinc-400" />}
        </div>
      </div>

      {/* Thumbnail */}
      {item.asset?.thumbnail && (
        <div className="relative mb-2 rounded-md overflow-hidden bg-zinc-800">
          <img
            src={item.asset.thumbnail}
            alt={item.asset.name}
            className="w-full h-20 object-cover"
          />
          <div className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-[10px] px-1.5 py-0.5 rounded">
            {formatDuration(item.asset.duration || 0)}
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
      {item.asset && (
        <div className="mt-2 pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
          <div className="flex justify-between">
            <span>{item.asset.width}x{item.asset.height}</span>
            <span>{formatFileSize(item.asset.bytes)}</span>
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
            {item.asset?.name || 'Audio Item'}
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
      {item.asset && (
        <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
          <div className="flex justify-between">
            <span>Duration: {formatDuration(item.asset.duration || 0)}</span>
            <span>{formatFileSize(item.asset.bytes)}</span>
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
        <h2 className="text-base font-semibold text-white mb-3">Timeline Tracks</h2>
        
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