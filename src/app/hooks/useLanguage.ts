import { useTranslation } from 'react-i18next';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English',   dir: 'ltr' as const },
  { code: 'fr', label: 'FR', name: 'Français',  dir: 'ltr' as const },
  { code: 'ar', label: 'AR', name: 'العربية',   dir: 'rtl' as const },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

/** Duration of the fade-out in ms.  Must match the CSS transition. */
const FADE_DURATION = 100;

export function useLanguage() {
  const { i18n } = useTranslation();

  const changeLanguage = (lang: LangCode) => {
    // 1. Fade out — CSS sees .lang-switching on <html>
    document.documentElement.classList.add('lang-switching');

    // 2. After the fade-out completes, swap the language
    setTimeout(() => {
      i18n.changeLanguage(lang);
      try { localStorage.setItem('fastoosh_lang', lang); } catch { /* ignore */ }

      // 3. Let React flush the re-render, then fade back in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.remove('lang-switching');
        });
      });
    }, FADE_DURATION);
  };

  const isRTL     = i18n.language === 'ar';
  const language  = i18n.language as LangCode;

  return { language, changeLanguage, isRTL, languages: SUPPORTED_LANGUAGES };
}