import { Copy, Check, Download } from "lucide-react";
import { useState, type RefObject } from "react";
import { Button } from "@/Components/ui/button";
import type { Message } from "./Main.rightsidebar";
import LiveTextStream from "./LivestreamText.rightsidebar";

/**
 * Returns true when the string looks like a video URL that should be embedded.
 * Matches:
 *   - Cloudinary video delivery URLs  (res.cloudinary.com/.../video/)
 *   - Any URL ending with .mp4 or .webm (query string ignored)
 */
function isVideoUrl(value: string): boolean {
  if (!value) return false;
  try {
    // Must start with http/https to be a URL at all
    if (!/^https?:\/\//i.test(value.trim())) return false;
    // Cloudinary video delivery path
    if (/res\.cloudinary\.com\/.+\/video\//i.test(value)) return true;
    // Generic .mp4 / .webm extension (strip query string for the test)
    const pathname = new URL(value).pathname.toLowerCase();
    if (pathname.endsWith('.mp4') || pathname.endsWith('.webm')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Format a millisecond duration into a human-readable string. */
function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

/**
 * URL that makes the browser save the file instead of playing it. The API's
 * /media route turns "?download=<name>" into a Content-Disposition header.
 * Cloudinary URLs (optional storage backend) use the fl_attachment flag.
 */
function toDownloadUrl(u: string): string {
  const marker = '/upload/';
  if (/res\.cloudinary\.com\//i.test(u) && u.includes(marker)) {
    const i = u.indexOf(marker);
    return u.slice(0, i + marker.length) + 'fl_attachment:stitcher-video/' + u.slice(i + marker.length);
  }
  return u + (u.includes('?') ? '&' : '?') + 'download=stitcher-video';
}

/** Embedded player for a completed generation's final video URL. */
const FinalVideoPlayer = ({ url, generationMs }: { url: string; generationMs?: number }) => {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = toDownloadUrl(url);
    a.download = "stitcher-video.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="mt-2 rounded-md overflow-hidden w-full border border-zinc-800 shadow-lg">
      <video
        src={url}
        controls
        playsInline
        className="w-full aspect-video bg-black"
      />
      <div className="p-2 bg-zinc-800 flex items-center justify-between">
        <span className="text-xs text-neutral-400">
          {generationMs && generationMs > 0 ? `Generated in ${formatDuration(generationMs)}` : "Generated"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Download"
            onClick={handleDownload}
            className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-zinc-700/60 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface Props {
  message: Message;
  onCopy: (content: string) => void;
  onRegenerate?: (message: Message) => void;
  onSave?: (message: Message) => void;
  llmSummaryRef: RefObject<string>;
  plannerOutputRef: RefObject<string>,
  isProcessing: boolean;
  isLastMessage: boolean;
  streamSummaryRef: RefObject<boolean>;
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

  // Access the asset data from the new schema structure
  const videoUrl = scene.assetId?.url || scene.url || "";
  const thumbnailUrl = scene.assetId?.thumbnail || scene.thumbnail || "";
  const duration = scene.assetId?.duration || scene.duration || 0;

  return (
    <div className="mt-3 rounded-md overflow-hidden w-full border border-zinc-800 shadow-lg">
      {!isPlaying ? (
        <div className="relative cursor-pointer aspect-video" onClick={handlePlayClick}>
          <img
            src={thumbnailUrl}
            alt={scene.sceneName}
            className="aspect-video"
          />
          <div className="absolute inset-0 flex items-center justify-center ">
            <div className="w-10 h-10 rounded-full bg-white bg-opacity-80 flex items-center justify-center hover:bg-opacity-100 transition-all">
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
            <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
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
          className="aspect-video"
          onEnded={() => setIsPlaying(false)}
        />
      )}
      <div className="p-2 bg-zinc-800">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-200">
            {scene.sceneName}
          </p>
          <button
            onClick={handleToggleExpand}
            className="text-xs gap-2 h-5 flex items-center justify-center text-neutral-400 cursor-pointer hover:text-neutral-200 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M6 9l6 6 6-6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-neutral-400 hover:text-neutral-200">See More</p>
          </button>
        </div>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-60"
          }`}
        >
          <p className="text-xs text-neutral-400 mt-1">{scene.prompt}</p>
        </div>
      </div>
    </div>
  );
};

// Message Component
const MessageBubble = ({
  message,
  onCopy,
  llmSummaryRef,
  plannerOutputRef,
  isLastMessage,
  isProcessing,
  streamSummaryRef,
  onStreamingComplete, // New prop
}: Props & { onStreamingComplete?: () => void }) => {
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
      <div className="flex justify-end mb-4 group max-w-70">
        <div className="w-[85%] bg-zinc-800 rounded-2xl rounded-tr-sm px-4 py-3 border border-zinc-700/50 shadow-sm">
          <div className="text-sm text-neutral-200 leading-relaxed break-words font-light">
            {typeof message.content === "string" ? message.content : ""}
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-[10px] text-zinc-500 font-medium">
              {formatTimestamp(message.timestamp)}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="w-5 h-5 p-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 h-auto"
                onClick={handleCopy}
                title="Copy message"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            </div>
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
  const validScenes =
    message.scenes?.filter((scene: any) => (scene.assetId && scene.assetId.url) || scene.url) || [];

  // Guard: hide empty in-progress messages until content arrives
  const hasContent = plannerOutput || llmResponse || hasScenes || (typeof message.content === 'string' && message.content);

  if (!hasContent && isProcessing) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="group">
        <div className="min-w-0">
          {/* Planner Output */}
          {plannerOutput && (
            <div className="text-sm text-zinc-400 leading-relaxed mb-3 rounded-lg">
              {(isProcessing && plannerOutputRef.current != plannerOutput && isLastMessage) ? (
                (plannerOutputRef.current = plannerOutput) &&
                <LiveTextStream
                  text={plannerOutputRef.current}
                  streamingSpeed={50} // Faster speed for better UX
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
                <VideoPlayer key={scene.assetId?._id || index} scene={scene} />
              ))}
            </div>
          )}

          {/* Show scene count if there are scenes */}
          {hasScenes && validScenes.length > 0 && (
            <div className="text-xs text-neutral-500 mb-2">
              {validScenes.length} scene{validScenes.length !== 1 ? "s" : ""}{" "}
              generated
            </div>
          )}

          {/* LLM Response */}
          {llmResponse && (
            <div className="text-sm text-zinc-400 leading-relaxed mb-2 break-words">
              {(streamSummaryRef.current && llmSummaryRef.current != llmResponse && isLastMessage && isProcessing) ? (
                (llmSummaryRef.current = llmResponse) &&
                (isVideoUrl(llmResponse) ? (
                  // Video URL arrived live — skip typewriter, show player immediately
                  (() => { onStreamingComplete?.(); return <FinalVideoPlayer url={llmResponse} generationMs={message.generationMs} />; })()
                ) : (
                  <LiveTextStream
                    text={llmSummaryRef.current}
                    streamingSpeed={50}
                    onStreamingComplete={onStreamingComplete}
                  />
                ))
              ) : isVideoUrl(llmResponse) ? (
                // Video URL in loaded history or completed message
                <FinalVideoPlayer url={llmResponse} generationMs={message.generationMs} />
              ) : (
                <p className="break-words">{llmResponse}</p>
              )}
            </div>
          )}

          {/* String content fallback */}
          {!isContentObject && typeof message.content === "string" && (
            <div className="text-sm text-neutral-200 leading-relaxed mb-2 break-words">
              {message.content}
            </div>
          )}

          {/* Footer: timestamp only */}
          <div className="mt-3">
            <span className="text-xs text-neutral-500">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
