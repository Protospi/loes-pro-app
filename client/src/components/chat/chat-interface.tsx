import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  Lightbulb,
  Wand2,
  Calendar,
  Brain,
  Code,
  BookOpen,
  Plus,
  Briefcase,
  BotMessageSquare,
  Server
} from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { ChatInput, ChatInputRef } from "./chat-input";
import { SettingsDropdown } from "./settings-dropdown";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Message } from "@shared/schema";
import { createNewSession } from "@/lib/sessionManager";
import { useToast } from "@/hooks/use-toast";

function TypingIndicator() {
  return (
    <div className="mb-6 flex justify-start" data-testid="typing-indicator">
      <div className="flex space-x-3 max-w-3xl">
        <div className="w-8 h-8 rounded-full glass-chip flex items-center justify-center flex-shrink-0">
          <BotMessageSquare className="w-4 h-4 text-blue-500" />
        </div>
        <div className="glass-chip rounded-2xl rounded-tl-sm p-4 shadow-lg">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onInsertText }: { onInsertText: (text: string) => void }) {
  const { t } = useTranslation();
  
  const sampleQuestions = t('chat.sampleQuestions', { returnObjects: true }) as string[];
  const suggestionChipsData = t('chat.suggestionChips', { returnObjects: true }) as Array<{ text: string; query: string }>;

  const suggestionChips = [
    { icon: Briefcase, ...suggestionChipsData[0] },
    { icon: Code, ...suggestionChipsData[1] },
    { icon: BookOpen, ...suggestionChipsData[2] },
    { icon: Brain, ...suggestionChipsData[3] },
    { icon: Calendar, ...suggestionChipsData[4] },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16">
      <div className="text-center">
        <h2 className="text-lg font-normal text-slate-600 dark:text-muted-foreground mb-7 md:mb-8 lg:mb-10">
          {t('chat.subtitle')}
        </h2>

        {/* Suggestion Chips */}
        <div className="flex justify-center flex-wrap gap-2 sm:gap-4 mb-7 md:mb-8 lg:mb-10">
          {suggestionChips.map((chip, index) => {
            const IconComponent = chip.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                onClick={() => onInsertText(chip.query)}
                className="glass-chip px-2 sm:px-4 py-2 rounded-xl hover:bg-blue-500/20 transition-all duration-200 group border-0 bg-transparent flex items-center space-x-0 sm:space-x-2"
                data-testid={`chip-${chip.text.toLowerCase()}`}
              >
                <IconComponent className="w-4 h-4 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 transition-colors" />
                <span className="hidden sm:inline-block text-sm text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 transition-colors ml-2">
                  {chip.text}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Sample Questions */}
        <div className="space-y-2 max-w-md mx-auto mb-16 text-center">
          {sampleQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => onInsertText(question)}
              className="block w-full text-center px-4 py-3 text-slate-600 dark:text-muted-foreground hover:text-foreground transition-colors text-sm rounded-lg hover:bg-white/5"
              data-testid={`button-sample-question-${index}`}
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChatInterface() {
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleInsertText = (text: string) => {
    if (chatInputRef.current) {
      chatInputRef.current.insertText(text);
    }
  };

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    refetchInterval: false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, fileId, fileName }: { content: string; fileId?: string; fileName?: string }) => {
      const response = await apiRequest("POST", "/api/messages", {
        content,
        isUser: true,
        fileId,
        fileName,
      });
      return response.json();
    },
    onSuccess: (_, { content, fileId, fileName }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });

      // Generate AI response using Pedro's persona
      setIsTyping(true);
      setTimeout(() => {
        sendAssistantResponseMutation.mutate({ content, fileId, fileName });
      }, 1000);
    },
  });

  const sendAssistantResponseMutation = useMutation({
    mutationFn: async ({ content, fileId, fileName }: { content: string; fileId?: string; fileName?: string }) => {
      // Call the OpenAI chat completion endpoint
      const response = await apiRequest("POST", "/api/chat/completion", {
        content,
        fileId,
        fileName,
      });
      return response.json();
    },
    onSuccess: () => {
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: () => {
      setIsTyping(false);
    },
  });

  const handleSendMessage = (content: string, fileId?: string, fileName?: string) => {
    sendMessageMutation.mutate({ content, fileId, fileName });
    // Focus the input after sending message
    if (chatInputRef.current) {
      chatInputRef.current.focus();
    }
  };

  const handleNewConversation = async () => {
    try {
      // Create a new session ID
      const newSessionId = createNewSession();
      console.log('🆕 Starting new conversation with session:', newSessionId);
      
      // Clear messages from backend
      await apiRequest("DELETE", "/api/messages");
      
      // Update the frontend cache
      queryClient.setQueryData(["/api/messages"], []);
      
      // Show success toast
      toast({
        title: t('chat.newConversation', 'New Conversation'),
        description: t('chat.newConversationDesc', 'Started a fresh conversation'),
      });
    } catch (error) {
      console.error("Failed to start new conversation:", error);
      toast({
        title: t('chat.error', 'Error'),
        description: t('chat.errorStartingConversation', 'Failed to start new conversation'),
        variant: "destructive",
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Listen for audio transcription completion
  useEffect(() => {
    const handleAudioTranscription = () => {
      // Refresh messages when audio transcription is complete
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    };

    window.addEventListener('audioTranscriptionComplete', handleAudioTranscription);
    
    return () => {
      window.removeEventListener('audioTranscriptionComplete', handleAudioTranscription);
    };
  }, [queryClient]);

  return (
    <div className="h-screen flex flex-col bg-gradient-dark relative">
      {/* Header Row with New Conversation Button, Title, and Theme Toggle */}
      <header className="flex items-center justify-between p-4 z-10">
        {/* New Conversation Button - Left */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewConversation}
          className="glass-chip hover:bg-blue-500/20 transition-all duration-200 group border-0 bg-transparent"
          data-testid="button-new-conversation"
          title={t('tooltips.newConversation')}
        >
          <Plus className="h-5 w-5 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 group-hover:scale-110 transition-all" />
          <span className="sr-only">{t('tooltips.newConversation')}</span>
        </Button>

        {/* Title - Center */}
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ paddingRight: '4px' }}>
            accessibility_new
          </span>
          {t('chat.title')}
        </h1>

        {/* Settings Dropdown - Right */}
        <SettingsDropdown />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative overflow-hidden">
        {messages.length === 0 && !isLoading ? (
          /* Welcome Screen - Full screen centered */
          <div className="flex-1 pb-48">
            <WelcomeScreen onInsertText={handleInsertText} />
          </div>
        ) : (
          /* Chat Messages */
          <div
            className="flex-1 p-6 pt-6 overflow-y-auto scroll-smooth hide-scrollbar pb-48"
            data-testid="messages-container"
          >
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {isTyping && <TypingIndicator />}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        )}
      </main>

      {/* Chat Input - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <ChatInput
          ref={chatInputRef}
          onSendMessage={handleSendMessage}
          isLoading={sendMessageMutation.isPending}
        />
      </div>
    </div>
  );
}
