import { useTranslation } from 'react-i18next';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English',   dir: 'ltr' as const },
  { code: 'fr', label: 'FR', name: 'Français',  dir: 'ltr' as const },
  { code: 'ar', label: 'AR', name: 'العربية',   dir: 'rtl' as const },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export function useLanguage() {
  const { i18n } = useTranslation();

  const changeLanguage = (lang: LangCode) => {
    i18n.changeLanguage(lang);
    try { localStorage.setItem('fastoosh_lang', lang); } catch { /* ignore */ }
  };

  const isRTL     = i18n.language === 'ar';
  const language  = i18n.language as LangCode;

  return { language, changeLanguage, isRTL, languages: SUPPORTED_LANGUAGES };
}
