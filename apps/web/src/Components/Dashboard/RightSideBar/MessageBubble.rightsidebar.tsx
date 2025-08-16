import { 
  Bot, 
  Copy,
  Check,
  Download,
  Share2,
  Bookmark,
  RotateCcw,
} from 'lucide-react';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/Components/ui/button';
import { type Message } from '@/State/Dashboard.state';

// Message Component
const MessageBubble = ({ 
  message, 
  onCopy, 
  onRegenerate, 
  onSave, 
  mode 
}: { 
  message: Message, 
  onCopy: (content: string) => void,
  onRegenerate?: (message: Message) => void,
  onSave?: (message: Message) => void,
  mode: 'generate' | 'edit'
}) => {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSave?.(message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4 group">
        <div className="max-w-[85%] bg-neutral-800/60 border border-neutral-700/50 rounded-lg px-3 py-2.5">
          <div className="text-sm text-neutral-200 leading-relaxed">
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
              {onRegenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
                  onClick={() => onRegenerate(message)}
                  title="Regenerate response"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
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
        <div className="text-sm text-neutral-200 leading-relaxed mb-2">
          {message.content}
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
            {onSave && (
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
                onClick={handleSave}
                title="Save to templates"
              >
                {saved ? <Check className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
              title="Download response"
            >
              <Download className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50"
              title="Share response"
            >
              <Share2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble