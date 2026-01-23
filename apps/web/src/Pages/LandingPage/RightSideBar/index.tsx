import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { socket } from "@/socket";
import api from "@/api";
import { toast } from "sonner";
import MessageInput from "./MessageInput";
import MessageBubble from "./MessageBubble";
import { messageActions, type Message, type GenerationStage } from "./types";

interface LandingRightSideBarProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  assetId?: string;
  onLimitReached?: () => void;
}

const GUEST_STORAGE_KEY = "stitcher_guest_state";

export const LandingRightSideBar = ({ 
  isOpen, 
  onClose, 
  initialPrompt,
  assetId,
  onLimitReached 
}: LandingRightSideBarProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>('idle');
  const [chatId, setChatId] = useState<string | null>(null);
  const [trialCount, setTrialCount] = useState(0);
  
  // Refs for streaming
  const plannerOutputRef = useRef("");
  const streamSummaryRef = useRef(false);
  const llmSummaryRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load state from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(GUEST_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.messages || []);
        setChatId(parsed.chatId || null);
        setTrialCount(parsed.trialCount || 0);
      } catch (e) {
        console.error("Failed to load guest state", e);
      }
    }
  }, []);

  // Save state on change
  useEffect(() => {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({
      messages,
      chatId,
      trialCount
    }));
  }, [messages, chatId, trialCount]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Initial Prompt
  const initialPromptProcessed = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptProcessed.current && !isProcessing) {
      initialPromptProcessed.current = true;
      handleNewGuestChat(initialPrompt, assetId);
    }
  }, [initialPrompt, assetId]);

  // Socket Connection
  useEffect(() => {
    if (!chatId) return;

    socket.emit('join_chat', chatId);

    const handleUpdate = (event: any) => {
        const { type, data } = event;

        if (type === 'PLANNING_START') {
             setGenerationStage('planning');
             streamSummaryRef.current = true;
             plannerOutputRef.current = "";
             llmSummaryRef.current = "";
        } else if (type === 'GENERATING_CODE_COMPLETE') {
             setGenerationStage('rendering');
             if (data.scenes) {
                 setMessages(prev => {
                     const updated = [...prev];
                     const last = updated[updated.length - 1];
                     if (last && last.role === 'assistant') {
                         updated[updated.length - 1] = { ...last, scenes: data.scenes, generatorOutput: true };
                     }
                     return updated;
                 });
             }
        } else if (type === 'RENDER_SUCCESS') {
             // Still in rendering stage
            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                    const scenes = [...last.scenes];
                    const idx = scenes.findIndex((s: any) => s.sceneName === data.sceneName);
                    if (idx !== -1) {
                        scenes[idx] = { ...scenes[idx], ...data.metadata, completed: true };
                        updated[updated.length - 1] = { ...last, scenes };
                    }
                }
                return updated;
            });
        } else if (type === 'SUMMARY_COMPLETE') {
             setMessages(prev => {
                 const updated = [...prev];
                 const last = updated[updated.length - 1];
                 if (last?.role === 'assistant') {
                     updated[updated.length - 1] = {
                         ...last,
                         content: {
                             plannerOutput: data.summary || '',
                             llmResponse: typeof last.content === 'object' ? last.content.llmResponse : ''
                         },
                         plannerOut: true
                     };
                 }
                 return updated;
             });
        } else if (type === 'GENERATION_COMPLETE') {
            setGenerationStage('complete');
             setMessages(prev => {
                 const updated = [...prev];
                 const last = updated[updated.length - 1];
                 if (last?.role === 'assistant') {
                     updated[updated.length - 1] = {
                         ...last,
                         content: {
                             plannerOutput: typeof last.content === 'object' ? last.content.plannerOutput : '',
                             llmResponse: data.summary
                         },
                         completed: true
                     };
                 }
                 return updated;
             });
             setIsProcessing(false);
             // Reset stage after a delay or keep as complete until next start
             setTimeout(() => setGenerationStage('idle'), 3000); 
             setTrialCount(prev => prev + 1); // Increment trial on completion or start? User said "use feature more than 2 times". I'll count starts.
        } else if (type === 'RENDER_ERROR' || type === 'EDITING_ERROR') {
             toast.error("An error occurred during generation.");
             setIsProcessing(false);
             setGenerationStage('idle');
        }
    };

    socket.on('chat_update', handleUpdate);
    return () => {
        socket.off('chat_update', handleUpdate);
    };
  }, [chatId]);

  const handleNewGuestChat = async (promptText: string, templateAssetId?: string) => {
      // Logic Check
      if (trialCount >= 2) {
          toast.error("Free trial limit reached. Please sign up to continue!");
          if (onLimitReached) onLimitReached();
          return; 
      }

      setMessages(prev => [...prev, messageActions.createMessage(promptText, "user")]);
      setIsProcessing(true);
      setGenerationStage('planning');

      try {
          const requestBody: any = { prompt: promptText };
          if (templateAssetId) {
              requestBody.assetId = templateAssetId;
          }
          
          const res = await api.post('/generatechat/guest', requestBody);
          
          if ((res.data as any).success) {
              const { chatId: newChatId } = (res.data as any).data;
              setChatId(newChatId); // Switch to new chat ID for socket events
              setMessages(prev => [...prev, {
                  _id: `msg_asst_${Date.now()}`,
                  role: "assistant",
                  content: { plannerOutput: "", llmResponse: "Thinking..." },
                  timestamp: new Date().toISOString(),
                  scenes: [],
                  projectDescription: "",
                  completed: false,
                  plannerOut: false,
                  generatorOutput: false
              }]);
              
              // Increment trial count on START to prevent abuse
              setTrialCount(prev => prev + 1);
          }
      } catch (err) {
          console.error(err);
          toast.error("Failed to start generation. Please try again.");
          setIsProcessing(false);
      }
  };

  const handleSubmit = () => {
      if (!input.trim() || isProcessing) return;
      const text = input.trim();
      setInput("");
      handleNewGuestChat(text);
  };

  return (
    <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-neutral-950/95 backdrop-blur-2xl border-l border-white/5 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
      
      {/* Header */}
      <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-neutral-900/30">
        <div className="flex items-center gap-2">
            <span className="text-white font-semibold tracking-tight">Stitcher AI</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">TRIAL</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/70 hover:text-white">
            <X size={20} />
        </button>
      </div>

      {/* Messages - Native Scroll */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
         <div className="flex flex-col min-h-full justify-end"> {/* Push messages to bottom if few, standard chat feel */}
             <div className="p-6 space-y-8">
                 {messages.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-20 text-center gap-4 opacity-40">
                         <div className="w-16 h-16 rounded-2xl bg-neutral-800/50 border border-white/5 animate-pulse" />
                         <p className="text-neutral-500 text-sm font-medium">Enter a prompt to start generating...</p>
                     </div>
                 )}
                 
                 {messages.map((msg, i) => (
                     <MessageBubble 
                        key={i} 
                        message={msg} 
                        isLastMessage={i === messages.length - 1}
                        isProcessing={isProcessing}
                        generationStage={generationStage}
                        llmSummaryRef={llmSummaryRef}
                        plannerOutputRef={plannerOutputRef}
                        streamSummaryRef={streamSummaryRef}
                        onCopy={() => toast.success("Copied!")}
                     />
                 ))}
                 <div ref={messagesEndRef} className="h-4" /> {/* Spacer at bottom */}
             </div>
         </div>
      </div>
         
      <MessageInput 
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        placeholder="Describe your animation..."
      />
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};
