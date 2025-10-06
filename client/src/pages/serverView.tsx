import { useTranslation } from "react-i18next";
import { Plus, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDropdown } from "@/components/chat/settings-dropdown";
import ReactFlowCanvas from "@/components/server/reactFlow";
import ConversationLogs from "@/components/server/conversationLogs";

export default function ServerView() {
  const { t } = useTranslation();

  const handleNewConversation = async () => {
    // TODO: Implement new conversation functionality for server view
    console.log("New conversation clicked in server view");
  };

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
          <div className="flex items-center mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              {t('server.flowCanvas.title', 'Agent Architecture')}
            </h2>
          </div>
          <div className="flex-1 min-h-0">
            <ReactFlowCanvas />
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
              <ConversationLogs />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
