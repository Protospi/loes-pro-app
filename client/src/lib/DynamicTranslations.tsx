import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getSessionId } from './sessionManager';

interface DynamicTranslationsContextType {
  updateTranslations: (translatedContent: any) => void;
  isUpdating: boolean;
  isLoadingCache: boolean;
}

const DynamicTranslationsContext = createContext<DynamicTranslationsContextType | undefined>(undefined);

interface DynamicTranslationsProviderProps {
  children: ReactNode;
}

export function DynamicTranslationsProvider({ children }: DynamicTranslationsProviderProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const { i18n } = useTranslation();

  // Check cache on mount to restore user's language preference
  useEffect(() => {
    const loadCachedTranslations = async () => {
      try {
        const sessionId = getSessionId();
        console.log('🔍 Checking translation cache for session:', sessionId);
        
        const response = await fetch('/api/translations/cache', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Loaded cached translation on app mount:', data.language);
          console.log('📦 Translation data sample:', JSON.stringify(data.translatedContent?.chat?.title));
          
          if (data.translatedContent) {
            // Remove old bundle first to ensure clean replacement
            if (i18n.hasResourceBundle('custom', 'translation')) {
              i18n.removeResourceBundle('custom', 'translation');
            }
            
            // Add new translations
            i18n.addResourceBundle('custom', 'translation', data.translatedContent, true, true);
            
            // Force i18n to reload the language
            const currentLang = i18n.language;
            await i18n.changeLanguage('en'); // temp switch
            await i18n.changeLanguage(currentLang); // switch back to force reload
            
            console.log('🌐 Restored language preference:', data.language);
            console.log('🔄 i18n reloaded with cached translations');
          }
        } else {
          console.log('ℹ️ No cached translation found on app mount');
        }
      } catch (error) {
        console.error('❌ Failed to load cached translations on mount:', error);
      } finally {
        setIsLoadingCache(false);
      }
    };

    loadCachedTranslations();
  }, [i18n]);

  const updateTranslations = async (translatedContent: any) => {
    try {
      setIsUpdating(true);
      
      // Remove old bundle first to ensure clean replacement
      if (i18n.hasResourceBundle('custom', 'translation')) {
        i18n.removeResourceBundle('custom', 'translation');
      }
      
      // Add new translations
      i18n.addResourceBundle('custom', 'translation', translatedContent, true, true);
      
      // Force i18n to reload
      const currentLang = i18n.language;
      await i18n.changeLanguage('en'); // temp switch
      await i18n.changeLanguage(currentLang); // switch back to force reload
      
      console.log('✅ Dynamic translations updated successfully');
    } catch (error) {
      console.error('Failed to update dynamic translations:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DynamicTranslationsContext.Provider value={{ updateTranslations, isUpdating, isLoadingCache }}>
      {/* Show children immediately - translations will update seamlessly when cache loads */}
      {children}
    </DynamicTranslationsContext.Provider>
  );
}

export function useDynamicTranslations() {
  const context = useContext(DynamicTranslationsContext);
  if (context === undefined) {
    throw new Error('useDynamicTranslations must be used within a DynamicTranslationsProvider');
  }
  return context;
}
