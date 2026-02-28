import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../hooks/useLanguage";

interface Month {
  key: string;
  month: string;
  year: number;
  status: 'available' | 'busy' | 'booked';
  message?: string;
}

interface AvailabilityBadgeProps {
  status?: 'available' | 'busy' | 'booked';
  message?: string;
  months?: Month[];
  firstAvailable?: string | null;
}

export function AvailabilityBadge({ 
  status = 'available', 
  message,
  months = [],
  firstAvailable
}: AvailabilityBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Status colors and icons
  const statusConfig = {
    available: { 
      color: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-400',
      glow: 'rgba(52, 211, 153, 0.2)',
      glowStrong: 'rgba(52, 211, 153, 0.3)',
      defaultMessage: t('availability.defaultMessageAvailable'),
      label: t('availability.available')
    },
    busy: { 
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-400',
      glow: 'rgba(251, 191, 36, 0.2)',
      glowStrong: 'rgba(251, 191, 36, 0.3)',
      defaultMessage: t('availability.defaultMessageBusy'),
      label: t('availability.busy')
    },
    booked: { 
      color: 'from-red-400 to-rose-500',
      bgColor: 'bg-red-500/20',
      textColor: 'text-red-400',
      glow: 'rgba(248, 113, 113, 0.2)',
      glowStrong: 'rgba(248, 113, 113, 0.3)',
      defaultMessage: t('availability.defaultMessageBooked'),
      label: t('availability.booked')
    }
  };

  const config = statusConfig[status] || statusConfig.available;
  const displayMessage = message || config.defaultMessage;
  const hasAvailableSlots = months.some(m => m.status === 'available');

  // Localized month names
  const getLocalizedMonth = (month: Month) => {
    const date = new Date(month.year, new Date(`${month.month} 1, ${month.year}`).getMonth(), 1);
    return date.toLocaleDateString(i18n.language, { month: 'long' });
  };

  // Build a fully-localized "next available" label from the months array
  // so the month name renders in the active language (FR, AR, etc.)
  const firstAvailableMonth = months.find(m => m.status === 'available');
  const localizedFirstAvailable = firstAvailableMonth
    ? `${getLocalizedMonth(firstAvailableMonth)} ${firstAvailableMonth.year}`
    : firstAvailable ?? null;

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Badge */}
      <motion.div
        className={`inline-flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''} px-4 py-2 rounded-full backdrop-blur-xl bg-white/5 border border-white/20 cursor-pointer`}
        initial={false}
        animate={!reduceMotion ? {
          boxShadow: [
            `0 0 20px ${config.glow}`,
            `0 0 30px ${config.glowStrong}`,
            `0 0 20px ${config.glow}`,
          ]
        } : undefined}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.02 }}
      >
        <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.color} animate-pulse`} />
        <span className="text-sm text-white/90">{displayMessage}</span>
        <Calendar className="w-3.5 h-3.5 text-white/60" />
      </motion.div>

      {/* Hover Tooltip with Monthly Breakdown */}
      <AnimatePresence>
        {isHovered && months.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute top-full ${isRTL ? 'right-1/2 translate-x-1/2' : 'left-1/2 -translate-x-1/2'} mt-3 z-50 w-80`}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Arrow */}
            <div className={`absolute -top-2 ${isRTL ? 'right-1/2 translate-x-1/2' : 'left-1/2 -translate-x-1/2'} w-4 h-4 rotate-45 bg-white/10 backdrop-blur-xl border-t border-l border-white/20`} />
            
            {/* Tooltip Content */}
            <div className={`relative backdrop-blur-xl bg-black/80 border border-white/20 rounded-2xl p-5 shadow-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
              {/* Header */}
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''} mb-4 pb-3 border-b border-white/10`}>
                <Calendar className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">{t('availability.calendarTitle')}</h3>
              </div>

              {/* Month List */}
              <div className="space-y-2 mb-4">
                {months.map((month) => {
                  const monthConfig = statusConfig[month.status];
                  const localizedMonth = getLocalizedMonth(month);
                  return (
                    <motion.div
                      key={month.key}
                      initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''} p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors`}
                    >
                      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''} flex-1`}>
                        <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${monthConfig.color} flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">
                            {localizedMonth} {month.year}
                          </div>
                          {month.message && (
                            <div className={`text-xs text-white/60 truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                              {month.message}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${monthConfig.bgColor} ${monthConfig.textColor} whitespace-nowrap`}>
                        {monthConfig.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* CTA Button */}
              {hasAvailableSlots ? (
                <>
                  {firstAvailable && (
                    <div className={`text-sm text-white/70 mb-3 text-center ${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className="text-green-400 font-medium">{t('availability.nextAvailable')}:</span> {localizedFirstAvailable}
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/work-with-us')}
                    className={`w-full group relative px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]`}
                  >
                    <span className={`relative z-10 flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {t('availability.bookProject')}
                      <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''} group-hover:${isRTL ? '-translate-x-1' : 'translate-x-1'} transition-transform`} />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </>
              ) : (
                <div className={`text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-sm text-red-400 font-medium">{t('availability.fullyBookedTitle')}</p>
                  <p className="text-xs text-white/60 mt-1">{t('availability.fullyBookedSubtitle')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}