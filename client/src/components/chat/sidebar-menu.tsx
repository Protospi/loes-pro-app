import React, { useState } from "react";
import { Menu, Server, BarChart3, Sun, Moon, Globe, X } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarMenuProps {
  renderButton?: (props: { onClick: () => void; isOpen: boolean }) => React.ReactNode;
}

export function SidebarMenu({ renderButton }: SidebarMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  const handleServerClick = () => {
    setLocation("/server");
    setIsOpen(false);
  };

  const handleChatClick = () => {
    setLocation("/chat");
    setIsOpen(false);
  };

  const handleAnalyticsClick = () => {
    setLocation("/analytics");
    setIsOpen(false);
  };

  const handleTranslationClick = () => {
    setLocation("/");
    setIsOpen(false);
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const menuItems = [
    {
      icon: (
        <span className="material-symbols-outlined" style={{ fontSize: '23px' }}>
          accessibility_new
        </span>
      ),
      label: t('settings.chat', 'Chat'),
      onClick: handleChatClick,
      active: location === "/chat"
    },
    {
      icon: <Server className="h-5 w-5" />,
      label: t('settings.server', 'Server'),
      onClick: handleServerClick,
      active: location === "/server"
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: t('settings.analytics', 'Analytics'),
      onClick: handleAnalyticsClick,
      active: location === "/analytics"
    },
    {
      icon: <Globe className="h-5 w-5" />,
      label: t('settings.translation', 'Language'),
      onClick: handleTranslationClick,
      active: location === "/"
    },
    {
      icon: theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />,
      label: t('settings.theme', theme === "light" ? "Dark Mode" : "Light Mode"),
      onClick: () => {
        toggleTheme();
        if (isMobile) setIsOpen(false);
      },
      active: false
    }
  ];

  // Mobile: Use dropdown menu
  if (isMobile) {
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
            <Menu className="h-5 w-5 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 group-hover:scale-110 transition-all" />
            <span className="sr-only">{t('tooltips.settings')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="glass-chip border-0 bg-white/10 backdrop-blur-md p-0 w-10 min-w-0"
          align="start"
          sideOffset={8}
        >
          <div className="flex flex-col">
            {menuItems.map((item, index) => (
              <DropdownMenuItem 
                key={index}
                onClick={item.onClick}
                className="flex items-center justify-center w-10 h-10 text-slate-600 dark:text-muted-foreground hover:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer rounded-none"
                title={item.label}
              >
                {item.icon}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop: Use sidebar panel
  return (
    <>
      {/* Hamburger Button - can be customized or use default */}
      {renderButton ? (
        renderButton({ onClick: toggleSidebar, isOpen })
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="glass-chip hover:bg-blue-500/20 transition-all duration-200 group border-0 bg-transparent"
          data-testid="button-hamburger-menu"
          title={t('tooltips.settings')}
        >
          {isOpen ? (
            <X className="h-5 w-5 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 group-hover:scale-110 transition-all" />
          ) : (
            <Menu className="h-5 w-5 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400 group-hover:scale-110 transition-all" />
          )}
          <span className="sr-only">{t('tooltips.settings')}</span>
        </Button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          data-testid="sidebar-backdrop"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 glass-chip backdrop-blur-xl bg-white/10 dark:bg-black/30 border-r border-white/20 shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } w-72`}
        data-testid="sidebar-panel"
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
              menu_open
            </span>
            {t('settings.menu', 'Menu')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="hover:bg-blue-500/20 transition-all duration-200 group"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-muted-foreground group-hover:text-blue-400" />
          </Button>
        </div>

        {/* Menu Items */}
        <nav className="flex flex-col p-2 mt-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                item.active
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-slate-600 dark:text-muted-foreground hover:bg-blue-500/10 hover:text-blue-400"
              }`}
              data-testid={`sidebar-item-${item.label.toLowerCase()}`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20">
          <div className="text-xs text-center text-slate-500 dark:text-muted-foreground/60">
            {t('settings.version', 'Version')} 1.0.0
          </div>
        </div>
      </aside>
    </>
  );
}

