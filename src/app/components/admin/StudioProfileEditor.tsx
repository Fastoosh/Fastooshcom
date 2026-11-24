// "Studio facts" — short, plain statements about Fastoosh that search engines
// and AI assistants (ChatGPT, Claude, Gemini, Perplexity) can quote. Saved as
// the site setting `studioProfile` and used by:
//   • the About page (visible "Studio facts" + FAQ sections)
//   • the prerendered pages, structured data and /llms.txt (scripts/prerender.mjs)
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';

export interface StudioProfile {
  oneLiner?: string;
  location?: string;
  founded?: string;
  services?: string[];
  industries?: string[];
  languages?: string;
  areaServed?: string;
  faq?: { q: string; a: string }[];
}

const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
const field = 'bg-black/50 border-white/20 text-white';
const area = 'w-full rounded-md bg-black/50 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500';

export function StudioProfileEditor({ value, onChange }: { value?: StudioProfile; onChange: (v: StudioProfile) => void }) {
  const v = value || {};
  const set = (patch: Partial<StudioProfile>) => onChange({ ...v, ...patch });
  const faq = v.faq || [];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">One-sentence description</label>
        <Input
          placeholder="Fastoosh is a remote motion design studio making brand, event and product videos, plus After Effects tools."
          value={v.oneLiner || ''}
          onChange={e => set({ oneLiner: e.target.value })}
          className={field}
        />
        <p className="text-xs text-gray-500 mt-1">The sentence an AI assistant would use to describe you. Plain and factual works best.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Based in</label>
          <Input placeholder="Casablanca, Morocco" value={v.location || ''} onChange={e => set({ location: e.target.value })} className={field} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Founded (year)</label>
          <Input placeholder="2019" value={v.founded || ''} onChange={e => set({ founded: e.target.value })} className={field} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Clients served</label>
          <Input placeholder="Worldwide (remote)" value={v.areaServed || ''} onChange={e => set({ areaServed: e.target.value })} className={field} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Languages</label>
          <Input placeholder="English, French, Arabic" value={v.languages || ''} onChange={e => set({ languages: e.target.value })} className={field} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Services <span className="text-gray-500 font-normal">(one per line)</span></label>
          <textarea
            rows={5}
            placeholder={'Motion design\nEvent and conference videos\nBrand and product videos\nVideo editing\nAfter Effects tools'}
            value={(v.services || []).join('\n')}
            onChange={e => set({ services: lines(e.target.value) })}
            className={area}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Industries <span className="text-gray-500 font-normal">(one per line)</span></label>
          <textarea
            rows={5}
            placeholder={'Agriculture & food\nTech & startups\nEvents & conferences'}
            value={(v.industries || []).join('\n')}
            onChange={e => set({ industries: lines(e.target.value) })}
            className={area}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">Studio FAQ</label>
          <button
            type="button"
            onClick={() => set({ faq: [...faq, { q: '', a: '' }] })}
            className="inline-flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
          >
            <Plus className="w-3.5 h-3.5" /> Add question
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Questions people ask before hiring you (pricing range, turnaround, process, what you need from them).
          Shown on the About page and marked up for Google and AI assistants.
        </p>
        <div className="space-y-3">
          {faq.length === 0 && <p className="text-xs text-gray-500 italic">No questions yet.</p>}
          {faq.map((item, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/3 p-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="How long does a 60-second video take?"
                  value={item.q}
                  onChange={e => set({ faq: faq.map((f, j) => j === i ? { ...f, q: e.target.value } : f) })}
                  className={field}
                />
                <button
                  type="button"
                  onClick={() => set({ faq: faq.filter((_, j) => j !== i) })}
                  className="p-2 rounded-md text-red-400 hover:bg-red-500/10 flex-shrink-0"
                  aria-label="Remove question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="Usually 2–3 weeks from the approved script…"
                value={item.a}
                onChange={e => set({ faq: faq.map((f, j) => j === i ? { ...f, a: e.target.value } : f) })}
                className={area}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
