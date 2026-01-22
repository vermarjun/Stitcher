import React, { useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/Components/ui/button";
import { Textarea } from "@/Components/ui/textarea";

interface Props {
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  placeholder: string;
  onCancel?: () => void;
}

const MessageInput = ({
  input = "",
  setInput,
  onSubmit,
  isProcessing,
  placeholder,
  onCancel,
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="p-4 bg-black/80 backdrop-blur-md border-t border-white/10 flex-shrink-0">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isProcessing}
          className={cn(
            "min-h-[50px] max-h-[100px] bg-neutral-900 border-white/10 text-neutral-200 text-sm rounded-2xl",
            "placeholder-neutral-600 resize-none pr-12 py-3 focus-visible:ring-1 focus-visible:ring-emerald-500/50"
          )}
          rows={1}
        />
        
        {isProcessing && onCancel && (
          <Button
            onClick={onCancel}
            size="sm"
            className="absolute right-2 bottom-2 w-8 h-8 p-0 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded-full"
          >
            <Square className="w-3 h-3 fill-current" />
          </Button>
        )}
        
        {!isProcessing && (
          <Button
            onClick={onSubmit}
            disabled={!input.trim()}
            size="sm"
            className={cn(
              "absolute right-2 bottom-2 w-8 h-8 p-0 rounded-full transition-all duration-200",
              "bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white"
            )}
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="mt-2 text-[10px] text-neutral-600 text-center uppercase tracking-widest">
        Free Guest Mode • 2 Trials
      </div>
    </div>
  );
};

export default MessageInput;
