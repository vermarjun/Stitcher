import { useRef, useEffect, useImperativeHandle, useState } from "react";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { AlertCircle, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { messageActions, type Message } from "./Main.rightsidebar";
import EmptyState from "./EmptyState.rightsidebar";
import MessageBubble from "./MessageBubble.rightsidebar";
import QuickPrompts from "./QuickPrompts.rightsidebar";
import MessageInput from "./MessageInput.rightsidebar";
import api from "@/api";
import { toast } from "sonner";
import type { Project, IUser, Asset } from "@/State/Types";
import { useRefreshAssetStash } from "../RefreshContextProvider";
import { useRefreshHeader } from "../context";
import { socket } from "@/socket";

interface Props {
  currentProject?: Project;
  user?: IUser;
  ref: any;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  onAssetDrop?: (asset: any) => void; 
  droppedItems?: Asset[];
  onRemoveItem?: (id: string) => void;
}

// Helper function to format error messages
const formatErrorMessage = (error: any): string => {
  if (!error) return "Unknown error occurred";

  if (error?.response?.status === 429) {
    const errorData = error.response.data;
    if (errorData?.error?.message) {
      return errorData.error.message;
    }
  }

  if (error?.response?.data?.message) {
    return error.response?.data.message;
  }

  if (error?.message) {
    return error.message;
  }

  return "An unexpected error occurred";
};

// Helper function to extract error details for display
const getErrorDetails = (error: any) => {
  if (error?.response?.status === 429) {
    const errorData = error.response.data;
    const metadata = errorData?.error?.metadata;

    return {
      title: "Rate Limit Exceeded",
      message: errorData?.error?.message || "Too many requests",
      code: 429,
      details: metadata
        ? {
            limit: metadata.headers?.["X-RateLimit-Limit"],
            remaining: metadata.headers?.["X-RateLimit-Remaining"],
            reset: metadata.headers?.["X-RateLimit-Reset"]
              ? new Date(
                  parseInt(metadata.headers["X-RateLimit-Reset"])
                ).toLocaleString()
              : null,
          }
        : null,
      rawError: error,
    };
  }

  return {
    title: "Request Failed",
    message: formatErrorMessage(error),
    code: error?.response?.status || "Unknown",
    details: null,
    rawError: error,
  };
};

// Generate Component
const GenerateComponent = ({
  currentProject,
  user,
  ref,
  messages,
  setMessages,
  input,
  setInput,
  isProcessing,
  setIsProcessing,
  currentChatId,
  setCurrentChatId,
  onAssetDrop, 
  droppedItems, 
  onRemoveItem
}: Props) => {
  const { triggerHeaderRefresh } = useRefreshHeader()
  const plannerOutputRef = useRef("");
  const streamSummaryRef = useRef(false);
  const llmSummaryRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { triggerRefresh } = useRefreshAssetStash();
  // Socket-based status management instead of polling
  const [pollingStatus, setPollingStatus] = useState<
    "generating" | "planning" | "generating-scenes" | "concat" | null
  >(null);
  // Rich live progress: stable log of step events shown beneath the spinner.
  type ProgressStep = {
    id: string;
    label: string;
    state: "active" | "done" | "failed";
  };
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [totalScenes, setTotalScenes] = useState<number | null>(null);
  const [completedScenes, setCompletedScenes] = useState<number>(0);

  const resetProgress = () => {
    setProgressSteps([]);
    setTotalScenes(null);
    setCompletedScenes(0);
  };
  // Insert / promote / fail steps without producing duplicates.
  const upsertStep = (id: string, label: string, state: ProgressStep["state"]) => {
    setProgressSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return [...prev, { id, label, state }];
      const next = [...prev];
      next[idx] = { id, label, state };
      return next;
    });
  };
  useImperativeHandle(ref, () => ({
    handleNewChat: () => {},
    handleExportChat,
    getMessageCount: () => messages.length,
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
       socket.disconnect();
       socket.connect(); // Reconnect fresh on remount if needed, or just let autoConnect handle it.
       // Actually typically we don't disconnect on component unmount if socket is global, 
       // but we might want to leave the room?
       // For now, no explicit cleanup needed for global socket except listeners.
    };
  }, []);

  const handleStreamingComplete = () => {
      // Only called when final LLM response finishes streaming
      console.log("Streaming complete - removing progress bar"); // Log to verify
      setPollingStatus(null);
      setIsProcessing(false);
      resetProgress();
      triggerRefresh();
      triggerHeaderRefresh();
  };

  // Socket Event Listeners
  useEffect(() => {
    if (!currentChatId) return;

    // Join the chat room
    socket.emit('join_chat', currentChatId);

  const handleUpdate = (event: any) => {
    console.log("Socket Event:", event);
    const { type, phase, data } = event ?? {};

    // ─── Backend event vocabulary (eventPublisher.util.ts) ─────────────
    //   planning            (phase: rag_enhance | agent_plan)
    //   plan_complete       (data: { sceneCount })
    //   scene_started       (data: { index })
    //   scene_code_complete (data: { index, sceneClass })
    //   scene_render_complete (data: { index, url, attempt })
    //   scene_failed        (data: { index, error })
    //   concat_started
    //   job_complete        (data: result with finalUrl)
    //   job_failed          (data: { error, retryable, jobId })
    //   edit_started, edit_render_complete, edit_complete, edit_failed
    // ───────────────────────────────────────────────────────────────────

    if (type === "planning") {
      setPollingStatus("planning");
      streamSummaryRef.current = true;
      plannerOutputRef.current = "";
      llmSummaryRef.current = "";
      if (phase === "rag_enhance") {
        upsertStep("rag", "Looking up relevant Manim examples…", "active");
      } else if (phase === "agent_plan") {
        upsertStep("rag", "Looked up relevant Manim examples", "done");
        upsertStep("plan", "Planning scenes…", "active");
      } else {
        upsertStep("plan", "Planning scenes…", "active");
      }
      return;
    }

    if (type === "plan_complete") {
      const n = data?.sceneCount ?? 0;
      setTotalScenes(n);
      setPollingStatus("generating");
      upsertStep("plan", `Planned ${n} scene${n === 1 ? "" : "s"}`, "done");
      return;
    }

    if (type === "scene_started") {
      const i = (data?.index ?? 0) as number;
      const total = totalScenes ?? "?";
      setPollingStatus("generating-scenes");
      upsertStep(`scene-${i}`, `Scene ${i + 1}/${total}: writing code…`, "active");
      return;
    }

    if (type === "scene_code_complete") {
      const i = (data?.index ?? 0) as number;
      const total = totalScenes ?? "?";
      upsertStep(`scene-${i}`, `Scene ${i + 1}/${total}: code ready, rendering…`, "active");
      return;
    }

    if (type === "scene_render_complete") {
      const i = (data?.index ?? 0) as number;
      const total = totalScenes ?? "?";
      setCompletedScenes((c) => c + 1);
      upsertStep(`scene-${i}`, `Scene ${i + 1}/${total}: rendered ✓`, "done");
      return;
    }

    if (type === "scene_failed") {
      const i = (data?.index ?? 0) as number;
      const total = totalScenes ?? "?";
      const err = data?.error ?? "unknown error";
      upsertStep(`scene-${i}`, `Scene ${i + 1}/${total}: failed — ${err}`, "failed");
      toast.error(`Scene ${i + 1} failed: ${err}`);
      return;
    }

    if (type === "concat_started") {
      setPollingStatus("concat");
      upsertStep("concat", "Stitching scenes together…", "active");
      return;
    }

    if (type === "job_complete") {
      upsertStep("concat", "Stitched final video", "done");
      upsertStep("done", "Generation complete ✓", "done");

      const finalUrl: string | undefined = data?.finalUrl ?? data?.cloudinaryUrl;
      setMessages((prevMessages) => {
        const updated = [...prevMessages];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: {
              plannerOutput:
                typeof updated[lastIdx].content === "object"
                  ? updated[lastIdx].content?.plannerOutput || ""
                  : "",
              llmResponse: finalUrl || "Video ready.",
            },
            completed: true,
          };
        }
        return updated;
      });
      toast.success(
        totalScenes
          ? `Video generated! ${completedScenes + 1}/${totalScenes} scenes`
          : "Video generated!"
      );
      // The progress UI clears via handleStreamingComplete after LiveTextStream
      // finishes typing the final URL.
      return;
    }

    if (type === "job_failed") {
      const err = data?.error ?? "unknown error";
      upsertStep("failed", `Generation failed: ${err}`, "failed");
      toast.error(`Generation failed: ${err}`);
      setMessages((prevMessages) => {
        const updated = [...prevMessages];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: {
              plannerOutput: "",
              llmResponse: `error: ${err}`,
            },
            completed: true,
          };
        }
        return updated;
      });
      setIsProcessing(false);
      setPollingStatus(null);
      return;
    }

    // ─── Edit-flow events (different vocabulary on backend) ────────────
    if (type === "edit_started") {
      setPollingStatus("planning");
      upsertStep("edit", "Editing video…", "active");
      return;
    }
    if (type === "edit_render_complete") {
      upsertStep("edit", "Re-rendered ✓", "done");
      return;
    }
    if (type === "edit_complete") {
      upsertStep("edit", "Edit complete ✓", "done");
      const finalUrl: string | undefined = data?.url ?? data?.finalUrl;
      setMessages((prevMessages) => {
        const updated = [...prevMessages];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: {
              plannerOutput:
                typeof updated[lastIdx].content === "object"
                  ? updated[lastIdx].content?.plannerOutput || ""
                  : "",
              llmResponse: finalUrl || "Edit applied.",
            },
            completed: true,
          };
        }
        return updated;
      });
      toast.success("Video edited successfully!");
      return;
    }
    if (type === "edit_failed") {
      const err = data?.error ?? "unknown error";
      upsertStep("edit", `Edit failed: ${err}`, "failed");
      toast.error(`Edit failed: ${err}`);
      setIsProcessing(false);
      setPollingStatus(null);
      return;
    }

    // Unknown event — log so we don't drop it silently.
    console.warn("[chat_update] unhandled event type:", type, event);
  };

    socket.on('chat_update', handleUpdate);

    return () => {
        socket.off('chat_update', handleUpdate);
        
        // Clear cleanup if needed (refs are handled by React)
    };
  }, [currentChatId, triggerRefresh]);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;
    triggerHeaderRefresh();

    const userMessage = messageActions.createMessage(input.trim(), "user");
    setMessages((prev: Message[]) => [...prev, userMessage]);

    const userInput = input.trim();
    setInput("");
    setIsProcessing(true);
    // processing request — show immediate feedback before first socket event lands
    setPollingStatus("planning");
    resetProgress();
    upsertStep("submit", "Submitting prompt…", "active");

    const assetsAttached = [];
    for (const asset of droppedItems || []){
      assetsAttached.push(asset._id)
    }

    try {
      const requestData = {
        projectId: currentProject?._id,
        prompt: userInput,
        userId: user?._id,
        assetId: assetsAttached,
        ...(currentChatId && { chatId: currentChatId }),
      };

      const response = await api.post(`/generatechat/`, requestData);

      if ((response.data as any).success) {
        const chatData = (response.data as any).data;

        // Update current chat ID if it's a new chat
        const chatIdToUse = currentChatId || chatData.chatId;
        if (!currentChatId && chatData.chatId) {
          setCurrentChatId(chatData.chatId);
        }

        // Add a placeholder assistant message
        const placeholderMessage: Message = {
          _id: `msg_${Date.now()}`,
          content: {
            plannerOutput: "",
            llmResponse: "",
          },
          role: "assistant",
          timestamp: new Date().toISOString(),
          scenes: [],
          projectDescription: "",
          completed: false,
          plannerOut: false,
          generatorOutput: false,
        };

        setMessages((prev: Message[]) => [...prev, placeholderMessage]);

        // Change status to planning. Socket connection in useEffect will handle updates
        setPollingStatus("planning");
        socket.emit('join_chat', chatIdToUse);
      } else {
        toast.error((response.data as any).message);
        throw new Error((response.data as any).message);
      }
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);

      const errorMessage = messageActions.createMessage(
        `error:${JSON.stringify(errorDetails)}`,
        "assistant"
      );
      setMessages((prev: Message[]) => [...prev, errorMessage]);
      setIsProcessing(false);
      setPollingStatus(null);
    }
  };

  const handleCancelGeneration = async () => {
    if (!currentChatId || !isProcessing) return;

    try {
      const response = await api.post(`/generatechat/cancel/${currentChatId}`);

      if ((response.data as any).success) {
        toast.success("Generation cancelled");
        setIsProcessing(false);
        setPollingStatus(null);

        // Update the last message to show it was cancelled
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastMessageIndex = updatedMessages.length - 1;

          if (
            lastMessageIndex >= 0 &&
            updatedMessages[lastMessageIndex].role === "assistant"
          ) {
            updatedMessages[lastMessageIndex] = {
              ...updatedMessages[lastMessageIndex],
              content: {
                plannerOutput: "",
                llmResponse: "Generation was cancelled by user.",
              },
              completed: true,
            };
          }

          return updatedMessages;
        });
      } else {
        toast.error("Failed to cancel generation");
      }
    } catch (error: any) {
      console.error("Cancel generation error:", error);
      toast.error("Failed to cancel generation");
    }
  };

  const handleExportChat = () => {
    const chatData = {
      mode: "generate",
      timestamp: new Date().toISOString(),
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        scenes: msg.scenes,
        completed: msg.completed,
        plannerOut: msg.plannerOut,
        generatorOutput: msg.generatorOutput,
      })),
      chatId: currentChatId,
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-chat-generate-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
  };

  const handleCopy = (_content: string) => {};

  const getPlaceholder = () => {
    return "Describe the animation...";
  };

  // Custom error message component
  const ErrorMessageBubble = ({ message }: { message: Message }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    try {
      const errorData = JSON.parse(
        (message.content as string).replace("error:", "")
      );

      const handleCopyError = () => {
        const errorText = JSON.stringify(
          errorData.rawError || errorData,
          null,
          2
        );
        navigator.clipboard.writeText(errorText);
        toast.success("Error details copied to clipboard");
      };

      return (
        <div className="flex gap-3 text-sm break-words max-w-70">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 break-words">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-red-400 break-words">
                      {errorData.title}
                    </div>
                  </div>
                </div>

                <div className="text-zinc-300 text-xs break-words">
                  {errorData.message}
                </div>

                {errorData.details && (
                  <div className="text-[10px] text-zinc-400 space-y-1 pt-2 border-t border-red-500/20">
                    {errorData.details.limit && (
                      <div className="flex justify-between">
                        <span>Limit:</span>
                        <span className="text-zinc-300">
                          {errorData.details.limit} requests
                        </span>
                      </div>
                    )}
                    {errorData.details.remaining && (
                      <div className="flex justify-between">
                        <span>Remaining:</span>
                        <span className="text-zinc-300">
                          {errorData.details.remaining}
                        </span>
                      </div>
                    )}
                    {errorData.details.reset && (
                      <div className="flex justify-between">
                        <span>Resets:</span>
                        <span className="text-zinc-300">
                          {errorData.details.reset}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {isExpanded && errorData.rawError && (
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-zinc-400 font-medium">
                        Full Error Details:
                      </span>
                      <button
                        onClick={handleCopyError}
                        className="text-[10px] text-zinc-400 hover:text-zinc-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    <pre className="text-[10px] text-zinc-400 bg-black/30 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                      {JSON.stringify(errorData.rawError, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-red-500/20">
                  <span className="text-[10px] text-zinc-500">
                    Error {errorData.code} •{" "}
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        More
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } catch {
      return (
        <MessageBubble
          message={message}
          onCopy={handleCopy}
          plannerOutputRef={plannerOutputRef}
          isLastMessage={false}
          llmSummaryRef={llmSummaryRef}
          isProcessing={isProcessing}
          streamSummaryRef={streamSummaryRef}
        />
      );
    }
  };

  // Headline + percent for the spinner bar. The detailed per-step log
  // below the bar comes from `progressSteps`.
  const getLoadingStatus = () => {
    // Compute a smooth percent from real progress when we have scene info.
    const stagePct = {
      planning: 15,
      generating: 30,
      "generating-scenes": 50,
      concat: 90,
    } as const;

    let progress: number = (pollingStatus && stagePct[pollingStatus]) ?? 0;
    let text = "Processing…";

    switch (pollingStatus) {
      case "planning":
        text = "Planning…";
        break;
      case "generating":
        text = totalScenes
          ? `Generating code (${completedScenes}/${totalScenes})…`
          : "Generating code…";
        break;
      case "generating-scenes":
        text = totalScenes
          ? `Rendering scenes (${completedScenes}/${totalScenes})…`
          : "Rendering scenes…";
        if (totalScenes && totalScenes > 0) {
          // 30 → 90 across all scenes.
          progress = 30 + Math.floor((completedScenes / totalScenes) * 60);
        }
        break;
      case "concat":
        text = "Stitching final video…";
        break;
    }
    return { text, progress };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {messages.length === 0 ? (
        <>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <EmptyState mode="generate" onPromptSelect={handlePromptSelect} />
            <QuickPrompts mode="generate" onPromptSelect={handlePromptSelect} />
          </div>
          <MessageInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isProcessing={isProcessing}
            placeholder={getPlaceholder()}
            onCancel={handleCancelGeneration}
            onAssetDrop={onAssetDrop}
            droppedItems={droppedItems}
            onRemoveItem={onRemoveItem}
          />
        </>
      ) : (
        <>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 space-y-4 pt-4">
              {messages.map((message, index) => {
                // Skip the last assistant message if it's being processed
                const isLastMessage = index === messages.length - 1;
                const isAssistantProcessing =
                  isLastMessage &&
                  message.role === "assistant" &&
                  isProcessing &&
                  pollingStatus === "planning";

                if (isAssistantProcessing) {
                  return null; // Don't render the last assistant message while processing
                }

                return (
                  <div key={message._id || index} className="break-words">
                    {typeof message.content === "string" &&
                    message.content.startsWith("error:") &&
                    message.role === "assistant" ? (
                      <ErrorMessageBubble message={message} />
                    ) : (
                      <MessageBubble
                        message={message}
                        onCopy={handleCopy}
                        streamSummaryRef={streamSummaryRef}
                        plannerOutputRef={plannerOutputRef}
                        isLastMessage={isLastMessage}
                        llmSummaryRef={llmSummaryRef}
                        isProcessing={isProcessing}
                        onStreamingComplete={handleStreamingComplete}
                      />
                    )}
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex w-full gap-3 text-sm">
                  <div className="flex-shrink-0">
                    <img
                      src="https://res.cloudinary.com/dloh4tkp5/image/upload/v1760610643/loading_animation_phpia7.gif"
                      alt="Loading..."
                      className="w-14 h-14 rounded-full"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-xs text-zinc-200 animate-pulse mb-2">
                      {getLoadingStatus().text}
                    </span>

                    {/* Enhanced Progress Bar */}
                    <div className="w-full bg-zinc-700 rounded-full h-1.5 relative overflow-hidden mb-3">
                      <div
                        className="bg-white h-1.5 rounded-full transition-all duration-300 ease-in-out absolute top-0 left-0 z-10"
                        style={{ width: `${getLoadingStatus().progress}%` }}
                      ></div>
                      <div
                        className="h-1.5 rounded-full absolute top-0 left-0 animate-pulse"
                        style={{
                          width: `${Math.min(
                            getLoadingStatus().progress + 20,
                            100
                          )}%`,
                          background:
                            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.3) 75%, transparent 100%)",
                          animation: "shimmer 2s infinite",
                        }}
                      ></div>
                    </div>

                    {/* Step-by-step live log driven by Socket.IO chat_update events */}
                    {progressSteps.length > 0 && (
                      <ul className="space-y-1 text-xs text-zinc-400">
                        {progressSteps.map((s) => (
                          <li key={s.id} className="flex items-center gap-2">
                            <span
                              className={
                                s.state === "done"
                                  ? "text-emerald-400"
                                  : s.state === "failed"
                                  ? "text-rose-400"
                                  : "text-zinc-300 animate-pulse"
                              }
                              aria-hidden
                            >
                              {s.state === "done"
                                ? "✓"
                                : s.state === "failed"
                                ? "✗"
                                : "•"}
                            </span>
                            <span
                              className={
                                s.state === "failed"
                                  ? "text-rose-300"
                                  : s.state === "done"
                                  ? "text-zinc-300"
                                  : "text-zinc-200"
                              }
                            >
                              {s.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <MessageInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isProcessing={isProcessing}
            placeholder={getPlaceholder()}
            onCancel={handleCancelGeneration}
            onAssetDrop={onAssetDrop}
            droppedItems={droppedItems}
            onRemoveItem={onRemoveItem}
          />
        </>
      )}
    </div>
  );
};

export default GenerateComponent;