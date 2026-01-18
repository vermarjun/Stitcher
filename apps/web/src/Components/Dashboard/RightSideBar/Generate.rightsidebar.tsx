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
    "generating" | "planning" | "generating-scenes" | null
  >(null);
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
    const { type, data } = event;

    if (type === 'PLANNING_START' || type === 'EDITING_START') {
         setPollingStatus("planning");
         streamSummaryRef.current = true; // Enable streaming for this session
         // Reset refs for new generation
         plannerOutputRef.current = "";
         llmSummaryRef.current = "";
    } else if (type === 'PLANNING_COMPLETE') {
         setPollingStatus("generating");
         // Optional: update message content with "Planned X scenes"
    } else if (type === 'GENERATING_CODE_START' || type === 'EDITING_CODE_START') {
         setPollingStatus("generating");
    } else if (type === 'GENERATING_CODE_COMPLETE' || type === 'EDITING_CODE_COMPLETE') {
         setPollingStatus("generating-scenes");
         // Update scenes in the last assistant message
         if (data.scenes && Array.isArray(data.scenes)) {
             setMessages((prevMessages) => {
                const updated = [...prevMessages];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    // Map structure if needed, or assume cleaner contract
                    updated[lastIdx] = {
                        ...updated[lastIdx],
                        scenes: data.scenes,
                        generatorOutput: true,
                        plannerOut: true
                    };
                }
                return updated;
             });
         } else if (data.sceneName) {
             // For edit flow, create a single scene entry
             setMessages((prevMessages) => {
                const updated = [...prevMessages];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                        ...updated[lastIdx],
                        scenes: [{
                            sceneName: data.sceneName,
                            prompt: "",
                            summary: "",
                            code: "",
                            assetId: null,
                            error: null
                        }],
                        generatorOutput: true,
                        plannerOut: true
                    };
                }
                return updated;
             });
         }
    } else if (type === 'ENQUEUED_FOR_RENDERING') {
         setPollingStatus("generating-scenes");
    } else if (type === 'RENDER_SUCCESS') {
         // Update specific scene
         setMessages((prevMessages) => {
            const updated = [...prevMessages];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                const currentScenes = updated[lastIdx].scenes || [];
                const sceneIdx = currentScenes.findIndex((s: any) => s.sceneName === data.sceneName);
                
                if (sceneIdx !== -1) {
                     const updatedScenes = [...currentScenes];
                     updatedScenes[sceneIdx] = { 
                         ...updatedScenes[sceneIdx], 
                         ...data.metadata,
                         completed: true 
                     };
                     
                     updated[lastIdx] = {
                        ...updated[lastIdx],
                        scenes: updatedScenes,
                        // Do NOT mark entire message as completed yet, wait for final summary
                     };
                }
            }
            return updated;
         });
    } else if (type === "RENDER_ERROR") {
         toast.error(`Error rendering ${data.sceneName}: ${data.error}`);
    } else if (type === 'SUMMARY_COMPLETE') {
         // Planner summary is ready - Update full text and let LiveTextStream animate it
         setMessages((prevMessages) => {
             const updated = [...prevMessages];
             const lastIdx = updated.length - 1;
             
             if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                 updated[lastIdx] = {
                     ...updated[lastIdx],
                     content: {
                         plannerOutput: data.summary || '', // Set FULL text
                         llmResponse: typeof updated[lastIdx].content === 'object'
                             ? updated[lastIdx].content?.llmResponse || ''
                             : ''
                     },
                     plannerOut: true
                 };
             }
             return updated;
         });
         
         // Update status to show code generation is starting
         setPollingStatus("generating");
    } else if (type === 'GENERATION_COMPLETE' || type === 'EDITING_COMPLETE') {
         // KEEP isProcessing = true to continue showing progress bar until streaming finishes
         // setPollingStatus(null); // Don't nullify yet
         
         // Update last assistant message with final summary
         setMessages((prevMessages) => {
             const updated = [...prevMessages];
             const lastIdx = updated.length - 1;
             
             if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                 updated[lastIdx] = {
                     ...updated[lastIdx],
                     content: {
                         plannerOutput: typeof updated[lastIdx].content === 'object' 
                             ? updated[lastIdx].content?.plannerOutput || '' 
                             : '',
                         llmResponse: data.summary // Set FULL text, LiveTextStream will animate
                     },
                     completed: true
                 };
             }
             
             return updated;
         });
         
         // Show success toast
         const successMessage = type === 'EDITING_COMPLETE' 
             ? 'Video edited successfully!' 
             : `Video generated! ${data.scenesCompleted}/${data.totalScenes} scenes completed`;
         toast.success(successMessage);
    } else if (type === 'EDITING_ERROR') {
         // Handle editing errors
         toast.error(`Editing error: ${data.error || data.message}`);
         setMessages((prevMessages) => {
             const updated = [...prevMessages];
             const lastIdx = updated.length - 1;
             
             if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                 updated[lastIdx] = {
                     ...updated[lastIdx],
                     content: {
                         plannerOutput: '',
                         llmResponse: data.message || `Error: ${data.error}`
                     },
                     completed: true
                 };
             }
             
             return updated;
         });
         setIsProcessing(false);
         setPollingStatus(null);
    }
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
    // processing request, means backend + MS ko request send ho rahi hai
    setPollingStatus("generating");

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

  // Get loading text and progress based on polling status
  const getLoadingStatus = () => {
    switch (pollingStatus) {
      // Scene 1 => MS plans each scene
      case "planning":
        return { text: "Planning...", progress: 25 };
      // Scene 2 => MS generates code for each scene
      case "generating":
        return { text: "Generating...", progress: 10 };
      // Scene 3 => MS renders each generated code
      case "generating-scenes":
        return { text: "Rendering...", progress: 60 };
      default:
        return { text: "Processing...", progress: 0 };
    }
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
                  getLoadingStatus().text === "Planning...";

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
                <div className="flex items-center w-full gap-3 text-sm">
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
                    <div className="w-full bg-zinc-700 rounded-full h-1.5 relative overflow-hidden">
                      {/* Main Progress Bar */}
                      <div
                        className="bg-white h-1.5 rounded-full transition-all duration-300 ease-in-out absolute top-0 left-0 z-10"
                        style={{ width: `${getLoadingStatus().progress}%` }}
                      ></div>

                      {/* Moving Shimmer Effect */}
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
