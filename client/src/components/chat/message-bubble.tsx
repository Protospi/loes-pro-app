import { BotMessageSquare, User, FileText, Image as ImageIcon } from "lucide-react";
import { Message } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  message: Message;
}

// Helper function to determine if a file is an image
const isImageFile = (fileName: string | null | undefined): boolean => {
  if (!fileName) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};

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
            {/* File attachment display */}
            {message.fileName && (
              <div className="mb-3 inline-flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                {isImageFile(message.fileName) ? (
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-400" />
                )}
                <span className="text-sm text-blue-400 font-medium truncate max-w-[250px]">
                  {message.fileName}
                </span>
              </div>
            )}
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
