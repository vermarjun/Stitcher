// src/components/dashboard/prompt-sidebar.tsx
import { cn } from "@/lib/utils";
import { Button } from "@/Components/ui/button";
import { Textarea } from "@/Components/ui/textarea";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  ChevronDown, 
  Plus,
  Trash2
} from "lucide-react";
import { useState } from "react";

type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
};

function PromptSidebar() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Can you generate a React component for a sidebar?",
      role: "user",
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
    },
    {
      id: "2",
      content: "Sure! Here's a modern sidebar component using Tailwind CSS:\n\n```tsx\nfunction Sidebar() {\n  return (\n    <div className=\"h-screen w-64 bg-gray-900 text-white p-4\">\n      {/* Sidebar content */}\n    </div>\n  );\n}\n```",
      role: "assistant",
      timestamp: new Date(Date.now() - 1000 * 60 * 3),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "Here's the code you requested. Let me know if you'd like any modifications!",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className={cn(
      "h-full w-80 flex flex-col",
      "bg-zinc-950/80 border-l border-zinc-800/50"
    )}>
      {/* Header */}
      <div className={cn(
        "h-10 flex items-center justify-between px-3",
        "border-b border-zinc-800/50 bg-zinc-900/30"
      )}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-zinc-300">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={cn(
                "rounded-lg p-3",
                message.role === "user" 
                  ? "bg-zinc-800/30 border border-zinc-800/50" 
                  : "bg-zinc-900/50 border border-zinc-800/30"
              )}
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full mt-1 flex-shrink-0",
                  message.role === "user" 
                    ? "bg-purple-600/20 text-purple-400" 
                    : "bg-blue-600/20 text-blue-400"
                )}>
                  {message.role === "user" ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                    {message.content}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-300"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="rounded-lg p-3 bg-zinc-900/50 border border-zinc-800/30">
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full mt-1 bg-blue-600/20 text-blue-400 flex-shrink-0">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="text-sm text-zinc-400">Thinking...</div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Prompt Input */}
      <div className="border-t border-zinc-800/50 p-3">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI to generate code or answer questions..."
              className={cn(
                "min-h-[100px] w-full bg-zinc-900/50 border-zinc-800/50",
                "text-sm text-zinc-300 placeholder-zinc-500",
                "focus-visible:ring-1 focus-visible:ring-purple-500/50",
                "pr-10 resize-none"
              )}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className={cn(
                "absolute right-2 bottom-2 h-7 w-7 p-0",
                "bg-purple-600 hover:bg-purple-700",
                "text-white disabled:opacity-50"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>Shift+Enter for new line</span>
            <span>{input.length}/1000</span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PromptSidebar