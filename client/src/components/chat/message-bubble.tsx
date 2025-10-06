import { BotMessageSquare, User } from "lucide-react";
import { Message } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.isUser;
  const timeAgo = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  if (isUser) {
    return (
      <div className="mb-6 flex justify-end" data-testid={`message-user-${message.id}`}>
        <div className="flex space-x-3 max-w-3xl">
          <div className="glass-chip rounded-2xl rounded-tr-sm p-4 shadow-lg">
            <div className="text-foreground leading-relaxed prose prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            <span className="text-xs text-muted-foreground/70 mt-2 block text-right">{timeAgo}</span>
          </div>
          <div className="w-8 h-8 rounded-full glass-chip flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 flex justify-start" data-testid={`message-assistant-${message.id}`}>
      <div className="flex space-x-3 max-w-3xl">
        <div className="w-8 h-8 rounded-full glass-chip flex items-center justify-center flex-shrink-0">
          <BotMessageSquare className="w-4 h-4 text-purple-500" />
        </div>
        <div className="glass-chip rounded-2xl rounded-tl-sm p-4 shadow-lg">
          <div className="text-foreground leading-relaxed prose prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
          <span className="text-xs text-muted-foreground mt-2 block">{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}
