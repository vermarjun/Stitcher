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
    <div className="fixed bottom-0 right-0 w-full md:w-[450px] p-6 z-50 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
       {/* Trial Badge */}
       <div className="flex justify-center mb-3 opacity-0 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-300">
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-2 shadow-xl">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] text-neutral-400 font-medium tracking-wider uppercase">Free Guest Mode • 2 Trials Left</span>
          </div>
       </div>

      <div className="relative group pointer-events-auto">
        {/* Glow Effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 blur-lg" />
        
        <div className="relative bg-neutral-900/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/5">
            <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isProcessing}
            className={cn(
                "min-h-[56px] max-h-[120px] bg-transparent border-none text-neutral-100 text-[15px] font-light",
                "placeholder-neutral-600 resize-none pr-14 pl-5 py-4 focus-visible:ring-0 shadow-none leading-relaxed"
            )}
            rows={1}
            />
            
            <div className="absolute right-2 bottom-2">
                {isProcessing && onCancel ? (
                    <Button
                        onClick={onCancel}
                        size="icon"
                        className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
                    >
                        <Square className="w-3.5 h-3.5 fill-current" />
                    </Button>
                ) : (
                    <Button
                        onClick={onSubmit}
                        disabled={!input.trim()}
                        size="icon"
                        className={cn(
                        "w-10 h-10 rounded-full transition-all duration-300 shadow-lg",
                        input.trim() 
                            ? "bg-white text-black hover:bg-neutral-200 hover:scale-105 active:scale-95" 
                            : "bg-white/5 text-white/20"
                        )}
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </Button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
