import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

export function FontSelector({ 
  value, 
  fonts, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  fonts: string[]; 
  onChange: (font: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredFonts = fonts.filter(f => 
    f.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      // Add custom font
      onChange(search.trim());
      setIsOpen(false);
      setSearch('');
    }
  };

  const addCustomFont = () => {
    if (search.trim()) {
      onChange(search.trim());
      setIsOpen(false);
      setSearch('');
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Selected font display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-left text-white hover:bg-white/8 hover:border-white/20 transition-all flex items-center justify-between group"
      >
        <span
          className="font-medium text-sm truncate"
          style={{ fontFamily: `'${value}', sans-serif` }}
        >
          {value || placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/40 group-hover:text-white/60"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full bg-[#0f0519] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            {/* Search / Add Custom */}
            <div className="p-2 border-b border-white/8">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search or type custom font name..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-20 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  onClick={e => e.stopPropagation()}
                />
                {search.trim() && filteredFonts.length === 0 && (
                  <button
                    onClick={addCustomFont}
                    className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] rounded transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                )}
              </div>
              {search.trim() && filteredFonts.length === 0 && (
                <p className="text-emerald-400/70 text-[10px] mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Press Enter or click "Add" to use custom font
                </p>
              )}
            </div>

            {/* Font list */}
            <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {filteredFonts.length === 0 && !search.trim() ? (
                <div className="px-4 py-6 text-center text-white/30 text-xs">
                  No fonts found
                </div>
              ) : filteredFonts.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="text-white/50 text-xs mb-2">
                    No preset fonts match "{search}"
                  </div>
                  <div className="text-white/30 text-[10px]">
                    Click "Add" or press Enter to use this as a custom Google Font
                  </div>
                </div>
              ) : (
                filteredFonts.map(font => (
                  <button
                    key={font}
                    onClick={() => {
                      onChange(font);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-white/8 transition-all border-b border-white/5 last:border-0 flex items-center justify-between group ${
                      value === font ? 'bg-violet-600/20' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-white text-sm font-medium truncate mb-0.5"
                        style={{ fontFamily: `'${font}', sans-serif` }}
                      >
                        {font}
                      </div>
                      <div
                        className="text-white/40 text-xs"
                        style={{ fontFamily: `'${font}', sans-serif` }}
                      >
                        AaBbCc 123
                      </div>
                    </div>
                    {value === font && (
                      <Check className="w-4 h-4 text-violet-400 flex-shrink-0 ml-2" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 bg-white/3 border-t border-white/8 flex items-center justify-between">
              <span className="text-white/25 text-[10px]">
                {search ? `${filteredFonts.length} match${filteredFonts.length !== 1 ? 'es' : ''}` : `${fonts.length} preset fonts`}
              </span>
              <a 
                href="https://fonts.google.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-violet-400/70 hover:text-violet-400 text-[10px] flex items-center gap-1"
              >
                Browse Google Fonts
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
