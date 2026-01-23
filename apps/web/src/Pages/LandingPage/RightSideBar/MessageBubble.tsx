import { Copy, Check, Sparkles, Terminal } from "lucide-react";
import { useState, type RefObject } from "react";
import { Button } from "@/Components/ui/button";
import type { Message, GenerationStage } from "./types";
import LiveTextStream from "./LivestreamText";

interface Props {
  message: Message;
  onCopy: (content: string) => void;
  llmSummaryRef: RefObject<string>;
  plannerOutputRef: RefObject<string>,
  isProcessing: boolean;
  generationStage: GenerationStage;
  isLastMessage: boolean;
  streamSummaryRef: RefObject<boolean>;
  onStreamingComplete?: () => void;
}

const VideoPlayer = ({ scene }: { scene: any }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const videoUrl = scene.assetId?.url || scene.url || "";
  const thumbnailUrl = scene.assetId?.thumbnail || scene.thumbnail || "";
  const duration = scene.assetId?.duration || scene.duration || 0;

  return (
    <div className="mt-3 rounded-md overflow-hidden w-full border border-white/10 shadow-lg bg-black">
      {!isPlaying ? (
        <div className="relative cursor-pointer aspect-video" onClick={handlePlayClick}>
          <img
            src={thumbnailUrl || "https://dummyimage.com/640x360/000/fff&text=Processing..."}
            alt={scene.sceneName}
            className="aspect-video object-cover w-full h-full"
          />
          <div className="absolute inset-0 flex items-center justify-center ">
            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-all backdrop-blur-sm">
              <svg
                className="w-6 h-6 text-black ml-1"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white backdrop-blur-md">
              {Math.floor(duration)}s
            </div>
          )}
        </div>
      ) : (
        <video
          src={videoUrl}
          autoPlay
          playsInline
          controls
          className="aspect-video w-full h-full"
          onEnded={() => setIsPlaying(false)}
        />
      )}
      <div className="p-2 bg-neutral-900/80 border-t border-white/5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-200 truncate">
            {scene.sceneName}
          </p>
          <button
            onClick={handleToggleExpand}
            className="text-xs gap-2 h-5 flex items-center justify-center text-neutral-400 cursor-pointer hover:text-neutral-200 transition-colors"
          >
             <p className="text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300">Prompt</p>
          </button>
        </div>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isExpanded ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0"
          }`}
        >
          <p className="text-xs text-neutral-400">{scene.prompt}</p>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({
  message,
  onCopy,
  llmSummaryRef,
  plannerOutputRef,
  isLastMessage,
  isProcessing,
  generationStage,
  streamSummaryRef,
  onStreamingComplete
}: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const contentText =
      typeof message.content === "string"
        ? message.content
        : message.content.llmResponse || message.content.plannerOutput || "";

    await navigator.clipboard.writeText(contentText);
    onCopy(contentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-8 group ml-auto pl-12">
        <div className="relative max-w-[85%]">
            <div className="bg-[#1A1A1A] rounded-2xl rounded-tr-sm px-6 py-4 border border-white/10 shadow-lg backdrop-blur-md">
            <div className="text-[15px] text-neutral-200 leading-relaxed font-light tracking-wide">
                {typeof message.content === "string" ? message.content : ""}
            </div>
            </div>
            <div className="flex items-center justify-end mt-2 gap-2 opacity-50 px-1">
                <span className="text-[10px] text-neutral-500 font-medium tracking-wider uppercase">
                {formatTimestamp(message.timestamp)}
                </span>
            </div>
        </div>
      </div>
    );
  }

  // Assistant message
  const isContentObject = typeof message.content !== "string";
  const plannerOutput = isContentObject
    ? (message.content as { plannerOutput: string; llmResponse: string })
        .plannerOutput
    : "";
  const llmResponse = isContentObject
    ? (message.content as { plannerOutput: string; llmResponse: string })
        .llmResponse
    : "";
    
  // Filter out scenes
  const validScenes =
    message.scenes?.filter((scene: any) => (scene.assetId && scene.assetId.url) || scene.url || scene.sceneName) || [];

    // Determine if we should show ANY content?
    // If it's a new empty message (Thinking...), we show the granular progress instead.
  const hasContent = plannerOutput || llmResponse || validScenes.length > 0 || (typeof message.content === 'string' && message.content);
  
  // Custom Granular Progress Display
  const showProgress = isProcessing && isLastMessage && generationStage !== 'idle' && generationStage !== 'complete';
  
  // If no content yet and not processing, hide (err check)
  if (!hasContent && !isProcessing) return null;

  return (
    <div className="mb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards">
      <div className="flex flex-col gap-4">
        
        {/* Assistant Header */}
        <div className="flex items-center gap-3 px-1">
             <div className="w-6 h-6 rounded-full bg-linear-to-br from-emerald-400/20 to-cyan-400/20 flex items-center justify-center border border-emerald-500/30">
                <Sparkles className="w-3 h-3 text-emerald-400" />
             </div>
             <span className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Stitcher AI</span>
             <span className="text-[10px] text-neutral-600 font-mono">{formatTimestamp(message.timestamp)}</span>
        </div>

        <div className="pl-0 md:pl-9 w-full">
            
            {/* 1. GRANULAR PROGRESS INDICATOR (When Processing) */}
            {showProgress && (
                <div className="mb-6 p-1">
                    <div className="inline-flex items-center gap-4 bg-neutral-900/50 pr-6 pl-2 py-2 rounded-full border border-emerald-500/10 shadow-[0_0_30px_-5px_rgba(16,185,129,0.1)]">
                        <div className="relative w-8 h-8 flex items-center justify-center bg-black rounded-full overflow-hidden border border-emerald-500/20">
                           <img 
                                src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760610643/loading_animation_phpia7.gif" 
                                alt="Loading"
                                className="w-full h-full object-cover opacity-80"
                            />
                        </div>
                        <div className="flex flex-col justify-center gap-0.5">
                             <span className="text-sm font-medium text-emerald-400/90 tracking-wide animate-pulse">
                                {generationStage === 'planning' && "Planning animation..."}
                                {generationStage === 'generating' && "Writing Manim code..."}
                                {generationStage === 'rendering' && "Rendering scenes..."}
                             </span>
                             <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">
                                {generationStage === 'planning' ? "Analyzing request" : "Processing assets"}
                             </span>
                        </div>
                    </div>
                </div>
            )}

          <div className="flex flex-col gap-4 w-full max-w-full overflow-hidden">
            
            {/* 2. PLANNER OUTPUT (Terminal Style) */}
            {plannerOutput && (
                <div className="w-full rounded-lg bg-[#0F0F0F] border border-white/5 overflow-hidden group/terminal">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/5">
                        <Terminal className="w-3 h-3 text-neutral-500" />
                        <span className="text-[10px] font-mono text-neutral-500 uppercase">Planner Logs</span>
                    </div>
                    <div className="p-4 font-mono text-xs text-neutral-400 leading-relaxed overflow-x-auto custom-scrollbar max-h-[300px]">
                        {(isProcessing && plannerOutputRef.current != plannerOutput && isLastMessage) ? (
                            (plannerOutputRef.current = plannerOutput) && 
                            <LiveTextStream
                                text={plannerOutputRef.current}
                                streamingSpeed={5}
                            />
                        ) : ( 
                            <div className="whitespace-pre-wrap">{plannerOutput}</div>
                        )}
                        {generationStage === 'planning' && (
                             <span className="inline-block w-1.5 h-3 ml-1 bg-emerald-500/50 animate-pulse align-middle" />
                        )}
                    </div>
                </div>
            )}

            {/* 3. SCENES (Video Players) */}
            {validScenes.length > 0 && (
                <div className="grid grid-cols-1 gap-4 mt-2">
                {validScenes.map((scene: any, index: number) => (
                    <VideoPlayer key={index} scene={scene} />
                ))}
                </div>
            )}

            {/* 4. LLM RESPONSE (Final Text) */}
            {llmResponse && (
                <div className="text-[15px] font-light text-neutral-200 leading-7 tracking-wide break-words mt-2">
                {(streamSummaryRef.current && llmSummaryRef.current != llmResponse && isLastMessage && isProcessing) ? (
                    (llmSummaryRef.current = llmResponse) && 
                    <LiveTextStream
                    text={llmSummaryRef.current}
                    streamingSpeed={20}
                    onStreamingComplete={onStreamingComplete}
                    />
                ) : (
                    <p className="whitespace-pre-wrap">{llmResponse}</p>
                )}
                </div>
            )}

            {/* 5. Fallback Text Content */}
            {!isContentObject && typeof message.content === "string" && message.content && (
                <div className="text-[15px] text-neutral-300 leading-relaxed">
                {message.content}
                </div>
            )}
            
            {/* Actions */}
             {hasContent && !isProcessing && (
                <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-neutral-500 hover:text-white hover:bg-white/5 gap-1.5 rounded-md"
                        onClick={handleCopy}
                    >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                </div>
            )}

           </div>
          </div>

      </div>
    </div>
  );
};

export default MessageBubble;
