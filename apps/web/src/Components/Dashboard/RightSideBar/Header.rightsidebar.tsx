import {useState } from 'react';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { Bot, Settings, History, PlusIcon, Clock, MessageSquare, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Button } from '@/Components/ui/button';
import { Badge } from '@/Components/ui/badge';
import { type Message } from '@/State/Dashboard.state';

// Mock chat history data (replace with actual API calls)
const mockChatHistory = {
  generate: [
    {
      id: '1',
      title: 'Product Demo Video',
      timestamp: new Date('2024-01-15T10:30:00'),
      messageCount: 5,
      lastMessage: 'Create a 30-second product showcase video',
      messages: [
        { id: '1', content: 'Create a 30-second product showcase video', role: 'user' as const, timestamp: new Date('2024-01-15T10:30:00') },
        { id: '2', content: 'I\'ll create a professional product showcase video for you...', role: 'assistant' as const, timestamp: new Date('2024-01-15T10:31:00') },
      ]
    },
    {
      id: '2',
      title: 'Social Media Campaign',
      timestamp: new Date('2024-01-14T15:45:00'),
      messageCount: 8,
      lastMessage: 'Generate an engaging social media video',
      messages: [
        { id: '3', content: 'Generate an engaging social media video', role: 'user' as const, timestamp: new Date('2024-01-14T15:45:00') },
        { id: '4', content: 'I\'ll create an engaging social media video that captures attention...', role: 'assistant' as const, timestamp: new Date('2024-01-14T15:46:00') },
      ]
    }
  ],
  edit: [
    {
      id: '3',
      title: 'Timeline Adjustments',
      timestamp: new Date('2024-01-13T09:20:00'),
      messageCount: 6,
      lastMessage: 'Add smooth transitions between clips',
      messages: [
        { id: '5', content: 'Add smooth transitions between clips', role: 'user' as const, timestamp: new Date('2024-01-13T09:20:00') },
        { id: '6', content: 'I\'ll add smooth transitions between all your clips...', role: 'assistant' as const, timestamp: new Date('2024-01-13T09:21:00') },
      ]
    }
  ]
};

// Modern Confirmation Dialog Component
const ConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description,
  confirmText = "Continue",
  cancelText = "Cancel"
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="xs:max-w-md bg-neutral-900 border-neutral-700">
      <DialogHeader>
        <DialogTitle className="text-neutral-200">{title}</DialogTitle>
        <DialogDescription className="text-neutral-400">
          {description}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
          {cancelText}
        </Button>
        <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// Chat History Modal Component
const ChatHistoryModal = ({ 
  isOpen, 
  onClose, 
  mode, 
  onSelectHistory 
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: 'generate' | 'edit';
  onSelectHistory: (messages: Message[]) => void;
}) => {
  const historyData = mockChatHistory[mode] || [];

  const handleSelectHistory = (historyItem: any) => {
    // Convert mock messages to proper Message format
    const messages = historyItem.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
    onSelectHistory(messages);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="xs:max-w-2xl max-h-[80vh] bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="text-neutral-200 flex items-center gap-2">
            <History className="w-5 h-5" />
            {mode === 'generate' ? 'Generate' : 'Edit'} Chat History
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Select a previous chat to continue the conversation
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {historyData.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No chat history found for {mode} mode</p>
              </div>
            ) : (
              historyData.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectHistory(item)}
                  className="p-4 rounded-lg border border-neutral-700 hover:border-neutral-600 bg-neutral-800/50 hover:bg-neutral-800/70 cursor-pointer transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-neutral-200 group-hover:text-white transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Clock className="w-3 h-3" />
                      {item.timestamp.toLocaleDateString()}
                    </div>
                  </div>
                  
                  <p className="text-xs text-neutral-400 mb-3 line-clamp-2">
                    {item.lastMessage}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs bg-neutral-700/50 text-neutral-300">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {item.messageCount} messages
                    </Badge>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                        Load Chat
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// Settings Dropdown Component
const SettingsDropdown = () => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
          onClick={handleClick}
        >
          <Settings className={cn("w-4 h-4 transition-transform duration-1000", isAnimating && "animate-spin")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-neutral-900 border-neutral-700" align="end">
        <DropdownMenuLabel className="text-neutral-200">Settings</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-neutral-700" />
        <DropdownMenuItem className="text-neutral-300 hover:bg-neutral-800 hover:text-white">
          <Settings className="w-4 h-4 mr-2" />
          AI Preferences
        </DropdownMenuItem>
        <DropdownMenuItem className="text-neutral-300 hover:bg-neutral-800 hover:text-white">
          <Download className="w-4 h-4 mr-2" />
          Export Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="text-neutral-300 hover:bg-neutral-800 hover:text-white">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Enhanced Header Component
const AISidebarHeader = ({ 
  mode, 
  setMode, 
  onNewChat, 
  onExportChat,
  messageCount 
}: { 
  mode: 'generate' | 'edit', 
  setMode: (mode: 'generate' | 'edit') => void,
  onNewChat: () => void,
  onClearChat: () => void,
  onExportChat: () => void,
  messageCount: number,
  onSelectHistory: (messages: Message[]) => void
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  return (
    <div className="border-b border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-300",
            mode === 'generate' 
              ? "bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/30" 
              : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30"
          )}>
            <Bot className={cn(
              "w-3 h-3 transition-colors duration-300",
              mode === 'generate' ? "text-emerald-400" : "text-blue-400"
            )} />
          </div>
          <span className="text-sm font-medium text-neutral-200">AI Assistant</span>
        </div>
        
        <div className="flex items-center gap-1">
          {messageCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
              onClick={onNewChat}
              title="New Chat (resets context)"
            >
              <PlusIcon className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            onClick={onExportChat}
            title="Export chat"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            onClick={() => setIsHistoryOpen(true)}
            title="Chat History"
          >
            <History className="w-4 h-4" />
          </Button>
          <SettingsDropdown />
        </div>
      </div>
      
      {/* Creative Mode Toggle */}
      <div className="px-4 pb-4">
        <div className="relative bg-neutral-900 rounded-xl p-1 overflow-hidden">
          <div 
            className={cn(
              "absolute top-1 bottom-1 w-1/2 rounded-lg transition-all duration-300 ease-out",
              mode === 'generate' 
                ? "left-1 bg-gradient-to-r from-emerald-500/30 to-green-500/30 border border-emerald-500/50" 
                : "left-1/2 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 border border-blue-500/50"
            )}
          />
          
          <div className="relative flex">
            <button
              onClick={() => setMode('generate')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all duration-300",
                mode === 'generate' 
                  ? "text-emerald-300 relative z-10" 
                  : "text-neutral-400 hover:text-neutral-300"
              )}
            >
              <Bot className="w-4 h-4" />
              <span>Generate</span>
            </button>
            <button
              onClick={() => setMode('edit')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all duration-300",
                mode === 'edit' 
                  ? "text-blue-300 relative z-10" 
                  : "text-neutral-400 hover:text-neutral-300"
              )}
            >
              <Bot className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>

      <ChatHistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        mode={mode}
        onSelectHistory={() => {}} // This will be passed from parent
      />
    </div>
  );
};

export { AISidebarHeader, ConfirmationDialog };