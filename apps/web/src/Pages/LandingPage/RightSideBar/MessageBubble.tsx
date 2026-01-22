import { Bot, Copy, Check } from "lucide-react";
import { useState, type RefObject } from "react";
import { Button } from "@/Components/ui/button";
import type { Message } from "./types";
import LiveTextStream from "./LivestreamText";

interface Props {
  message: Message;
  onCopy: (content: string) => void;
  llmSummaryRef: RefObject<string>;
  plannerOutputRef: RefObject<string>,
  isProcessing: boolean;
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
      <div className="flex justify-end mb-4 group max-w-[85%] ml-auto">
        <div className="bg-neutral-800 rounded-2xl rounded-tr-sm px-4 py-3 border border-white/5 shadow-sm">
          <div className="text-sm text-neutral-200 leading-relaxed break-words">
            {typeof message.content === "string" ? message.content : ""}
          </div>
          <div className="flex items-center justify-end mt-1 gap-2">
            <span className="text-[10px] text-neutral-500">
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
  const hasScenes = message.scenes && message.scenes.length > 0;

  // Filter out scenes that don't have a valid assetId OR valid direct properties
  // In Guest mode, we might get direct urls in scenes from backend if populated
  const validScenes =
    message.scenes?.filter((scene: any) => (scene.assetId && scene.assetId.url) || scene.url || scene.sceneName) || [];

  const showBotIcon = plannerOutput || llmResponse || hasScenes || (typeof message.content === 'string' && message.content);

  if (!showBotIcon && isProcessing) {
      return null;
  }

  return (
    <div className="mb-6 fade-in animate-in duration-300 slide-in-from-bottom-2">
      <div className="flex items-start gap-3 group">
        <div className="w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 bg-neutral-900 border-white/10 shadow-sm">
          <Bot className="w-4 h-4 text-emerald-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-neutral-900/50 border border-white/5 rounded-2xl rounded-tl-sm p-4">
            
            {/* Planner Output */}
            {plannerOutput && (
                <div className="text-sm text-neutral-400 leading-relaxed mb-3 font-mono text-xs bg-black/30 p-2 rounded">
                {(isProcessing && plannerOutputRef.current != plannerOutput && isLastMessage) ? (
                    (plannerOutputRef.current = plannerOutput) && 
                    <LiveTextStream
                    text={plannerOutputRef.current}
                    streamingSpeed={30}
                    />
                ) : ( 
                    <p className="break-words">{plannerOutput}</p>
                )}
                </div>
            )}

            {/* Scenes */}
            {validScenes.length > 0 && (
                <div className="space-y-3 mb-3">
                {validScenes.map((scene: any, index) => (
                    <VideoPlayer key={index} scene={scene} />
                ))}
                </div>
            )}

            {/* LLM Response */}
            {llmResponse && (
                <div className="text-sm text-neutral-300 leading-relaxed mb-2 break-words">
                {(streamSummaryRef.current && llmSummaryRef.current != llmResponse && isLastMessage && isProcessing) ? (
                    (llmSummaryRef.current = llmResponse) && 
                    <LiveTextStream
                    text={llmSummaryRef.current}
                    streamingSpeed={50}
                    onStreamingComplete={onStreamingComplete}
                    />
                ) : (
                    <p className="break-words">{llmResponse}</p>
                )}
                </div>
            )}

            {!isContentObject && typeof message.content === "string" && (
                <div className="text-sm text-neutral-300 leading-relaxed mb-2 break-words">
                {message.content}
                </div>
            )}
           </div>

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2 px-1">
            <span className="text-[10px] text-neutral-600">
              {formatTimestamp(message.timestamp)}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-neutral-500 hover:text-white"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
