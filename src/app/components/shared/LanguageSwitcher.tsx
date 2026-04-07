import { useLanguage, SUPPORTED_LANGUAGES } from '../../hooks/useLanguage';

interface Props {
  /** compact = just the pill (for header), full = shows language name (for mobile menu) */
  variant?: 'compact' | 'full';
}

export function LanguageSwitcher({ variant = 'compact' }: Props) {
  const { language, changeLanguage } = useLanguage();

  if (variant === 'full') {
    return (
      <div className="flex items-center gap-1">
        {SUPPORTED_LANGUAGES.map(({ code, label, name }) => (
          <button
            key={code}
            onClick={() => changeLanguage(code)}
            title={name}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              language === code
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                : 'text-white/40 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  // compact pill — used in desktop header
  return (
    <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10">
      {SUPPORTED_LANGUAGES.map(({ code, label, name }) => (
        <button
          key={code}
          onClick={() => changeLanguage(code)}
          title={name}
          className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
            language === code
              ? 'bg-purple-600 text-white shadow shadow-purple-900/60'
              : 'text-white/35 hover:text-white/70'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
