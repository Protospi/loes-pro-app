'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from './i18n';

interface LanguageContextProps {
  currentLanguage: string;
  detectedLanguage: string | null;
  setDetectedLanguage: (language: string) => void;
  isLanguageDetected: boolean;
}

const LanguageContext = createContext<LanguageContextProps>({
  currentLanguage: 'custom',
  detectedLanguage: null,
  setDetectedLanguage: () => {},
  isLanguageDetected: false,
});

export const useLanguage = () => useContext(LanguageContext);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [detectedLanguage, setDetectedLanguageState] = useState<string | null>(null);
  const [isLanguageDetected, setIsLanguageDetected] = useState(false);

  // Force custom as the default language on initialization
  // Note: DynamicTranslationsProvider will load cached translations if they exist
  useEffect(() => {
    i18n.changeLanguage('custom');
  }, [i18n]);

  const setDetectedLanguage = (language: string) => {
    setDetectedLanguageState(language);
    const langCode = changeLanguage(language);
    setIsLanguageDetected(true);
    console.log(`Language detected: ${language}, switched to code: ${langCode}`);
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage: i18n.language,
        detectedLanguage,
        setDetectedLanguage,
        isLanguageDetected,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
