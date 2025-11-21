import { BotMessageSquare, User, FileText, Image as ImageIcon, Play, Pause } from "lucide-react";
import { Message } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useRef, useEffect } from "react";

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

  // TTS state management
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate TTS
  const handleGenerateTTS = async () => {
    if (audioUrl || isGeneratingTTS) return; // Already generated or generating
    
    setIsGeneratingTTS(true);
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: message.content }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Create audio element
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.onplay = () => {
        setIsPlaying(true);
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
      };

      // Auto-play the audio with proper error handling
      try {
        await audio.play();
      } catch (playError) {
        // If autoplay is blocked by browser, just set up the audio for manual play
        console.log('Autoplay blocked, audio ready for manual play:', playError);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error generating speech:', error);
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  // Toggle play/pause
  const handleTogglePlayback = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setIsPlaying(false);
    }
  };

  // Revoke object URLs whenever they change
  useEffect(() => {
    if (!audioUrl) return;

    return () => {
      URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Pause audio only when the component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            
            {/* TTS Button */}
            <button
              onClick={handleGenerateTTS}
              disabled={isGeneratingTTS || audioUrl !== null}
              className={`text-muted-foreground/70 hover:text-muted-foreground transition-colors ${
                (isGeneratingTTS || audioUrl) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title="Text to speech"
            >
              <span className="material-symbols-outlined text-base">
                {isGeneratingTTS ? 'hourglass_empty' : 'text_to_speech'}
              </span>
            </button>

            {/* Play/Pause Button - Only show after audio is generated */}
            {audioUrl && (
              <button
                onClick={handleTogglePlayback}
                className="text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer"
                title={isPlaying ? 'Pause audio' : 'Play audio'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
