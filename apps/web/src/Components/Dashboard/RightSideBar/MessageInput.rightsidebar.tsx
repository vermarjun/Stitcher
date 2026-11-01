import React, { useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/Components/ui/button";
import { Textarea } from "@/Components/ui/textarea";
import type { Asset } from "@/State/Types";

interface Props {
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  placeholder: string;
  mode?: "generate" | "edit";
  /** Shows a stop button while processing. Omit when the flow cannot be cancelled. */
  onCancel?: () => void;
  // Kept for backward-compat with Edit component — not used in this redesign
  onFileDrop?: (files: FileList) => void;
  onAssetDrop?: (asset: Asset) => void;
  droppedItems?: Asset[];
  onRemoveItem?: (id: string) => void;
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
    <div className="px-3 pb-3 pt-2 bg-zinc-900 flex-shrink-0 border-t border-zinc-800">
      {/* Unified composer container */}
      <div
        className={cn(
          "rounded-2xl bg-neutral-900/70 border border-zinc-700/60",
          "focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30",
          "transition-all duration-200"
        )}
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isProcessing}
          className={cn(
            "min-h-[44px] max-h-[120px] w-full bg-transparent border-0 text-neutral-200 text-sm",
            "placeholder-neutral-500 resize-none px-4 pt-3 pb-2",
            "focus-visible:ring-0 focus-visible:outline-none",
            "disabled:opacity-60"
          )}
          rows={1}
        />

        {/* Bottom action row inside the container */}
        <div className="flex items-center justify-end gap-1 px-2 pb-2">
          {isProcessing && onCancel && (
            <Button
              onClick={onCancel}
              size="sm"
              className="h-7 w-7 p-0 rounded-lg bg-red-700/80 hover:bg-red-700 text-white transition-colors"
              title="Cancel generation"
            >
              <Square className="w-3 h-3" />
            </Button>
          )}
          <Button
            onClick={onSubmit}
            disabled={!input.trim() || isProcessing}
            size="sm"
            className={cn(
              "h-7 w-7 p-0 rounded-lg transition-colors",
              "bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white"
            )}
            title="Send"
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Helper text */}
      <p className="mt-1.5 text-[11px] text-neutral-600 leading-tight">
        Shift+Enter for new line
      </p>
    </div>
  );
};

export default MessageInput;
