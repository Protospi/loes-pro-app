import { useTranslation } from "react-i18next";
import { Plus, Server, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDropdown } from "@/components/chat/settings-dropdown";
import ReactFlowCanvas, { ReactFlowCanvasRef, ConversationFlowItem } from "@/components/server/reactFlow";
import ConversationLogs, { ConversationLogsRef } from "@/components/server/conversationLogs";
import { useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { createNewSession } from "@/lib/sessionManager";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export default function ServerView() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reactFlowRef = useRef<ReactFlowCanvasRef>(null);
  const conversationLogsRef = useRef<ConversationLogsRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLogIndex, setActiveLogIndex] = useState(-1);
  const [refreshKey, setRefreshKey] = useState(0);
  const playbackTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const handleNewConversation = async () => {
    try {
      // Stop any ongoing playback
      if (isPlaying) {
        reactFlowRef.current?.stopPlayback();
        conversationLogsRef.current?.clearActiveLogs();
        playbackTimeoutsRef.current.forEach(clearTimeout);
        playbackTimeoutsRef.current = [];
        setActiveLogIndex(-1);
        setIsPlaying(false);
      }

      // Create a new session ID
      const newSessionId = createNewSession();
      console.log('🆕 Starting new conversation with session:', newSessionId);
      
      // Clear messages from backend
      await apiRequest("DELETE", "/api/messages");
      
      // Invalidate queries to refresh both chat and server view data
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      
      // Force refresh the ConversationLogs component by updating the key
      setRefreshKey(prev => prev + 1);
      
      // Show success toast
      toast({
        title: t('server.newConversation', 'New Conversation'),
        description: t('server.newConversationDesc', 'Started a fresh conversation'),
      });
    } catch (error) {
      console.error("Failed to start new conversation:", error);
      toast({
        title: t('server.error', 'Error'),
        description: t('server.errorStartingConversation', 'Failed to start new conversation'),
        variant: "destructive",
      });
    }
  };

  const handlePlayConversation = async () => {
    if (isPlaying) {
      // Stop playback
      reactFlowRef.current?.stopPlayback();
      conversationLogsRef.current?.clearActiveLogs();
      playbackTimeoutsRef.current.forEach(clearTimeout);
      playbackTimeoutsRef.current = [];
      setActiveLogIndex(-1);
      setIsPlaying(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch conversation flow from API
      console.log('🔄 Fetching conversation flow for current session...');
      const response = await apiRequest('GET', '/api/conversation-flow');
      const data = await response.json();
      const { conversationFlow } = data;
      console.log('📊 Received conversation flow:', conversationFlow?.length || 0, 'events');
      
      if (!conversationFlow || conversationFlow.length === 0) {
        toast({
          title: t('server.noConversation', 'No Conversation Found'),
          description: t('server.noConversationDesc', 'There are no recorded conversations to play back.'),
          variant: "destructive",
        });
        return;
      }
      
      console.log('📊 Fetched conversation flow:', conversationFlow);
      
      // Start playback for both ReactFlow and ConversationLogs
      setIsPlaying(true);
      reactFlowRef.current?.playConversationFlow(conversationFlow as ConversationFlowItem[]);
      
      // Sync ConversationLogs playback with 2 second intervals
      conversationFlow.forEach((item: any, index: number) => {
        const timeout = setTimeout(() => {
          setActiveLogIndex(index);
        }, index * 2000);
        playbackTimeoutsRef.current.push(timeout);
      });
      
      toast({
        title: t('server.playbackStarted', 'Playback Started'),
        description: t('server.playbackStartedDesc', `Playing back ${conversationFlow.length} conversation events`),
      });
      
    } catch (error) {
      console.error('Error fetching conversation flow:', error);
      toast({
        title: t('server.error', 'Error'),
        description: t('server.errorDesc', 'Failed to load conversation flow'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaybackComplete = useCallback(() => {
    // Clear all timeouts
    playbackTimeoutsRef.current.forEach(clearTimeout);
    playbackTimeoutsRef.current = [];
    
    // Reset states
    setIsPlaying(false);
    setActiveLogIndex(-1);
    conversationLogsRef.current?.clearActiveLogs();
    
    toast({
      title: t('server.playbackComplete', 'Playback Complete'),
      description: t('server.playbackCompleteDesc', 'Conversation replay has finished'),
    });
  }, [t, toast]);

  return (
    <div className="h-screen flex flex-col bg-gradient-dark relative">
      {/* Header Row with New Conversation Button, Title, and Settings Dropdown */}
      <header className="flex items-center justify-between p-4 z-10 flex-shrink-0">
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
          <Server className="h-5 w-5 text-blue-500" />
          {t('server.title', 'Server View')}
        </h1>

        {/* Settings Dropdown - Right */}
        <SettingsDropdown />
      </header>

      {/* Main Content Area - Vertical Layout */}
      <main className="flex-1 flex flex-col gap-4 p-4 pt-0 overflow-hidden max-w-6xl mx-auto w-full">
        {/* React Flow Canvas Section - Top Row */}
        <section className="flex flex-col h-80">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              {t('server.flowCanvas.title', 'Agent Architecture')}
            </h2>
            
            {/* Play/Stop Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayConversation}
              disabled={isLoading}
              className="glass-chip hover:bg-purple-500/20 transition-all duration-200 group border-0 bg-transparent"
              title={isPlaying ? t('server.stopPlayback', 'Stop Playback') : t('server.playConversation', 'Play Conversation')}
            >
              {isPlaying ? (
                <Square className="h-5 w-5 text-purple-500 group-hover:text-purple-400 group-hover:scale-110 transition-all" />
              ) : (
                <Play className="h-5 w-5 text-purple-500 group-hover:text-purple-400 group-hover:scale-110 transition-all" />
              )}
              <span className="sr-only">
                {isPlaying ? t('server.stopPlayback', 'Stop Playback') : t('server.playConversation', 'Play Conversation')}
              </span>
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <ReactFlowCanvas ref={reactFlowRef} onPlaybackComplete={handlePlaybackComplete} />
          </div>
        </section>

        {/* Conversation Logs Section - Bottom Row */}
        <section className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t('server.logs.title', 'Conversation Logs')}
            </h2>
          </div>
          <div className="flex-1 min-h-0 glass-chip rounded-xl overflow-hidden">
            <div className="h-full overflow-y-auto scroll-smooth conversation-logs-scroll">
              <ConversationLogs key={refreshKey} ref={conversationLogsRef} activeLogIndex={activeLogIndex} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
