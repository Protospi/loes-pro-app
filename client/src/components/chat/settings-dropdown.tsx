import { Settings, Server, BarChart3, Sun, Moon, MessageCircle, AccessibilityIcon, Globe } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

export function SettingsDropdown() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const handleServerClick = () => {
    setLocation("/server");
  };

  const handleChatClick = () => {
    setLocation("/chat");
  };

  const handleAnalyticsClick = () => {
    setLocation("/analytics");
  };

  const handleTranslationClick = () => {
    setLocation("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="glass-chip hover:bg-blue-500/20 transition-all duration-200 group border-0 bg-transparent focus:outline-none focus:ring-0 focus:border-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0 focus-visible:shadow-none"
          data-testid="button-settings"
          title={t('tooltips.settings')}
        >
          <Settings className="h-5 w-5 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 group-hover:scale-110 transition-all" />
          <span className="sr-only">{t('tooltips.settings')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-10 glass-chip border-0 bg-white/10 backdrop-blur-md p-0 min-w-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex flex-col">
          <DropdownMenuItem 
            onClick={handleChatClick}
            className="flex items-center justify-center w-10 h-10 text-slate-600 dark:text-muted-foreground hover:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer rounded-none"
            title={t('settings.chat')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '23px' }}>
              accessibility_new
            </span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={handleServerClick}
            className="flex items-center justify-center w-10 h-10 text-slate-600 dark:text-muted-foreground hover:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer rounded-none"
            title={t('settings.server')}
          >
            <Server className="h-4 w-4" />
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={handleAnalyticsClick}
            className="flex items-center justify-center w-10 h-10 text-slate-600 dark:text-muted-foreground hover:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer rounded-none"
            title={t('settings.analytics')}
          >
            <BarChart3 className="h-4 w-4" />
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={handleTranslationClick}
            className="flex items-center justify-center w-10 h-10 text-slate-600 dark:text-muted-foreground hover:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer rounded-none"
            title={t('settings.translation')}
          >
            <Globe className="h-4 w-4" />
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={toggleTheme}
            className="flex items-center justify-center w-10 h-10 text-slate-600 dark:text-muted-foreground hover:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer rounded-none"
            title={t('settings.theme')}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
