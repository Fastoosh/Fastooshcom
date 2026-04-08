import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';

/**
 * Get saved language from localStorage.
 * ALWAYS defaults to English if no language is saved.
 * Browser language detection is disabled.
 */
function getSavedLang(): string {
  try {
    const saved = localStorage.getItem('fastoosh_lang');
    // Only use saved language if user explicitly changed it, otherwise English
    return saved || 'en';
  } catch {
    return 'en';
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng: getSavedLang(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    // Disable browser language detection - always use saved or default (English)
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    },
  });

// Apply direction + lang attribute immediately on init
const applyDocAttrs = (lang: string) => {
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
};
applyDocAttrs(getSavedLang());
i18n.on('languageChanged', applyDocAttrs);


export default i18n;