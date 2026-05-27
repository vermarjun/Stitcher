import { useRef, useEffect, useImperativeHandle, useState } from 'react';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { Bot } from 'lucide-react';
import { messageActions, type Message } from './Main.rightsidebar';
import EmptyState from './EmptyState.rightsidebar';
import MessageBubble from './MessageBubble.rightsidebar';
import QuickPrompts from './QuickPrompts.rightsidebar';
import MessageInput from './MessageInput.rightsidebar';
import api from '@/api';
import { toast } from 'sonner';
import type { Project, IUser, Asset } from '@/State/Types';
import { useRefreshAssetStash } from '../RefreshContextProvider';
import { useRefreshHeader } from '../context';
import { socket } from '@/socket';

interface Props {
  ref: any;
  currentProject?: Project;
  user?: IUser;
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

// Edit Component — wired to /editchat/process + Socket.IO
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
  const { triggerRefresh } = useRefreshAssetStash();
  const { triggerHeaderRefresh } = useRefreshHeader();
  const [pollingStatus, setPollingStatus] = useState<'queued' | 'editing' | 'rendering' | null>(null);

  useImperativeHandle(ref, () => ({
    handleNewChat: () => {},
    handleExportChat,
    getMessageCount: () => messages.length,
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket event listener
  useEffect(() => {
    if (!currentChatId) return;

    socket.emit('join_chat', currentChatId);

    const handleUpdate = (event: any) => {
      const { type, data } = event;

      if (type === 'job_queued') {
        setPollingStatus('queued');
      } else if (type === 'EDITING_START') {
        setPollingStatus('editing');
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: { plannerOutput: '', llmResponse: '' },
            };
          }
          return updated;
        });
      } else if (type === 'EDITING_CODE_COMPLETE' || type === 'ENQUEUED_FOR_RENDERING') {
        setPollingStatus('rendering');
      } else if (type === 'EDITING_COMPLETE') {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: {
                plannerOutput: '',
                llmResponse: data?.summary || 'Edit complete.',
              },
              completed: true,
            };
          }
          return updated;
        });
        toast.success('Edit complete!');
        setIsProcessing(false);
        setPollingStatus(null);
        triggerRefresh();
        triggerHeaderRefresh();
      } else if (type === 'EDITING_ERROR') {
        const errMsg = data?.message || data?.error || 'Edit failed.';
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: { plannerOutput: '', llmResponse: `Error: ${errMsg}` },
              completed: true,
            };
          }
          return updated;
        });
        toast.error(`Edit error: ${errMsg}`);
        setIsProcessing(false);
        setPollingStatus(null);
      }
    };

    socket.on('chat_update', handleUpdate);
    return () => {
      socket.off('chat_update', handleUpdate);
    };
  }, [currentChatId, triggerRefresh]);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    // The first dropped item is the source asset to edit
    const sourceAsset = droppedItems?.[0];
    if (!sourceAsset) {
      toast.error('Drop a video asset onto the input first, then describe your edit.');
      return;
    }

    const userMessage = messageActions.createMessage(input.trim(), 'user');
    setMessages((prev) => [...prev, userMessage]);

    const editPromptText = input.trim();
    setInput('');
    setIsProcessing(true);
    setPollingStatus('queued');

    try {
      const requestBody: Record<string, any> = {
        projectId: currentProject?._id,
        assetId: sourceAsset._id,
        editPrompt: editPromptText,
      };

      const response = await api.post('/editchat/process', requestBody);
      const resData = (response.data as any);

      if (resData.success) {
        const { editChatId } = resData.data;

        // Set the chat id so the socket listener activates
        if (!currentChatId) {
          setCurrentChatId(editChatId);
        }

        // Placeholder assistant message
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

        socket.emit('join_chat', editChatId);
        setPollingStatus('editing');
      } else {
        throw new Error(resData.error || resData.message || 'Failed to start edit');
      }
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      const errMessage = messageActions.createMessage(
        `Error: ${errMsg}`,
        'assistant'
      );
      setMessages((prev) => [...prev, errMessage]);
      toast.error(errMsg);
      setIsProcessing(false);
      setPollingStatus(null);
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

  const getLoadingStatus = () => {
    switch (pollingStatus) {
      case 'queued':
        return { text: 'Queued...', progress: 10 };
      case 'editing':
        return { text: 'Editing...', progress: 40 };
      case 'rendering':
        return { text: 'Rendering...', progress: 70 };
      default:
        return { text: 'Processing...', progress: 0 };
    }
  };

  const noAssetSelected = !droppedItems || droppedItems.length === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {messages.length === 0 ? (
        <>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <EmptyState mode="edit" onPromptSelect={handlePromptSelect} />
            <QuickPrompts mode="edit" onPromptSelect={handlePromptSelect} />
            {noAssetSelected && (
              <p className="text-xs text-zinc-500 text-center px-4 pb-3">
                Drag a video asset from the asset stash onto the input below to begin editing.
              </p>
            )}
          </div>
          <MessageInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isProcessing={isProcessing}
            placeholder={noAssetSelected ? 'Drop a video asset first...' : 'Describe your edit...'}
            mode="edit"
            onCancel={() => {}}
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
                const isLastMessage = index === messages.length - 1;
                return (
                  <div key={message._id || index} className="break-words">
                    <MessageBubble
                      message={message}
                      onCopy={() => {}}
                      plannerOutputRef={{ current: '' }}
                      isLastMessage={isLastMessage}
                      llmSummaryRef={{ current: '' }}
                      isProcessing={isProcessing}
                      streamSummaryRef={{ current: false }}
                    />
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-center w-full gap-3 text-sm">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-500/10">
                      <Bot className="w-4 h-4 text-blue-400 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-xs text-zinc-200 animate-pulse mb-2">
                      {getLoadingStatus().text}
                    </span>
                    <div className="w-full bg-zinc-700 rounded-full h-1.5 relative overflow-hidden">
                      <div
                        className="bg-blue-400 h-1.5 rounded-full transition-all duration-300 ease-in-out absolute top-0 left-0 z-10"
                        style={{ width: `${getLoadingStatus().progress}%` }}
                      />
                      <div
                        className="h-1.5 rounded-full absolute top-0 left-0 animate-pulse"
                        style={{
                          width: `${Math.min(getLoadingStatus().progress + 20, 100)}%`,
                          background:
                            'linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.3) 25%, rgba(96,165,250,0.6) 50%, rgba(96,165,250,0.3) 75%, transparent 100%)',
                        }}
                      />
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
            placeholder={noAssetSelected ? 'Drop a video asset first...' : 'Describe your edit...'}
            mode="edit"
            onCancel={() => {}}
            onAssetDrop={onAssetDrop}
            droppedItems={droppedItems}
            onRemoveItem={onRemoveItem}
          />
        </>
      )}
    </div>
  );
};

export default EditComponent;
