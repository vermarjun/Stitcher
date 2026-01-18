import { useState, useRef, useEffect } from 'react';
import { AISidebarHeader, ConfirmationDialog } from './Header.rightsidebar';
import GenerateComponent from './Generate.rightsidebar';
import EditComponent from './Edit.rightsidebar';
import type { Project, IUser, Asset } from '@/State/Types';
import api from '@/api';

interface Props {
  currentProject?: Project,
  user?: IUser
  onAssetDrop?: (asset: any) => void; 
  droppedItems?: Asset[];
  onRemoveItem?: (id: string) => void;

} 

export type VideoGenerationRequest = {
  id: string;
  prompt: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  projectId: string;
  createdAt: Date;
  completedAt?: Date;
  videoUrl?: string;
  error?: string;
};

interface IAssistant {
  plannerOutput: string;
  llmResponse: string;
}

interface Scene {
  sceneName: string;
  prompt: string;
  summary: string;
  code: string;
  assetId: Asset | null;
  error: string | null;
}

export type Message = {
  _id?: string;
  content: string | IAssistant; 
  role: "user" | "assistant";
  timestamp: string | Date;
  scenes: Scene[];
  projectDescription: string;
  completed: boolean;
  plannerOut: boolean;
  generatorOutput: boolean;
};

export const messageActions = {
  createMessage: (
    content: string,
    role: Message["role"]
  ): Message => ({
    _id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    role,
    timestamp: new Date().toISOString(),
    scenes: [],
    projectDescription: '',
    completed: false,
    plannerOut: false,
    generatorOutput: false,
  }),
  
  createVideoGenerationRequest: (
    prompt: string,
    projectId: string
  ): VideoGenerationRequest => ({
    id: `req_${Date.now()}`,
    prompt,
    status: "pending",
    progress: 0,
    projectId,
    createdAt: new Date(),
  }),
};

const AISidebar = ({ currentProject, user, onAssetDrop, droppedItems, onRemoveItem}: Props) => {
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  
  const [generateMessages, setGenerateMessages] = useState<Message[]>([]);
  const [generateInput, setGenerateInput] = useState('');
  const [generateIsProcessing, setGenerateIsProcessing] = useState(false);
  
  const [editMessages, setEditMessages] = useState<Message[]>([]);
  const [, setEditInput] = useState('');
  const [, setEditIsProcessing] = useState(false);
  
  const [currentGenerateChatId, setCurrentGenerateChatId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Fetch the latest generate chat for the current project
  async function fetchLatestGenerateChat() {
    if (!currentProject?._id) return;
    
    setIsLoadingChats(true);
    try {
      const generateChats = await api.get<{ success: boolean; data: Array<{ _id: string }> }>(`/generatechat/project/${currentProject._id}`);
      if (generateChats?.data.success && generateChats.data.data.length > 0) {
        const latestChat = generateChats.data.data[0];
        setCurrentGenerateChatId(latestChat._id);
        
        const chatHistory = await api.get<{ success: boolean; data: { messages: Message[] } }>(`/generatechat/${latestChat._id}`);
        
        if (chatHistory?.data.success) {
          const messages = chatHistory.data.data.messages || [];
          setGenerateMessages(messages);
        }
      } else {
        setGenerateMessages([]);
        setCurrentGenerateChatId(null);
      }
    } catch (error) {
      console.error('Error fetching generate chats:', error);
      setGenerateMessages([]);
      setCurrentGenerateChatId(null);
    } finally {
      setIsLoadingChats(false);
    }
  }

  // Fetch edit chat history
  async function fetchEditChatHistory() {
    if (!currentProject?._id) return;
    
    try {
      const editChatHistory = await api.get<{ success: boolean; messages: Message[] }>(`/editchat/history/${currentProject._id}`);
      
      if (editChatHistory?.data.success) {
        setEditMessages(editChatHistory.data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching edit chat history:', error);
      setEditMessages([]);
    }
  }

  // Main fetch function that gets both generate and edit chats
  async function fetchChats() {
    if (!currentProject?._id) return;
    
    await Promise.all([
      fetchLatestGenerateChat(),
      fetchEditChatHistory()
    ]);
  }
  
  useEffect(() => {
    fetchChats();
  }, [currentProject?._id]);
  
  const generateRef = useRef<{
    handleNewChat: () => void;
    handleExportChat: () => void;
    getMessageCount: () => number;
  }>(null);
  
  const editRef = useRef<{
    handleNewChat: () => void;
    handleExportChat: () => void;
    getMessageCount: () => number;
  }>(null);
  
  const handleNewChat = () => {
    if (mode === 'generate') {
      setGenerateMessages([]);
      setGenerateInput('');
      setGenerateIsProcessing(false);
      setCurrentGenerateChatId(null);
    } else {
      setEditMessages([]);
      setEditInput('');
      setEditIsProcessing(false);
    }
    setShowConfirmation(false);
  };

  const handleNewChatClick = () => {
    const currentMessages = mode === 'generate' ? generateMessages : editMessages;
    if (currentMessages.length > 0) {
      setShowConfirmation(true);
    } else {
      handleNewChat();
    }
  };
  
  const handleExportChat = () => {
    const currentComponent = mode === 'generate' ? generateRef.current : editRef.current;
    currentComponent?.handleExportChat();
  };
  
  const getMessageCount = () => {
    return mode === 'generate' ? generateMessages.length : editMessages.length;
  };
  
  const handleSelectHistory = (messages: Message[]) => {
    if (mode === 'generate') {
      setGenerateMessages(messages);
    } else {
      setEditMessages(messages);
    }
  };
  
  return (
    <div className="bg-black border-l border-zinc-700 flex flex-col w-80 relative">
      <AISidebarHeader 
        mode={mode} 
        setMode={setMode} 
        onNewChatClick={handleNewChatClick}
        onClearChat={() => {}}
        onExportChat={handleExportChat}
        messageCount={getMessageCount()}
        onSelectHistory={handleSelectHistory}
        currentProject={currentProject}
      />
      
      {/* Show loading state while fetching chats */}
      {isLoadingChats ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-zinc-400">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin"></div>
            <span>Loading chats...</span>
          </div>
        </div>
      ) : (
        <>
          {mode === 'generate' ? 
            <GenerateComponent 
              currentProject={currentProject}
              ref={generateRef}
              messages={generateMessages}
              setMessages={setGenerateMessages}
              input={generateInput}
              setInput={setGenerateInput}
              isProcessing={generateIsProcessing}
              setIsProcessing={setGenerateIsProcessing}
              currentChatId={currentGenerateChatId}
              setCurrentChatId={setCurrentGenerateChatId}
              user={user}
              onAssetDrop={onAssetDrop}
              droppedItems={droppedItems}
              onRemoveItem={onRemoveItem}
            />
            : 
            <EditComponent/>
          }
        </>
      )}
      
      {/* Confirmation Dialog - positioned relative to entire sidebar */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleNewChat}
        title="Start New Chat?"
        description={`This will reset the context and start a fresh chat. If you want to work on current scene continue here.`}
        confirmText="New Chat"
        cancelText="Cancel"
      />
    </div>
  );
};

export default AISidebar;