// src/Components/Dashboard/Sidebar/Explorer.tsx
import { useState } from 'react';
import { 
  ChevronRight,
  Folder,
  File,
  Video,
  Image,
  Music,
  Plus,
  Upload
} from 'lucide-react';

const ExplorerComponent = () => {
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const mockFiles = [
    { id: '1', name: 'assets', type: 'folder', children: [
      { id: '2', name: 'videos', type: 'folder', children: [
        { id: '3', name: 'intro.mp4', type: 'video' },
        { id: '4', name: 'outro.mp4', type: 'video' }
      ]},
      { id: '5', name: 'images', type: 'folder', children: [
        { id: '6', name: 'logo.png', type: 'image' },
        { id: '7', name: 'background.jpg', type: 'image' }
      ]},
      { id: '8', name: 'audio', type: 'folder', children: [
        { id: '9', name: 'bgm.mp3', type: 'audio' }
      ]}
    ]},
    { id: '10', name: 'project.json', type: 'file' },
    { id: '11', name: 'timeline.json', type: 'file' }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder size={16} className="text-blue-400" />;
      case 'video': return <Video size={16} className="text-red-400" />;
      case 'image': return <Image size={16} className="text-green-400" />;
      case 'audio': return <Music size={16} className="text-yellow-400" />;
      default: return <File size={16} className="text-neutral-400" />;
    }
  };

  const FileItem = ({ item, depth = 0 }: { item: any; depth?: number }) => {
    const isExpanded = expandedFolders.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div>
        <div 
          className="flex items-center py-1 px-2 hover:bg-neutral-800 cursor-pointer"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => item.type === 'folder' && toggleFolder(item.id)}
        >
          {hasChildren && (
            <ChevronRight 
              size={12} 
              className={`mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''} text-neutral-400`} 
            />
          )}
          {!hasChildren && <div className="w-4 mr-1" />}
          {getIcon(item.type)}
          <span className="ml-2 text-sm text-neutral-200 truncate">{item.name}</span>
        </div>
        {hasChildren && isExpanded && item.children.map((child: any) => (
          <FileItem key={child.id} item={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Explorer</h2>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-neutral-800 rounded transition-colors">
              <Plus size={14} className="text-neutral-400" />
            </button>
            <button className="p-1 hover:bg-neutral-800 rounded transition-colors">
              <Upload size={14} className="text-neutral-400" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="space-y-0.5">
          {mockFiles.map(item => (
            <FileItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExplorerComponent;