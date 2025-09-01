import React, {useEffect, useRef} from 'react';
import { 
  Send, 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/Components/ui/button';
import { Textarea } from '@/Components/ui/textarea';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
  mode: 'generate' | 'edit';
}

// Input Component with fixed text overlapping
const MessageInput = ({ value, onChange, onSubmit, disabled, placeholder,mode }: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex-shrink-0">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "min-h-[44px] max-h-[120px] bg-neutral-900/60 border-neutral-700/60 text-neutral-200",
            "placeholder-neutral-500 resize-none text-sm leading-relaxed pr-12",
            mode === 'generate'
              ? "focus-visible:ring-1 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50"
              : "focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"
          )}
          rows={1}
        />
        <Button
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
          size="sm"
          className={cn(
            "absolute right-2 bottom-2 w-8 h-8 p-0 transition-all duration-200",
            mode === 'generate' 
              ? "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50" 
              : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50",
            "text-white"
          )}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      {/* Fixed text overlapping by stacking on smaller screens and ensuring proper spacing */}
      <div className="mt-3 flex flex-col gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="flex-shrink-0 leading-tight">
          Press Shift+Enter for new line
        </span>
        <span className={cn(
          "transition-colors duration-200 flex-shrink-0 font-medium",
          mode === 'generate' ? "text-emerald-400" : "text-blue-400"
        )}>
          {mode === 'generate' ? 'Generate Mode' : 'Edit Mode'}
        </span>
      </div>
    </div>
  );
};

export default MessageInput;