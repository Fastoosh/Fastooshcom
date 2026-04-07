import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  iconOptions: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  defaultIcon?: string;
}

export function IconPicker({
  value,
  onChange,
  iconOptions,
  placeholder = 'Select Icon',
  disabled = false,
  className = '',
  defaultIcon = 'Download',
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Compute portal position whenever the dropdown opens
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 320), // Minimum width for grid
      zIndex: 9999,
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsidePortal = (target as Element)?.closest?.('[data-icon-picker-portal]');
      if (!isInsideContainer && !isInsidePortal) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape or scroll (but not when scrolling inside the dropdown)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = (e: Event) => {
      const target = e.target as Node;
      const isInsidePortal = (target as Element)?.closest?.('[data-icon-picker-portal]');
      if (!isInsidePortal) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Get the icon component
  const getIcon = (iconName: string) => {
    if (!iconName) return null;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  const selectedIcon = value || '';
  const displayIcon = selectedIcon || defaultIcon;

  const dropdown = open && createPortal(
    <div
      data-icon-picker-portal=""
      style={dropdownStyle}
      className="rounded-xl border border-white/10 bg-[#1a1025] shadow-xl shadow-black/60 overflow-hidden"
    >
      <div className="max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {/* Default/Clear option */}
        <div className="border-b border-white/10 p-2">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className={[
              'flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg',
              'transition-colors cursor-pointer',
              !selectedIcon
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-white/60 hover:bg-white/8 hover:text-white',
            ].join(' ')}
          >
            <X className="w-3.5 h-3.5" />
            <span>Default ({defaultIcon})</span>
          </button>
        </div>

        {/* Icon grid */}
        <div className="grid grid-cols-6 gap-1 p-2">
          {iconOptions.map((iconName) => {
            const IconComponent = (LucideIcons as any)[iconName];
            if (!IconComponent) return null;

            return (
              <button
                key={iconName}
                type="button"
                onClick={() => {
                  onChange(iconName);
                  setOpen(false);
                }}
                className={[
                  'flex flex-col items-center justify-center gap-1 p-2 rounded-lg',
                  'transition-all cursor-pointer group',
                  selectedIcon === iconName
                    ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-400/50'
                    : 'text-white/60 hover:bg-white/8 hover:text-white hover:scale-105',
                ].join(' ')}
                title={iconName}
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-[9px] leading-tight text-center truncate w-full">
                  {iconName}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={buttonRef}
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
        <span className="flex items-center gap-2">
          {getIcon(displayIcon)}
          <span className={selectedIcon ? 'text-white' : 'text-white/40'}>
            {selectedIcon || placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 text-white/40 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown rendered in a portal */}
      {dropdown}
    </div>
  );
}
