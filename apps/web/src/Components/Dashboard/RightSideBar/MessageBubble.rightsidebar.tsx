import { 
  Bot, 
  Copy,
  Check,
  Download,
} from 'lucide-react';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/Components/ui/button';
import type { Message } from '@/State/Types';

interface Props { 
  message: Message, 
  onCopy: (content: string) => void,
  onRegenerate?: (message: Message) => void,
  onSave?: (message: Message) => void,
  mode: 'generate' | 'edit'
}


// Video Player Component
const VideoPlayer = ({ asset }: { asset: any }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const handlePlayClick = () => {
    setIsPlaying(true);
  };
  
  return (
    <div className="mt-3 rounded-md overflow-hidden w-[85%] min-h-full">
      {!isPlaying ? (
        <div 
          className="relative cursor-pointer"
          onClick={handlePlayClick}
        >
          <img 
            src={asset.thumbnail} 
            alt={asset.name}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-opacity-30">
            <div className="w-10 h-10 rounded-full bg-white bg-opacity-80 flex items-center justify-center">
              <svg 
                className="w-6 h-6 text-black" 
                viewBox="0 0 24 24" 
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <video 
          src={asset.url} 
          autoPlay 
          playsInline
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
};
  

// Message Component
const MessageBubble = ({ message, onCopy, mode }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4 group">
        <div className="w-[85%] bg-neutral-800/60 border border-neutral-700/50 rounded-lg px-3 py-1.5">
          <div className="text-xs text-neutral-200 leading-relaxed">
            {message.content}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-neutral-500">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
                onClick={handleCopy}
                title="Copy message"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-6 group">
      <div className={cn(
        "w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300",
        mode === 'generate'
          ? "bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/30"
          : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30"
      )}>
        <Bot className={cn(
          "w-3 h-3 transition-colors duration-300",
          mode === 'generate' ? "text-emerald-400" : "text-blue-400"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-neutral-200 leading-relaxed mb-2">
          {message.content}
          {
            message.role === 'assistant' && message.assetId && (
                <VideoPlayer asset={message.assetId} />
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
              onClick={handleCopy}
              title="Copy response"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
              title="Download response"
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble