// Admin: where a lead came from (site / campaign, landing page) and the pages
// they viewed before sending the form. Data from utils/attribution.
import { ArrowRight, Globe, MapPin } from 'lucide-react';
import { sourceLabel, type Attribution } from '../../utils/attribution';

export function LeadSourceBadge({ a }: { a?: Attribution | null }) {
  const label = sourceLabel(a);
  if (!label) return <span className="text-white/15">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-white/70 whitespace-nowrap">
      <Globe className="w-3 h-3 text-purple-300" /> {label}
    </span>
  );
}

export function LeadJourney({ a }: { a?: Attribution | null }) {
  if (!a || (!a.landingPage && !a.pages?.length && !a.referrer && !a.utmSource)) {
    return <p className="text-xs text-white/25">No source recorded (sent before source tracking was added, or the browser blocked storage).</p>;
  }
  const pages = (a.pages || []).filter(Boolean);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/45">
        <span>Came from: <LeadSourceBadge a={a} /></span>
        {a.referrer && <span>Referrer: <span className="text-white/70 break-all">{a.referrer}</span></span>}
        {a.landingPage && <span><MapPin className="w-3 h-3 inline mr-1" />First page: <span className="text-white/70">{a.landingPage}</span></span>}
        {a.firstSeen && <span>First visit: <span className="text-white/70">{new Date(a.firstSeen).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>}
      </div>
      {pages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-white/35 mr-1">Pages this visit:</span>
          {pages.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <a href={p} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/65 hover:text-white">{p}</a>
              {i < pages.length - 1 && <ArrowRight className="w-3 h-3 text-white/20" />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
