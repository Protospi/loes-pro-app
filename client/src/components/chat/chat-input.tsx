
import { useState, useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from "react";
import { ArrowUp, Mic, Square, Download, Upload, FileInput, FileCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface ChatInputProps {
  onSendMessage: (message: string, fileId?: string, fileName?: string, audio?: boolean) => void;
  isLoading?: boolean;
}

export interface ChatInputRef {
  insertText: (text: string) => void;
  focus: () => void;
}


export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({ onSendMessage, isLoading }, ref) => {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const { t } = useTranslation();
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      setMessage(text);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    focus: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }));

  const focusInput = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Watch for isLoading changes to focus input after assistant response
  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure the UI has updated
      setTimeout(focusInput, 100);
    }
  }, [isLoading, focusInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isLoading) {
      onSendMessage(trimmedMessage, fileId || undefined, fileName || undefined);
      setMessage("");
      // Clear file after sending
      setSelectedFile(null);
      setFileId(null);
      setFileName(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordingDuration = recordingStartTimeRef.current ? Date.now() - recordingStartTimeRef.current : 0;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        console.log('Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
          duration: recordingDuration
        });
        
        // Only send if recording is longer than 500ms and has data
        if (recordingDuration > 500 && audioBlob.size > 0) {
          await sendAudioToServer(audioBlob);
        } else {
          console.log('Recording too short or empty, not sending');
        }
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        recordingStartTimeRef.current = null;
      };

      mediaRecorder.start(100); // Record in 100ms chunks
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();

      // Set 30-second timeout
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 30000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
    }
  };

  const sendAudioToServer = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      console.log('Sending audio to server:', {
        blobSize: audioBlob.size,
        blobType: audioBlob.type
      });

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const data = await response.json();
      console.log('✅ Transcription complete:', data.transcribedText);
      
      // Send the transcribed text as an audio message
      // This will trigger the typing indicator and normal message flow
      if (data.transcribedText && data.transcribedText.trim()) {
        onSendMessage(data.transcribedText.trim(), undefined, undefined, true);
      }
      
    } catch (error) {
      console.error('Error transcribing audio:', error);
      alert('Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicPress = (e: React.PointerEvent) => {
    console.log('🎤 Mic Press - isRecording:', isRecording, 'isTranscribing:', isTranscribing);
    e.preventDefault(); // Prevent default behaviors
    e.stopPropagation(); // Stop event bubbling
    
    if (!isRecording && !isTranscribing) {
      // Capture the pointer to track it even if it moves outside the button
      const target = e.currentTarget as HTMLElement;
      if (target && target.setPointerCapture) {
        try {
          target.setPointerCapture(e.pointerId);
          console.log('✅ Pointer captured:', e.pointerId);
        } catch (err) {
          console.log('❌ Pointer capture not available:', err);
        }
      }
      
      console.log('🎙️ Starting recording...');
      startRecording();
    }
  };

  const handleMicRelease = (e: React.PointerEvent) => {
    console.log('🛑 Mic Release - isRecording:', isRecording);
    e.preventDefault(); // Prevent default behaviors
    e.stopPropagation(); // Stop event bubbling
    
    // Release pointer capture
    const target = e.currentTarget as HTMLElement;
    if (target && target.releasePointerCapture) {
      try {
        target.releasePointerCapture(e.pointerId);
        console.log('✅ Pointer released:', e.pointerId);
      } catch (err) {
        // Pointer might not be captured, ignore
      }
    }
    
    if (isRecording) {
      console.log('⏹️ Stopping recording...');
      stopRecording();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Prevent context menu on long press (especially on mobile)
    e.preventDefault();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadFile(file);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileId(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      setFileId(data.fileId);
      setFileName(file.name); // Store the filename
      console.log('File uploaded successfully:', data);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
      setSelectedFile(null);
      setFileName(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Escape key to cancel recording if in progress
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="glass-input rounded-3xl p-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.txt,.doc,.docx,.md,.json,.csv,.xlsx,.xls,image/*"
          />
          
          {/* Main input area */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="min-h-[80px] flex items-start">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  placeholder={t('input.placeholder')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full min-h-[50px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground text-base leading-relaxed"
                  disabled={isLoading}
                  data-testid="input-message"
                  rows={1}
                  style={{ 
                    height: 'auto',
                    overflowY: 'hidden'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
              </div>
            </div>
            
            {/* File display */}
            {selectedFile && (
              <div className="inline-flex items-center gap-2 p-2 bg-foreground/5 rounded-lg">
                <FileCheck className="w-4 h-4 text-foreground" />
                <span className="text-sm text-foreground truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1 hover:bg-red-500/20 rounded-full transition-colors"
                  title="Remove file"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </div>
            )}
            
            {/* Bottom toolbar */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              {/* Left side - Upload button */}
              <div className="flex items-center">
                <Button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={isLoading || isUploading}
                  className="hover:bg-blue-500/20 transition-all duration-200 group bg-transparent border-0 p-2 rounded-xl"
                  title="Upload file"
                  data-testid="button-upload"
                >
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" style={{width: '18px', height: '18px'}} />
                  ) : (
                    <FileInput className="w-6 h-6 text-gray-700 dark:text-muted-foreground group-hover:text-blue-400 group-hover:scale-110 transition" style={{width: '18px', height: '18px'}} />
                  )}
                </Button>
              </div>
              
              {/* Center - Microphone button */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onPointerDown={handleMicPress}
                  onPointerUp={handleMicRelease}
                  onPointerLeave={handleMicRelease}
                  onPointerCancel={handleMicRelease}
                  onContextMenu={handleContextMenu}
                  disabled={isLoading || isTranscribing}
                  className={`transition-all duration-200 group bg-transparent border-0 p-2 rounded-full touch-none select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording ? 'bg-red-500/20 hover:bg-red-500/30' : isTranscribing ? 'bg-blue-500/20' : 'hover:bg-red-500/20'
                  }`}
                  title="Hold to record audio"
                  data-testid="button-mic"
                  style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                >
                  {isTranscribing ? (
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin pointer-events-none" style={{width: '20px', height: '20px'}} />
                  ) : isRecording ? (
                    <Square className="w-6 h-6 text-red-400 group-hover:text-red-300 transition-colors pointer-events-none" style={{width: '20px', height: '20px'}} />
                  ) : (
                    <Mic className="w-6 h-6 text-gray-700 dark:text-muted-foreground group-hover:text-red-400 group-hover:scale-110 transition pointer-events-none" style={{width: '18px', height: '18px'}} />
                  )}
                </button>
                {/* Status messages */}
                {isRecording && (
                  <span className="text-xs text-red-400 ml-2 animate-pulse">
                    {t('input.recording')}
                  </span>
                )}
                {isTranscribing && !isRecording && (
                  <span className="text-xs text-blue-400 ml-2">
                    {t('input.transcribing')}
                  </span>
                )}
              </div>
              
              {/* Right side - Submit button */}
              <div className="flex items-center">
                <Button
                  type="submit"
                  disabled={!message.trim() || isLoading}
                  className="hover:bg-blue-500/20 transition-all duration-200 group bg-transparent border-0 p-2 rounded-xl"
                  data-testid="button-send"
                >
                  <ArrowUp className="w-6 h-6 text-gray-700 dark:text-muted-foreground group-hover:scale-110 transition" style={{width: '21px', height: '21px'}} />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

ChatInput.displayName = "ChatInput";
