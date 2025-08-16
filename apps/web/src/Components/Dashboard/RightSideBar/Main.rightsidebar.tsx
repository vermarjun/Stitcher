import {useState, useRef, useEffect, forwardRef, useImperativeHandle} from 'react';
import { 
  // useRecoilState, 
  useRecoilValue 
} from 'recoil';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { Bot } from 'lucide-react';
import {
  // chatMessagesState,
  currentProjectState,
  messageActions,
  type Message
} from '@/State/Dashboard.state';
import EmptyState from './EmptyState.rightsidebar';
import MessageBubble from './MessageBubble.rightsidebar';
import QuickPrompts from './QuickPrompts.rightsidebar';
import { AISidebarHeader, ConfirmationDialog } from './Header.rightsidebar';
import MessageInput from './MessageInput.rightsidebar';

// Generate Component
const GenerateComponent = forwardRef<{
  handleNewChat: () => void;
  handleExportChat: () => void;
  getMessageCount: () => number;
}, { 
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  input: string;
  setInput: (input: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}>((props, ref) => {
  const currentProject = useRecoilValue(currentProjectState);
  const { messages, setMessages, input, setInput, isProcessing, setIsProcessing } = props;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    handleNewChat: () => {},
    handleExportChat,
    getMessageCount: () => messages.length
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = messageActions.createMessage(input.trim(), 'user');
    setMessages((prev: Message[]) => [...prev, userMessage]);
    
    const userInput = input.trim();
    setInput('');
    setIsProcessing(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      const responseContent = `I'll generate a video based on your request: "${userInput}". This will create a new video with the specifications you described. The video will be added to your timeline once processing is complete.`;
      
      const assistantMessage = messageActions.createMessage(responseContent, 'assistant');
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error processing request:', error);
      const errorMessage = messageActions.createMessage(
        'Sorry, I encountered an error processing your request. Please try again.',
        'assistant'
      );
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportChat = () => {
    const chatData = {
      mode: 'generate',
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-generate-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToTemplates = (message: Message) => {
    console.log('Save to templates:', message.content);
  };

  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
  };

  const handleCopy = (_content: string) => {};

  const getPlaceholder = () => {
    return currentProject 
      ? `Ask AI to generate videos for "${currentProject.name}"...`
      : "Ask AI to generate videos or create a project first...";
  };

  return (
    <>
      {messages.length === 0 ? (
        <ScrollArea className="flex-1 min-h-0">
          <EmptyState mode="generate" onPromptSelect={handlePromptSelect} />
          <QuickPrompts mode="generate" onPromptSelect={handlePromptSelect} />
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onCopy={handleCopy}
                onSave={handleSaveToTemplates}
                mode="generate"
              />
            ))}
            {isProcessing && (
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/30">
                  <Bot className="w-3 h-3 transition-colors duration-300 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <div className="w-2 h-2 rounded-full animate-pulse transition-colors duration-300 bg-emerald-400"></div>
                    <div className="w-2 h-2 rounded-full animate-pulse delay-75 transition-colors duration-300 bg-emerald-400"></div>
                    <div className="w-2 h-2 rounded-full animate-pulse delay-150 transition-colors duration-300 bg-emerald-400"></div>
                    <span className="ml-2">Generating...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      )}
      <MessageInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isProcessing || !currentProject}
        placeholder={getPlaceholder()}
        mode="generate"
      />
    </>
  );
});

// Edit Component  
const EditComponent = forwardRef<{
  handleNewChat: () => void;
  handleExportChat: () => void;
  getMessageCount: () => number;
}, {
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  input: string;
  setInput: (input: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}>((props, ref) => {
  const currentProject = useRecoilValue(currentProjectState);
  const { messages, setMessages, input, setInput, isProcessing, setIsProcessing } = props;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    handleNewChat: () => {},
    handleExportChat,
    getMessageCount: () => messages.length
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = messageActions.createMessage(input.trim(), 'user');
    setMessages((prev: Message[]) => [...prev, userMessage]);
    
    const userInput = input.trim();
    setInput('');
    setIsProcessing(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      const responseContent = `I'll modify your timeline according to your request: "${userInput}". I've updated the timeline data with the changes you requested. You can see the modifications reflected in your video editor.`;
      
      const assistantMessage = messageActions.createMessage(responseContent, 'assistant');
      setMessages((prev: Message[]) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error processing request:', error);
      const errorMessage = messageActions.createMessage(
        'Sorry, I encountered an error processing your request. Please try again.',
        'assistant'
      );
      setMessages((prev: Message[]) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportChat = () => {
    const chatData = {
      mode: 'edit',
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-edit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToTemplates = (message: Message) => {
    console.log('Save to templates:', message.content);
  };

  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
  };

  const handleCopy = (_content: string) => {};

  const getPlaceholder = () => {
    return currentProject
      ? `Ask AI to edit your timeline for "${currentProject.name}"...`
      : "Select a project to edit timeline...";
  };

  return (
    <>
      {messages.length === 0 ? (
        <ScrollArea className="flex-1 min-h-0">
          <EmptyState mode="edit" onPromptSelect={handlePromptSelect} />
          <QuickPrompts mode="edit" onPromptSelect={handlePromptSelect} />
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onCopy={handleCopy}
                onSave={handleSaveToTemplates}
                mode="edit"
              />
            ))}
            {isProcessing && (
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
                  <Bot className="w-3 h-3 transition-colors duration-300 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <div className="w-2 h-2 rounded-full animate-pulse transition-colors duration-300 bg-blue-400"></div>
                    <div className="w-2 h-2 rounded-full animate-pulse delay-75 transition-colors duration-300 bg-blue-400"></div>
                    <div className="w-2 h-2 rounded-full animate-pulse delay-150 transition-colors duration-300 bg-blue-400"></div>
                    <span className="ml-2">Processing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      )}
      <MessageInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isProcessing || !currentProject}
        placeholder={getPlaceholder()}
        mode="edit"
      />
    </>
  );
});


// Main Component with all enhancements
const AISidebar = () => {
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  
  // Persistent state for Generate component
  const [generateMessages, setGenerateMessages] = useState<Message[]>([]);
  const [generateInput, setGenerateInput] = useState('');
  const [generateIsProcessing, setGenerateIsProcessing] = useState(false);
  
  // Persistent state for Edit component
  const [editMessages, setEditMessages] = useState<Message[]>([]);
  const [editInput, setEditInput] = useState('');
  const [editIsProcessing, setEditIsProcessing] = useState(false);
  
  // Confirmation dialog state
  const [showConfirmation, setShowConfirmation] = useState(false);
  
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

  const getCurrentComponent = () => {
    return mode === 'generate' ? generateRef.current : editRef.current;
  };

  const handleNewChat = () => {
    const currentMessages = mode === 'generate' ? generateMessages : editMessages;
    if (currentMessages.length > 0) {
      setShowConfirmation(true);
    }
  };

  const confirmNewChat = () => {
    if (mode === 'generate') {
      setGenerateMessages([]);
      setGenerateInput('');
      setGenerateIsProcessing(false);
    } else {
      setEditMessages([]);
      setEditInput('');
      setEditIsProcessing(false);
    }
    setShowConfirmation(false);
  };

  const handleExportChat = () => {
    getCurrentComponent()?.handleExportChat();
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
    <div className="h-full w-80 flex flex-col bg-neutral-950 border-l border-neutral-800">
      <AISidebarHeader 
        mode={mode} 
        setMode={setMode} 
        onNewChat={handleNewChat}
        onClearChat={() => {}}
        onExportChat={handleExportChat}
        messageCount={getMessageCount()}
        onSelectHistory={handleSelectHistory}
      />
      
      {mode === 'generate' ? 
        <GenerateComponent 
          ref={generateRef}
          messages={generateMessages}
          setMessages={setGenerateMessages}
          input={generateInput}
          setInput={setGenerateInput}
          isProcessing={generateIsProcessing}
          setIsProcessing={setGenerateIsProcessing}
        /> : 
        <EditComponent 
          ref={editRef}
          messages={editMessages}
          setMessages={setEditMessages}
          input={editInput}
          setInput={setEditInput}
          isProcessing={editIsProcessing}
          setIsProcessing={setEditIsProcessing}
        />
      }

      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={confirmNewChat}
        title="Start New Chat?"
        description={`Starting a new chat will reset your ${mode} conversation context. This action cannot be undone.`}
        confirmText="Start Fresh"
        cancelText="Keep Current"
      />
    </div>
  );
};

export default AISidebar;