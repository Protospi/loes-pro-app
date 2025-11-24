import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import base translation file
// This serves as the default English template that gets dynamically translated
import custom from '../translations/custom.json';

const resources = {
  custom: { translation: custom },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'custom', // default language using custom.json
    fallbackLng: 'custom',
    
    interpolation: {
      escapeValue: false, // react already does escaping
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

// Language change function
// All languages use the 'custom' namespace since we dynamically translate it via OpenAI
// The actual language detection and translation happens server-side
export const changeLanguage = (language: string): string => {
  // All detected languages use 'custom' namespace (dynamically translated)
  const languageCode = 'custom';
  
  // Change the i18n language
  i18n.changeLanguage(languageCode);
  
  // Store the detected language name in localStorage for reference
  localStorage.setItem('detectedLanguage', language);
  
  return languageCode;
};

export default i18n;
