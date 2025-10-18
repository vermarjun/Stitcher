import React, { useEffect, useRef, useState } from "react";
import { LucideUpload, Send, Square, X, Image, FileText } from "lucide-react";
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
  onCancel: () => void;
  onFileDrop?: (files: FileList) => void;
  onAssetDrop?: (asset: Asset) => void; // Updated type
  droppedItems?: Asset[];
  onRemoveItem?: (id: string) => void;
}

const MessageInput = ({
  input = "",
  setInput,
  onSubmit,
  isProcessing,
  placeholder,
  mode = "generate",
  onCancel,
  onFileDrop,
  onAssetDrop,
  droppedItems = [],
  onRemoveItem,
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleCancelButton = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Enhanced drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the actual drop zone
    const relatedTarget = e.relatedTarget as Node;
    const currentTarget = e.currentTarget as Node;
    
    if (!currentTarget.contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Set the drop effect to copy
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Check for asset data from left sidebar
    const assetData = e.dataTransfer.getData("application/json");
    if (assetData) {
      try {
        const asset = JSON.parse(assetData) as Asset;
        // Call the handler to add the dropped asset
        onAssetDrop?.(asset);
        return;
      } catch (error) {
        console.error("Error parsing dropped asset:", error);
      }
    }
    
    // Fallback to file drop (existing functionality)
    if (onFileDrop && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files);
    }
  };

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveItem?.(id);
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="w-3 h-3" />;
      case 'document':
        return <FileText className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-3 bg-zinc-800 flex-shrink-0 border-t border-neutral-800`}
    >
      {/* Dropped Items Thumbnails - Fixed condition */}
      {droppedItems.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                mode === "generate" ? "bg-emerald-500" : "bg-blue-500"
              )} />
              <span className="text-xs font-medium text-neutral-300">
                Attached ({droppedItems.length})
              </span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-neutral-700/60 to-transparent"></div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {droppedItems.map((item) => (
              <div
                key={item._id}
                className="relative group bg-neutral-900/60 w-[80%] rounded-lg border border-neutral-700/50 hover:border-neutral-600 transition-all duration-200 hover:shadow-lg"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="aspect-video h-12 rounded-l-md bg-neutral-700/50 flex items-center justify-center overflow-hidden">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center",
                          mode === "generate"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-blue-500/20 text-blue-300"
                        )}
                      >
                        {getAssetIcon(item.type)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-2 pr-2">
                    <p className="text-xs font-medium text-neutral-200 truncate max-w-[120px]">
                      {item.name}
                    </p>
                    <p className="text-xs text-neutral-400 capitalize">
                      {item.type}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleRemoveItem(item._id, e)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 cursor-pointer rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 border border-neutral-800 shadow-lg"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compact Drag & Drop Zone - Shows when no items are attached */}
       {/* Enhanced Drag & Drop Zone */}
      {droppedItems.length === 0 && mode === "generate" && (
        <div
          className={cn(
            "mb-3 rounded-xl border-2 border-dashed transition-all duration-300",
            "flex items-center justify-center py-2 px-4 cursor-pointer group",
            "hover:shadow-lg",
            isDragging
              ? "border-emerald-400 bg-emerald-500/20"
              : "bg-neutral-900/60 border-neutral-700"
          )}
        >
          <div className="flex items-center gap-2 text-center">
            <div className={cn(
              "p-1 rounded-lg transition-colors duration-300 bg-neutral-700/50 group-hover:bg-neutral-700/70"
            )}>
              <LucideUpload
                className={cn(
                  "w-4 h-4 transition-all duration-300",
                  isDragging
                    ? "text-emerald-400"
                    : "text-neutral-300"
                )}
              />
            </div>
            <div className="text-left">
              <p className={cn(
                "text-xs font-medium transition-colors duration-300",
                isDragging ? "text-emerald-400" : "text-neutral-300 group-hover:text-neutral-200"
              )}>
                Drop assets to edit
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Message Input - unchanged */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isProcessing}
          className={cn(
            "min-h-[40px] max-h-[80px] bg-neutral-900/60 border-neutral-700/60 text-neutral-200 text-sm",
            "placeholder-neutral-500 resize-none pr-16 py-2",
            mode === "generate"
              ? "focus-visible:ring-1 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50"
              : "focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"
          )}
          rows={1}
        />
        
        {/* Cancel Button - Only shows when processing */}
        {isProcessing && (
          <Button
            onClick={handleCancelButton}
            size="sm"
            className={cn(
              "absolute right-10 bottom-1 w-7 h-7 p-0 transition-all duration-200",
              "bg-red-700/80 hover:bg-red-700 text-white"
            )}
          >
            <Square className="w-3 h-3" />
          </Button>
        )}
        
        {/* Submit Button */}
        <Button
          onClick={onSubmit}
          disabled={!input.trim() || isProcessing}
          size="sm"
          className={cn(
            "absolute right-1 bottom-1 w-7 h-7 p-0 transition-all duration-200",
            mode === "generate"
              ? "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50",
            "text-white"
          )}
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>

      {/* Compact helper text */}
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span className="leading-tight">Shift+Enter for new line</span>
        <span
          className={cn(
            "transition-colors duration-200 font-medium",
            mode === "generate" ? "text-emerald-400" : "text-blue-400"
          )}
        >
          {mode === "generate" ? "Generate Animations" : "Edit"}
        </span>
      </div>
    </div>
  );
};

export default MessageInput;