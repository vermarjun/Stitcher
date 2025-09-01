import {useRef, useEffect, useImperativeHandle} from 'react';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { Bot } from 'lucide-react';
import {
  messageActions,
  type Message
} from '@/State/Types';
import EmptyState from './EmptyState.rightsidebar';
import MessageBubble from './MessageBubble.rightsidebar';
import QuickPrompts from './QuickPrompts.rightsidebar';
import MessageInput from './MessageInput.rightsidebar';
import api from '@/api';
import { toast } from 'sonner';
import type { Project } from '@/State/Types';
import { useRefresh } from "../RefreshContextProvider";


interface Props {
  currentProject?: Project;
  ref: any;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
}
// Generate Component
const GenerateComponent = ({
  currentProject,
  ref, 
  messages, 
  setMessages, 
  input, 
  setInput, 
  isProcessing, 
  setIsProcessing,
  currentChatId,
  setCurrentChatId
}: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { triggerRefresh } = useRefresh();
  
  useImperativeHandle(ref, () => ({
    handleNewChat: () => {},
    handleExportChat,
    getMessageCount: () => messages.length
  }));
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    console.log("message recieved: ", messages);
  }, [messages]);
  
  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;
    
    const userMessage = messageActions.createMessage(input.trim(), 'user');
    setMessages((prev: Message[]) => [...prev, userMessage]);
    
    const userInput = input.trim();
    setInput('');
    setIsProcessing(true);
    
    try {
      const requestData = {
        projectId: currentProject?._id,
        prompt: userInput,
        ...(currentChatId && { chatId: currentChatId }) // Include chatId if continuing existing chat
      };

      const responseContent = await api.post(`/generatechat/`, requestData);
      
      if (responseContent.data.success) {
        // Update current chat ID if it's a new chat
        if (!currentChatId && responseContent.data.data.chatId) {
          setCurrentChatId(responseContent.data.data.chatId);
        }

        // Create assistant message from the response
        const assistantMessage = messageActions.createMessage(
          responseContent.data.data.llmResponse, 
          'assistant',
          responseContent.data.data.asset // Include asset data in the message
        );
        
        setMessages((prev: Message[]) => [...prev, assistantMessage]);
        triggerRefresh();
      } else {
        toast.error(responseContent.data.message);
        throw new Error(responseContent.data.message);
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
      mode: 'generate',
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        asset: msg.assetId // Include asset in export
      })),
      chatId: currentChatId
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
        <ScrollArea className="flex-1 overflow-y-auto">
          <EmptyState mode="generate" onPromptSelect={handlePromptSelect} />
          <QuickPrompts mode="generate" onPromptSelect={handlePromptSelect} />
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
            {messages.map((message) => (
              <div key={message.id}>
                <MessageBubble 
                  message={message} 
                  onCopy={handleCopy}
                  onSave={handleSaveToTemplates}
                  mode="generate"
                />
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/30">
                  <Bot className="w-3 h-3 transition-colors duration-300 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-300 bg-emerald-400"></div>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-75 transition-colors duration-300 bg-emerald-400"></div>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-150 transition-colors duration-300 bg-emerald-400"></div>
                    <span className="ml-1.5 text-[10px]">Generating...</span>
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
};

export default GenerateComponent;