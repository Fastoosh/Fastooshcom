import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface AdminSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra classes applied to the dropdown list panel */
  listClassName?: string;
}

export function AdminSelect({
  value,
  onChange,
  options,
  placeholder = '— Select —',
  disabled = false,
  className = '',
  listClassName = '',
}: AdminSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        className={[
          'flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-lg text-sm',
          'bg-white/5 border border-white/10 text-white',
          'focus:outline-none focus:border-purple-500/50',
          'transition-colors',
          open ? 'border-purple-500/50 bg-white/8' : 'hover:bg-white/8 hover:border-white/20',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <span className={selected ? 'text-white' : 'text-white/40'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 text-white/40 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className={[
            'absolute z-50 mt-1 w-full min-w-[10rem]',
            'rounded-xl border border-white/10 bg-[#1a1025] shadow-xl shadow-black/60',
            'overflow-hidden',
            listClassName,
          ].join(' ')}
        >
          <ul className="max-h-60 overflow-y-auto py-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={[
                    'flex items-center justify-between w-full px-3 py-2 text-sm text-left',
                    'transition-colors cursor-pointer',
                    opt.value === value
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-white/80 hover:bg-white/8 hover:text-white',
                  ].join(' ')}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && (
                    <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 ml-2" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
