import { useRef, useEffect, useImperativeHandle } from 'react';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { Bot } from 'lucide-react';
import {
  messageActions,
  type Message
} from '@/State/Dashboard.state';
import EmptyState from './EmptyState.rightsidebar';
import MessageBubble from './MessageBubble.rightsidebar';
import QuickPrompts from './QuickPrompts.rightsidebar';
import MessageInput from './MessageInput.rightsidebar';
import api from '@/api';
import { toast } from 'sonner';
import type { Project } from '@/State/Types';

interface Props {
  ref: any;
  currentProject?: Project;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
}

// Edit Component  
const EditComponent = ({currentProject, ref, messages, setMessages, input, setInput, isProcessing, setIsProcessing}: Props) => {
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
      const responseContent = await api.post(`/editchat/process`, {
        projectId: currentProject?._id, // Changed from .id to ._id to match backend expectation
        prompt: userInput
      });
      
      console.log(responseContent)

      if (responseContent.data.success) {
        // Fixed: Use the correct response path
        const assistantMessage = messageActions.createMessage(
          responseContent.data.llmResponse, // Changed from .message to .llmResponse based on backend response
          'assistant'
        );
        setMessages((prev: Message[]) => [...prev, assistantMessage]);
      } else {
        toast.error(responseContent.data.error || responseContent.data.message || 'Failed to process request');
        throw new Error(responseContent.data.error || responseContent.data.message || 'Unknown error');
      }
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
        <ScrollArea className="flex-1 overflow-y-auto">
          <EmptyState mode="edit" onPromptSelect={handlePromptSelect} />
          <QuickPrompts mode="edit" onPromptSelect={handlePromptSelect} />
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
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
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
                  <Bot className="w-3 h-3 transition-colors duration-300 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-300 bg-blue-400"></div>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-75 transition-colors duration-300 bg-blue-400"></div>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-150 transition-colors duration-300 bg-blue-400"></div>
                    <span className="ml-1.5 text-[10px]">Processing...</span>
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
};

export default EditComponent;