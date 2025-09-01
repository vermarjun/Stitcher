import { useState, useRef, useEffect } from 'react';
import type { Message } from '@/State/Dashboard.state';
import { AISidebarHeader, ConfirmationDialog } from './Header.rightsidebar';
import GenerateComponent from './Generate.rightsidebar';
import EditComponent from './Edit.rightsidebar';
import type { Project } from '@/State/Types';
import api from '@/api';

interface Props {
  currentProject?: Project,
}

const AISidebar = ({ currentProject }: Props) => {
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  
  const [generateMessages, setGenerateMessages] = useState<Message[]>([]);
  const [generateInput, setGenerateInput] = useState('');
  const [generateIsProcessing, setGenerateIsProcessing] = useState(false);
  
  const [editMessages, setEditMessages] = useState<Message[]>([]);
  const [editInput, setEditInput] = useState('');
  const [editIsProcessing, setEditIsProcessing] = useState(false);
  
  const [currentGenerateChatId, setCurrentGenerateChatId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Function to convert backend message format to frontend Message format
  const convertBackendMessages = (backendMessages: any[]): Message[] => {
    return backendMessages.map(msg => ({
      id: msg._id || Math.random().toString(),
      role: msg.role,
      content: msg.content,
      assetId: msg.assetId,
      timestamp: new Date(msg.timestamp),
    }));
  };

  // Fetch the latest generate chat for the current project
  async function fetchLatestGenerateChat() {
    if (!currentProject?._id) return;
    
    setIsLoadingChats(true);
    try {
      const generateChats = await api.get(`/generatechat/project/${currentProject._id}`);
      
      if (generateChats?.data.success && generateChats.data.data.length > 0) {
        const latestChat = generateChats.data.data[0];
        setCurrentGenerateChatId(latestChat._id);
        
        const chatHistory = await api.get(`/generatechat/${latestChat._id}`);
        
        if (chatHistory?.data.success) {
          const messages = convertBackendMessages(chatHistory.data.data.messages || []);
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
      const editChatHistory = await api.get(`/editchat/history/${currentProject._id}`);
      
      if (editChatHistory?.data.success) {
        const messages = convertBackendMessages(editChatHistory.data.messages || []);
        setEditMessages(messages);
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
    <div className="bg-black border-l-2 border-zinc-800 flex flex-col w-80 relative">
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
            /> : 
            <EditComponent
              currentProject={currentProject} 
              ref={editRef}
              messages={editMessages}
              setMessages={setEditMessages}
              input={editInput}
              setInput={setEditInput}
              isProcessing={editIsProcessing}
              setIsProcessing={setEditIsProcessing}
            />
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