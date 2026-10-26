import { useRef, useEffect, useImperativeHandle, useState } from 'react';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { Bot, Film, X } from 'lucide-react';
import { messageActions, type Message } from './Main.rightsidebar';
import EmptyState from './EmptyState.rightsidebar';
import MessageBubble from './MessageBubble.rightsidebar';
import QuickPrompts from './QuickPrompts.rightsidebar';
import MessageInput from './MessageInput.rightsidebar';
import api from '@/api';
import { toast } from 'sonner';
import type { Project, Asset } from '@/State/Types';
import { useRefreshAssetStash, useRefreshTimeline } from '../RefreshContextProvider';
import { socket, setActiveChat } from '@/socket';

interface Props {
  ref: any;
  currentProject?: Project;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  onAssetDrop?: (asset: Asset) => void;
  droppedItems?: Asset[];
  onRemoveItem?: (id: string) => void;
}

type EditStatus = 'queued' | 'editing' | 'rendering' | null;

const STATUS_TEXT: Record<Exclude<EditStatus, null>, { text: string; progress: number }> = {
  queued: { text: 'Queued...', progress: 10 },
  editing: { text: 'Editing...', progress: 40 },
  rendering: { text: 'Rendering...', progress: 70 },
};

// Edit chat: pick a generated video (drag it from the asset stash), describe
// the change, and the API queues POST /editchat/process. Progress arrives on
// the chat's Socket.IO room as edit_started / edit_complete / edit_failed.
const EditComponent = ({
  ref,
  currentProject,
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
  onRemoveItem,
}: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { triggerRefresh: triggerAssetRefresh } = useRefreshAssetStash();
  const { triggerRefresh: triggerTimelineRefresh } = useRefreshTimeline();
  const [status, setStatus] = useState<EditStatus>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // edit_complete can arrive twice (phase event + worker event); finish once.
  const finishedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    handleNewChat: () => {},
    handleExportChat,
    getMessageCount: () => messages.length,
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentChatId) return;

    socket.emit('join_chat', currentChatId);
    setActiveChat(currentChatId);

    const finishWith = (llmResponse: string, ok: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: { plannerOutput: '', llmResponse },
            completed: true,
          };
        }
        return updated;
      });
      setIsProcessing(false);
      setStatus(null);
      if (ok) {
        toast.success('Edit complete!');
        triggerAssetRefresh();
        triggerTimelineRefresh();
      } else {
        toast.error(llmResponse);
      }
    };

    const handleUpdate = (event: any) => {
      const { type, phase, data } = event ?? {};

      if (type === 'edit_started') {
        setStatus(phase === 'render' ? 'rendering' : 'editing');
      } else if (type === 'edit_render_complete') {
        setStatus('rendering');
      } else if (type === 'edit_complete') {
        finishWith(data?.newAssetUrl ?? data?.url ?? 'Edit complete.', true);
      } else if (type === 'edit_failed') {
        finishWith(`Error: ${data?.error ?? 'Edit failed.'}`, false);
      }
    };

    socket.on('chat_update', handleUpdate);
    return () => {
      socket.off('chat_update', handleUpdate);
      setActiveChat(null);
    };
  }, [currentChatId]);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    // The first dropped item is the source asset to edit
    const sourceAsset = droppedItems?.[0];
    if (!sourceAsset) {
      toast.error('Drop a video asset onto this panel first, then describe your edit.');
      return;
    }

    const userMessage = messageActions.createMessage(input.trim(), 'user');
    setMessages((prev) => [...prev, userMessage]);

    const editPromptText = input.trim();
    setInput('');
    setIsProcessing(true);
    setStatus('queued');
    finishedRef.current = false;

    try {
      const response = await api.post('/editchat/process', {
        projectId: currentProject?._id,
        assetId: sourceAsset._id,
        editPrompt: editPromptText,
      });
      const resData = response.data as any;

      if (!resData.success) {
        throw new Error(resData.error || resData.message || 'Failed to start edit');
      }
      const { editChatId } = resData.data;

      const placeholder: Message = {
        _id: `msg_${Date.now()}`,
        content: { plannerOutput: '', llmResponse: '' },
        role: 'assistant',
        timestamp: new Date().toISOString(),
        scenes: [],
        projectDescription: '',
        completed: false,
        plannerOut: false,
        generatorOutput: false,
      };
      setMessages((prev) => [...prev, placeholder]);

      // Join before React re-renders so no early event is missed.
      socket.emit('join_chat', editChatId);
      if (currentChatId !== editChatId) setCurrentChatId(editChatId);
      setStatus('editing');
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      setMessages((prev) => [...prev, messageActions.createMessage(`Error: ${errMsg}`, 'assistant')]);
      toast.error(errMsg);
      setIsProcessing(false);
      setStatus(null);
    }
  };

  const handleExportChat = () => {
    const chatData = {
      mode: 'edit',
      timestamp: new Date().toISOString(),
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
      chatId: currentChatId,
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-edit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
  };

  const handleAssetDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleAssetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const asset = JSON.parse(e.dataTransfer.getData('application/json')) as Asset;
      if (asset.type !== 'video') {
        toast.error('Only video assets can be edited.');
        return;
      }
      // One source video at a time: replace any earlier pick.
      droppedItems?.forEach((it) => onRemoveItem?.(it._id));
      onAssetDrop?.(asset);
    } catch {
      /* not an asset drag */
    }
  };

  const noAssetSelected = !droppedItems || droppedItems.length === 0;
  const loading = STATUS_TEXT[status ?? 'queued'];

  const sourceSlot = (
    <div
      onDragOver={handleAssetDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleAssetDrop}
      className={`mx-3 mb-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
        isDragOver ? 'border-green-500 bg-green-500/10' : 'border-zinc-700'
      }`}
    >
      {noAssetSelected ? (
        <span className="text-zinc-500">
          Drag a video from the Asset Stash here to edit it
        </span>
      ) : (
        droppedItems!.map((asset) => (
          <div key={asset._id} className="flex items-center gap-2 text-zinc-200">
            <Film className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            <span className="truncate flex-1">{asset.name}</span>
            <button
              type="button"
              onClick={() => onRemoveItem?.(asset._id)}
              className="text-zinc-400 hover:text-white"
              title="Remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const inputBar = (
    <>
      {sourceSlot}
      <MessageInput
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        placeholder={noAssetSelected ? 'Drop a video asset first...' : 'Describe your edit...'}
        mode="edit"
      />
    </>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {messages.length === 0 ? (
        <>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <EmptyState mode="edit" onPromptSelect={handlePromptSelect} />
            <QuickPrompts mode="edit" onPromptSelect={handlePromptSelect} />
          </div>
          {inputBar}
        </>
      ) : (
        <>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 space-y-4 pt-4">
              {messages.map((message, index) => (
                <div key={message._id || index} className="break-words">
                  <MessageBubble
                    message={message}
                    onCopy={() => {}}
                    plannerOutputRef={{ current: '' }}
                    isLastMessage={index === messages.length - 1}
                    llmSummaryRef={{ current: '' }}
                    isProcessing={isProcessing}
                    streamSummaryRef={{ current: false }}
                  />
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-center w-full gap-3 text-sm">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-500/10">
                      <Bot className="w-4 h-4 text-blue-400 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-xs text-zinc-200 animate-pulse mb-2">{loading.text}</span>
                    <div className="w-full bg-zinc-700 rounded-full h-1.5 relative overflow-hidden">
                      <div
                        className="bg-blue-400 h-1.5 rounded-full transition-all duration-300 ease-in-out absolute top-0 left-0 z-10"
                        style={{ width: `${loading.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
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

export default EditComponent;
