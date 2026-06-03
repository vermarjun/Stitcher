import { useRef, useEffect, useImperativeHandle, useState } from "react";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { AlertCircle, ChevronDown, ChevronUp, Copy, Lock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { messageActions, type Message } from "./Main.rightsidebar";
import EmptyState from "./EmptyState.rightsidebar";
import MessageBubble from "./MessageBubble.rightsidebar";
import QuickPrompts from "./QuickPrompts.rightsidebar";
import MessageInput from "./MessageInput.rightsidebar";
import GenerationProgress from "./GenerationProgress.rightsidebar";
import api from "@/api";
import { toast } from "sonner";
import type { Project, IUser, Asset } from "@/State/Types";
import { useRefreshAssetStash } from "../RefreshContextProvider";
import { useRefreshHeader } from "../context";
import { socket, setActiveChat } from "@/socket";
import { trackAction } from "@/lib/analytics";

/**
 * Live pipeline progress shown as the animated step label + progress bar.
 * Mirrors the backend's GenerationJob.progress / `progress` socket event so the
 * frontend renders exactly what the pipeline reports (real, live, reload-safe).
 */
type LiveProgress = { phase: string; label: string; percent: number; ceil: number };

/**
 * Map an edit-pipeline phase (separate worker, different event vocabulary) onto
 * the same progress bar. The generate pipeline drives the bar from the backend;
 * the edit pipeline only emits coarse `edit_started` phases, so we assign
 * sensible client-side percents here.
 */
function mapEditPhase(p: string | undefined): LiveProgress {
  switch (p) {
    case "load_asset":  return { phase: "edit", label: "Loading your video…",                 percent: 8,  ceil: 18 };
    case "rag_enhance": return { phase: "edit", label: "Looking up relevant Manim examples…", percent: 22, ceil: 36 };
    case "agent_code":  return { phase: "edit", label: "Applying your edit…",                  percent: 40, ceil: 60 };
    case "render":      return { phase: "edit", label: "Rendering your animation…",            percent: 64, ceil: 88 };
    default:            return { phase: "edit", label: "Editing your video…",                  percent: 10, ceil: 20 };
  }
}

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

/** Mirror of the same helper in MessageBubble — avoids cross-file import. */
function isVideoUrl(value: string): boolean {
  if (!value) return false;
  try {
    if (!/^https?:\/\//i.test(value.trim())) return false;
    if (/res\.cloudinary\.com\/.+\/video\//i.test(value)) return true;
    const pathname = new URL(value).pathname.toLowerCase();
    if (pathname.endsWith(".mp4") || pathname.endsWith(".webm")) return true;
    return false;
  } catch {
    return false;
  }
}

/** RLHF star-rating widget shown below a completed video message. */
const StarRatingWidget = ({
  chatId,
  onRated,
}: {
  chatId: string;
  onRated: () => void;
}) => {
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [selected, setSelected] = useState(0);

  const handleClick = async (n: number) => {
    if (submitting || exiting) return;
    setSelected(n);
    setSubmitting(true);
    try {
      await api.patch(`/generatechat/${chatId}/rating`, { rating: n });
    } catch {
      // best-effort — hide widget regardless
    }
    setExiting(true);
    setTimeout(() => onRated(), 350);
  };

  const isActive = exiting || submitting;

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-out mt-2 mb-2",
        exiting ? "opacity-0 scale-95 max-h-0 -translate-y-1" : "opacity-100 max-h-24"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-zinc-400 whitespace-nowrap">How would you rate this video?</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={isActive}
              onMouseEnter={() => !isActive && setHovered(n)}
              onMouseLeave={() => !isActive && setHovered(0)}
              onClick={() => handleClick(n)}
              className="p-0.5 text-zinc-500 hover:text-yellow-400 transition-colors disabled:opacity-50"
              aria-label={`Rate ${n} star${n !== 1 ? "s" : ""}`}
            >
              <Star
                className="w-3.5 h-3.5"
                fill={hovered >= n || selected >= n ? "#facc15" : "none"}
                stroke={hovered >= n || selected >= n ? "#facc15" : "currentColor"}
              />
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-zinc-600 mt-0.5">Your rating helps improve Stitcher through our RLHF loop</p>
    </div>
  );
};

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
  onAssetDrop: _onAssetDrop,
  droppedItems: _droppedItems,
  onRemoveItem: _onRemoveItem
}: Props) => {
  const { triggerHeaderRefresh } = useRefreshHeader()
  // Viewers are read-only: they cannot spend credits / generate. Default
  // permissive when the role is unknown (older project payloads).
  const canEdit = (currentProject?.myRole ?? "owner") !== "viewer";
  const plannerOutputRef = useRef("");
  const streamSummaryRef = useRef(false);
  const llmSummaryRef = useRef("");
  const genStartRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { triggerRefresh } = useRefreshAssetStash();
  // Live pipeline progress (drives the animated step label + progress bar).
  // Sourced from the backend `progress` socket event AND the status endpoint, so
  // a page reload restores the exact phase + percent the job was on.
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  // Ref to the active resumable-poll interval so we can cancel it.
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks whether a job_complete/job_failed was received (idempotency guard).
  const jobCompletedRef = useRef(false);
  // Tracks which chatId the current poll is running for (avoids cross-chat leaks).
  const pollChatIdRef = useRef<string | null>(null);
  const resetProgress = () => setLiveProgress(null);
  // Apply a live-progress snapshot. Missing fields fall back to the previous
  // snapshot, and the percent is clamped monotonic (the debug→re-render loop
  // re-enters a lower phase floor; the bar must never jump backward). The merge
  // runs inside the functional updater so it always sees the freshest state.
  const applyLiveProgress = (p: Partial<LiveProgress> & { phase: string }) => {
    setLiveProgress((prev) => {
      const merged: LiveProgress = {
        phase: p.phase,
        label: p.label ?? prev?.label ?? "Working…",
        percent: typeof p.percent === "number" ? p.percent : prev?.percent ?? 0,
        ceil: typeof p.ceil === "number" ? p.ceil : prev?.ceil ?? 0,
      };
      if (prev && merged.percent < prev.percent) merged.percent = prev.percent;
      return merged;
    });
  };
  /** Stop the running resumable-poll interval (if any). */
  const stopPoll = () => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollChatIdRef.current = null;
  };

  /**
   * Apply a failed state to the last assistant message.
   * Shared by socket job_failed handler and poll — idempotent.
   */
  const applyFailure = (errMsg: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].role === "assistant" && !updated[lastIdx].completed) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: { plannerOutput: "", llmResponse: `error: ${errMsg}` },
          completed: true,
        };
      }
      return updated;
    });
    toast.error(`Generation failed: ${errMsg}`);
    setIsProcessing(false);
    setLiveProgress(null);
    jobCompletedRef.current = true;
    stopPoll();
  };

  /**
   * Apply a finalUrl received either from socket or poll, updating the last
   * assistant message.  Idempotent — safe to call from both paths.
   * If the message is already completed (socket beat us), this is a no-op.
   */
  const applyCompletionResult = (finalUrl: string | undefined, generationMs?: number) => {
    const ms = generationMs ?? (genStartRef.current ? Date.now() - genStartRef.current : undefined);
    setMessages((prevMessages) => {
      const updated = [...prevMessages];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
        // Don't overwrite if already completed (socket beat poll, or reload found history)
        if (updated[lastIdx].completed) return prevMessages;
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: {
            plannerOutput:
              typeof updated[lastIdx].content === "object"
                ? (updated[lastIdx].content as any)?.plannerOutput || ""
                : "",
            llmResponse: finalUrl || "Video ready.",
          },
          completed: true,
          ...(ms ? { generationMs: ms } : {}),
        };
      }
      return updated;
    });
    toast.success("Video generated!");
    // A final video URL renders as a <video> player (not streamed text), so the
    // LiveTextStream onStreamingComplete callback never fires.  Clear loading
    // state explicitly here so the spinner does not persist after completion.
    setIsProcessing(false);
    resetProgress();
    triggerRefresh();
    triggerHeaderRefresh();
    genStartRef.current = null;
    jobCompletedRef.current = true;
    stopPoll();
  };

  /**
   * Resumable safety-net poll: polls GET /generatechat/:chatId/status every 4 s
   * until a terminal status arrives.  Can be started from:
   *   • state reconciliation on load (when job is still in-flight on mount)
   *   • handleSubmit (as a fallback if socket events don't arrive)
   * Idempotent with the socket handlers — both funnel into applyCompletionResult
   * / applyFailure which guard on message.completed.
   * Stops itself on terminal status, unmount, or chat switch.
   */
  const startResumablePoll = (chatId: string) => {
    // Stop any poll running for a previous chat.
    stopPoll();
    // Reset completion flag only when starting for a new/fresh job from submit.
    // When called from reconciliation on load, we leave jobCompletedRef as-is
    // (it starts false, which is correct for an in-flight job).
    pollChatIdRef.current = chatId;

    const intervalMs = 4_000;

    const doPoll = async () => {
      // If the chat switched or job completed via socket, stop silently.
      if (pollChatIdRef.current !== chatId || jobCompletedRef.current) {
        stopPoll();
        return;
      }
      try {
        const res = await api.get<{ success: boolean; data?: { status?: string; finalUrl?: string; progress?: LiveProgress | null; startedAt?: string; completedAt?: string } }>(
          `/generatechat/${chatId}/status`
        );
        const statusData = res.data?.data;
        const status = statusData?.status;
        // Safety-net refresh of the live bar even if a socket `progress` event was
        // missed — keeps the bar advancing from the persisted snapshot.
        if (statusData?.progress && !jobCompletedRef.current) {
          applyLiveProgress(statusData.progress);
        }
        if (status === "completed" || status === "complete") {
          const startedAt = (statusData as any)?.startedAt;
          const completedAt = (statusData as any)?.completedAt;
          const serverMs = startedAt && completedAt ? new Date(completedAt).getTime() - new Date(startedAt).getTime() : undefined;
          applyCompletionResult(statusData?.finalUrl, serverMs);
        } else if (status === "failed" || status === "cancelled") {
          applyFailure(status === "cancelled" ? "cancelled" : "Generation failed.");
        }
        // queued|planning|rendering|concatenating|uploading → keep polling
      } catch {
        // Network error or 404 — keep polling silently.
      }
    };

    // Fire immediately, then every intervalMs.
    void doPoll();
    pollTimerRef.current = setInterval(() => void doPoll(), intervalMs);
  };

  useImperativeHandle(ref, () => ({
    handleNewChat: () => {},
    handleExportChat,
    getMessageCount: () => messages.length,
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup: stop poll and clear active-chat tracker when the component unmounts.
  useEffect(() => {
    return () => {
      stopPoll();
      setActiveChat(null);
      // Socket is a global singleton — do not disconnect here.
    };
  }, []);

  const handleStreamingComplete = () => {
      // Only called when final LLM response finishes streaming
      setIsProcessing(false);
      resetProgress();
      triggerRefresh();
      triggerHeaderRefresh();
  };

  // ─── State reconciliation on load / chat switch ──────────────────────────
  // Whenever a chat becomes active (mount, reload, chat switch), after history
  // is already loaded by the parent, query the backend status endpoint and
  // reconcile the UI to match the persisted job state.
  // This ensures a page reload during or after generation always shows the
  // correct state instead of a blank/loading screen.
  useEffect(() => {
    if (!currentChatId) return;

    // Stop any poll from the previous chat and reset completion flag.
    stopPoll();
    jobCompletedRef.current = false;

    let cancelled = false; // guard for async stale closure

    const reconcile = async () => {
      try {
        const res = await api.get<{
          success: boolean;
          data?: { jobId?: string; status?: string; finalUrl?: string; progress?: LiveProgress | null; sceneProgress?: unknown; startedAt?: string; completedAt?: string };
        }>(`/generatechat/${currentChatId}/status`);

        if (cancelled) return;

        const statusData = res.data?.data;
        const status = statusData?.status;

        if (!status || status === "idle" || !statusData?.jobId) {
          // No active job — nothing to reconcile.
          return;
        }

        const inFlightStatuses = ["queued", "planning", "rendering", "concatenating", "uploading"];

        if (inFlightStatuses.includes(status)) {
          // Job is still running: show the in-progress indicator and resume polling.
          // Add a placeholder assistant message only if the last message isn't already
          // an in-progress assistant message.
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && !last.completed) {
              // Already has an in-progress placeholder — keep it.
              return prev;
            }
            // Append a placeholder so the spinner renders.
            const placeholder: Message = {
              _id: `resume_${Date.now()}`,
              content: { plannerOutput: "", llmResponse: "" },
              role: "assistant",
              timestamp: new Date().toISOString(),
              scenes: [],
              projectDescription: "",
              completed: false,
              plannerOut: false,
              generatorOutput: false,
            };
            return [...prev, placeholder];
          });
          setIsProcessing(true);
          // Restore the exact phase + percent the job was on (reload-safe). Falls
          // back to a generic queued state if no snapshot exists yet.
          setLiveProgress(
            statusData.progress ?? { phase: "queued", label: "Working…", percent: 5, ceil: 12 }
          );
          // Re-join the socket room so live events resume.
          socket.emit("join_chat", currentChatId);
          setActiveChat(currentChatId);
          // Start the resumable poll as the safety net.
          startResumablePoll(currentChatId);
        } else if (status === "complete" || status === "completed") {
          // Job already finished: ensure the last assistant message shows the video.
          // History from the parent usually already has it; this is a defensive patch.
          if (statusData.finalUrl) {
            const reconcileStartedAt = statusData.startedAt;
            const reconcileCompletedAt = statusData.completedAt;
            const reconcileMs = reconcileStartedAt && reconcileCompletedAt
              ? new Date(reconcileCompletedAt).getTime() - new Date(reconcileStartedAt).getTime()
              : undefined;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant" && !updated[lastIdx].completed) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: {
                    plannerOutput:
                      typeof updated[lastIdx].content === "object"
                        ? (updated[lastIdx].content as any)?.plannerOutput || ""
                        : "",
                    llmResponse: statusData.finalUrl!,
                  },
                  completed: true,
                  ...(reconcileMs ? { generationMs: reconcileMs } : {}),
                };
              }
              return updated;
            });
          }
          setIsProcessing(false);
          jobCompletedRef.current = true;
        } else if (status === "failed" || status === "cancelled") {
          // Job ended in failure.
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant" && !updated[lastIdx].completed) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: { plannerOutput: "", llmResponse: `error: Generation ${status}.` },
                completed: true,
              };
            }
            return updated;
          });
          setIsProcessing(false);
          jobCompletedRef.current = true;
        }
      } catch {
        // Status endpoint unavailable (e.g. no job ever created) — ignore silently.
      }
    };

    void reconcile();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatId]);

  // ─── Socket Event Listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentChatId) return;

    // Join the chat room and register as the active chat for reconnect re-join.
    socket.emit('join_chat', currentChatId);
    setActiveChat(currentChatId);

  const handleUpdate = (event: any) => {
    const { type, phase, data } = event ?? {};

    // ─── Live pipeline progress (the REAL backend phase) ───────────────
    // Emitted by the worker at every transition: queued → rag → code →
    // voiceover → render → debug → upload. Carries { phase, label, percent,
    // ceil } straight from the canonical PIPELINE_PHASES map, so the frontend
    // just renders what it's told.
    if (type === "progress") {
      const d = (data ?? {}) as Partial<LiveProgress>;
      applyLiveProgress({
        phase: d.phase ?? (typeof phase === "string" ? phase : "queued"),
        label: d.label,
        percent: d.percent,
        ceil: d.ceil,
      });
      return;
    }

    if (type === "job_complete") {
      const finalUrl: string | undefined = data?.finalUrl ?? data?.cloudinaryUrl;
      // Funnel into shared idempotent handler (clears loading, stops poll, etc.)
      applyCompletionResult(finalUrl);
      return;
    }

    if (type === "job_failed") {
      const err = data?.error ?? "unknown error";
      applyFailure(String(err));
      return;
    }

    // ─── Edit-flow events (separate worker, mapped onto the same bar) ──
    if (type === "edit_started") {
      applyLiveProgress(mapEditPhase(typeof phase === "string" ? phase : undefined));
      return;
    }
    if (type === "edit_render_complete") {
      applyLiveProgress({ phase: "edit", label: "Rendering your animation…", percent: 80, ceil: 95 });
      return;
    }
    if (type === "edit_complete") {
      const finalUrl: string | undefined = data?.url ?? data?.finalUrl ?? data?.newAssetUrl;
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
      setIsProcessing(false);
      setLiveProgress(null);
      return;
    }
    if (type === "edit_failed") {
      const err = data?.error ?? "unknown error";
      toast.error(`Edit failed: ${err}`);
      setIsProcessing(false);
      setLiveProgress(null);
      return;
    }

    // Legacy generation events (planning / plan_complete / scene_* /
    // concat_started / job_queued) are superseded by `progress` — safely ignored.
  };

    socket.on('chat_update', handleUpdate);

    return () => {
      socket.off('chat_update', handleUpdate);
      // On chat switch, stop any poll running for the outgoing chat and clear
      // the active-chat tracker so reconnect doesn't re-join a stale room.
      stopPoll();
      setActiveChat(null);
    };
  }, [currentChatId, triggerRefresh]);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;
    if (!canEdit) {
      toast.error("You have viewer-only access to this project.");
      return;
    }
    triggerHeaderRefresh();

    const userMessage = messageActions.createMessage(input.trim(), "user");
    setMessages((prev: Message[]) => [...prev, userMessage]);

    const userInput = input.trim();
    setInput("");
    setIsProcessing(true);
    genStartRef.current = Date.now();
    // Key conversion event: a user submitted a generation prompt.
    trackAction("generate_submit", { isNewChat: !currentChatId });
    // Reset any streaming refs from a prior generation in this chat.
    streamSummaryRef.current = true;
    plannerOutputRef.current = "";
    llmSummaryRef.current = "";
    // Immediate feedback before the first socket event lands.
    setLiveProgress({ phase: "submitting", label: "Submitting your prompt…", percent: 3, ceil: 10 });

    try {
      const requestData = {
        projectId: currentProject?._id,
        prompt: userInput,
        userId: user?._id,
        assetId: [],
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

        // Socket connection in useEffect will handle live progress updates.
        socket.emit('join_chat', chatIdToUse);
        setActiveChat(chatIdToUse);

        // Start the resumable safety-net poll. It cancels itself when socket
        // delivers job_complete / job_failed first (idempotency guard).
        jobCompletedRef.current = false;
        startResumablePoll(chatIdToUse);
      } else {
        toast.error((response.data as any).message);
        throw new Error((response.data as any).message);
      }
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);

      // Out-of-credits (402): point the user at BYOT — they can add their own
      // API keys in Settings to keep generating at no cost once credits run out.
      if (error?.response?.status === 402) {
        toast.error("Out of credits — add your own API keys in Settings to keep generating.");
      }

      const errorMessage = messageActions.createMessage(
        `error:${JSON.stringify(errorDetails)}`,
        "assistant"
      );
      setMessages((prev: Message[]) => [...prev, errorMessage]);
      setIsProcessing(false);
      setLiveProgress(null);
    }
  };

  const handleCancelGeneration = async () => {
    if (!currentChatId || !isProcessing) return;

    try {
      const response = await api.post(`/generatechat/cancel/${currentChatId}`);

      if ((response.data as any).success) {
        toast.success("Generation cancelled");
        jobCompletedRef.current = true;
        stopPoll();
        setIsProcessing(false);
        setLiveProgress(null);

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

  // Read-only bar shown in place of the message input for viewers.
  const ViewerLockedBar = () => (
    <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400">
      <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
      <span>
        You have <span className="text-amber-300 font-medium">viewer-only</span> access — AI generation is disabled.
      </span>
    </div>
  );

  // The input bar: the real composer for editors/owners, a disabled notice for viewers.
  const inputBar = canEdit ? (
    <MessageInput
      input={input}
      setInput={setInput}
      onSubmit={handleSubmit}
      isProcessing={isProcessing}
      placeholder={getPlaceholder()}
      onCancel={handleCancelGeneration}
    />
  ) : (
    <ViewerLockedBar />
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {messages.length === 0 ? (
        <>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <EmptyState mode="generate" onPromptSelect={handlePromptSelect} />
            <QuickPrompts mode="generate" onPromptSelect={handlePromptSelect} />
          </div>
          {inputBar}
        </>
      ) : (
        <>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 space-y-4 pt-4">
              {messages.map((message, index) => {
                // Hide the empty in-progress assistant placeholder for the whole
                // generation; the live GenerationProgress indicator stands in for it.
                const isLastMessage = index === messages.length - 1;
                const isAssistantProcessing =
                  isLastMessage &&
                  message.role === "assistant" &&
                  isProcessing &&
                  !message.completed;

                if (isAssistantProcessing) {
                  return null;
                }

                // Determine whether to show the RLHF star-rating widget.
                // Conditions: last message, assistant, completed, video URL, not yet rated, not currently processing.
                const llmResp =
                  typeof message.content === "object" && message.content !== null
                    ? (message.content as { plannerOutput: string; llmResponse: string }).llmResponse
                    : "";
                const showRating =
                  isLastMessage &&
                  message.role === "assistant" &&
                  message.completed &&
                  isVideoUrl(llmResp) &&
                  !message.rating &&
                  !isProcessing &&
                  !!currentChatId;

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
                        projectId={currentProject?._id}
                      />
                    )}
                    {showRating && (
                      <StarRatingWidget
                        chatId={currentChatId!}
                        onRated={() =>
                          setMessages((prev) => {
                            const updated = [...prev];
                            updated[index] = { ...updated[index], rating: -1 }; // -1 = rated, hides widget
                            return updated;
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}

              {isProcessing && (
                <GenerationProgress
                  label={liveProgress?.label ?? "Submitting your prompt…"}
                  percent={liveProgress?.percent ?? 3}
                  ceil={liveProgress?.ceil ?? 10}
                  phase={liveProgress?.phase ?? "submitting"}
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {inputBar}
        </>
      )}
    </div>
  );
};

export default GenerateComponent;