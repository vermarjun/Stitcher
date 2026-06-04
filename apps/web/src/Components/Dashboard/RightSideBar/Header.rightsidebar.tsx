import { useState, useEffect } from 'react';
import { History, PlusIcon, Download, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/Components/ui/button';
import { ScrollArea } from '@/Components/ui/scroll-area';
import api from '@/api';
import { toast } from 'sonner';
import type { Message } from './Main.rightsidebar';

// Chat History Component
const ChatHistoryComponent = ({ 
  mode, 
  onGoBack, 
  onSelectHistory, 
  currentProject 
}: {
  mode: 'generate' | 'edit';
  onGoBack: () => void;
  onSelectHistory: (messages: Message[]) => void;
  currentProject?: any;
}) => {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    fetchChatHistory();
  }, [mode, currentProject]);

  const fetchChatHistory = async () => {
    if (!currentProject?._id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'generate') {
        const response = await api.get(`/generatechat/project/${currentProject._id}`);
        if ((response.data as any).success) {
          setChats((response.data as any).data || []);
        }
      } 
    } catch (error) {
      console.error('Error fetching chat history:', error);
      toast.error('Failed to load chat history');
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSelect = async (chat: any) => {
    try {
      if (mode === 'generate') {
        const response = await api.get(`/generatechat/${chat._id}`);
        if ((response.data as any).success) {
          const messages = (response.data as any).data.messages || [];
          onSelectHistory(messages);
          onGoBack();
        }
      } else {
        // For edit mode, use the messages directly
        if (chat.messages) {
          const messages = chat.messages;
          onSelectHistory(messages);
          onGoBack();
        }
      }
    } catch (error) {
      console.error('Error selecting chat:', error);
      toast.error('Failed to load selected chat');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-zinc-800 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          onClick={onGoBack}
        >
          <ArrowLeft className="w-3 h-3" />
        </Button>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-semibold text-white">
            {mode === 'generate' ? 'Generate History' : 'Edit History'}
          </span>
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-zinc-400">
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin"></div>
                <span className="text-xs">Loading history...</span>
              </div>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="w-8 h-8 text-zinc-600 mb-3" />
              <p className="text-xs text-zinc-500 mb-1">No chat history</p>
              <p className="text-xs text-zinc-600">
                Start a conversation to see your history here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat._id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all duration-200",
                    "bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700/50",
                    selectedChatId === chat._id && "bg-zinc-800/70 border-zinc-700"
                  )}
                  onClick={() => {
                    setSelectedChatId(chat._id);
                    handleChatSelect(chat);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-medium text-zinc-200">
                        {chat.title || 'Untitled Chat'}
                      </h4>
                      {/* Removed message count since it's not available in the list response */}
                      <p className="text-xs text-zinc-500 mt-1">
                        {formatDate(chat.updatedAt || chat.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Removed message preview since messages aren't available in the list response */}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// Confirmation Dialog Component - exported for use in main component
const ConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description,
  confirmText,
  cancelText 
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 max-w-sm mx-4 shadow-xl">
        <h3 className="text-white text-sm font-medium mb-2">{title}</h3>
        <p className="text-zinc-400 text-xs mb-4">{description}</p>
        <div className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="bg-zinc-200 border-zinc-700 text-black hover:bg-zinc-400 text-xs h-8"
          >
            {cancelText}
          </Button>
          <Button 
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Header Component
const AISidebarHeader = ({
  mode,
  setMode: _setMode,
  onNewChatClick,
  onExportChat,
  messageCount,
  onShowHistory,
}: {
  mode: 'generate' | 'edit',
  setMode: (mode: 'generate' | 'edit') => void,
  onNewChatClick: () => void,
  onClearChat: () => void,
  onExportChat: () => void,
  messageCount: number,
  onSelectHistory: (messages: Message[]) => void,
  currentProject?: any,
  onShowHistory: () => void,
}) => {
  return (
    <div className="border-b border-zinc-600 bg-zinc-800">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Stitcher</span>
        </div>

        <div className="flex items-center gap-1">
          {messageCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              onClick={onNewChatClick}
              title="New Chat (resets context)"
            >
              <PlusIcon className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            onClick={onShowHistory}
            title="Chat History"
          >
            <History className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            onClick={onExportChat}
            title="Export chat"
          >
            <Download className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export { AISidebarHeader, ConfirmationDialog, ChatHistoryComponent };