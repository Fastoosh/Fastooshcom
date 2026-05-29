import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface GumroadVariant {
  id: string;
  name: string;
  priceCents: number;
  isRecurring: boolean;
  recurrence: string | null;   // 'monthly' | 'yearly' | ...
  url: string;
}

interface GumroadProduct {
  id: string;
  permalink: string;
  name: string;
  url: string;
  variants: GumroadVariant[];
}

// The version fields an import produces. The admin then refines licensing type
// in the editor. We pre-fill prices, name, checkout URL, and Gumroad IDs.
export interface GumroadImportPayload {
  versionName: string;
  pricingModel: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  checkoutUrl: string;
  gumroadProductId: string;
  gumroadVariantId: string;
}

interface Props {
  open: boolean;
  onImport: (payload: GumroadImportPayload) => void;
  onImportAll: (payloads: GumroadImportPayload[]) => void;
  onClose: () => void;
}

function fmtPrice(cents: number): string {
  if (!cents) return '';
  const d = cents / 100;
  return d % 1 === 0 ? `$${d}` : `$${d.toFixed(2)}`;
}

export function GumroadImportModal({ open, onImport, onImportAll, onClose }: Props) {
  const [products, setProducts] = useState<GumroadProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const adminToken = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/gumroad/products`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': adminToken || '' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch Gumroad data');
      setProducts(data.products ?? []);
      if (data.products?.length === 1) setExpanded(data.products[0].id);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) fetchProducts(); }, [open]);
  if (!open) return null;

  const buildPayload = (product: GumroadProduct, variant: GumroadVariant): GumroadImportPayload => {
    const isFree = !variant.priceCents;
    let pricingModel: 'subscription' | 'lifetime' = 'lifetime';
    let monthlyPrice: string | undefined;
    let yearlyPrice: string | undefined;
    let lifetimePrice: string | undefined;

    const rec = (variant.recurrence || '').toLowerCase();
    if (variant.isRecurring && rec.includes('month')) {
      pricingModel = 'subscription'; monthlyPrice = fmtPrice(variant.priceCents);
    } else if (variant.isRecurring && (rec.includes('year') || rec.includes('annual'))) {
      pricingModel = 'subscription'; yearlyPrice = fmtPrice(variant.priceCents);
    } else if (!isFree) {
      pricingModel = 'lifetime'; lifetimePrice = fmtPrice(variant.priceCents);
    }

    return {
      versionName: variant.name || product.name,
      pricingModel, monthlyPrice, yearlyPrice, lifetimePrice,
      checkoutUrl: variant.url || product.url,
      gumroadProductId: product.permalink || product.id,
      gumroadVariantId: variant.name || '',
    };
  };

  const importAll = (product: GumroadProduct) => {
    const payloads = product.variants.map(v => buildPayload(product, v));
    if (payloads.length) { onImportAll(payloads); onClose(); }
  };

  const badge = (v: GumroadVariant) => {
    if (!v.priceCents) return { text: 'Free', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
    const rec = (v.recurrence || '').toLowerCase();
    if (v.isRecurring && rec.includes('month')) return { text: 'Monthly', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/25' };
    if (v.isRecurring && (rec.includes('year') || rec.includes('annual'))) return { text: 'Yearly', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
    return { text: 'Lifetime', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' };
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0d0d0f] border border-white/12 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🛍️</span>
            <div>
              <h3 className="text-sm font-bold text-white">Import from Gumroad</h3>
              <p className="text-xs text-white/35 mt-0.5">Click a variant to add it as a version</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              <button onClick={fetchProducts} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
              <p className="text-sm text-white/40">Fetching your Gumroad products…</p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-300">
              <p className="font-semibold mb-1">Failed to load products</p>
              <p className="text-xs text-red-400/70">{error}</p>
            </div>
          )}
          {!loading && !error && products.length === 0 && (
            <div className="text-center py-12 text-sm text-white/30">No products found in your Gumroad store.</div>
          )}

          {!loading && products.map(product => (
            <div key={product.id} className="border border-white/8 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === product.id ? null : product.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/6 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📦</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-white/35">{product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {expanded === product.id ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
              </button>

              {expanded === product.id && (
                <div className="border-t border-white/8 divide-y divide-white/5">
                  {product.variants.length === 0 && (
                    <p className="px-4 py-3 text-xs text-white/30 italic">No variants found for this product.</p>
                  )}
                  {product.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => importAll(product)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-500/8 hover:bg-pink-500/15 text-pink-300/80 hover:text-pink-300 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Import all {product.variants.length} variants
                    </button>
                  )}
                  {product.variants.map((variant, i) => {
                    const b = badge(variant);
                    return (
                      <button
                        key={variant.id || i}
                        type="button"
                        onClick={() => { onImport(buildPayload(product, variant)); onClose(); }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <Download className="w-3.5 h-3.5 text-white/20 group-hover:text-pink-400 transition-colors flex-shrink-0" />
                          <p className="text-sm text-white/80 font-medium group-hover:text-white transition-colors">{variant.name}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${b.cls}`}>{b.text}</span>
                          <span className="text-sm font-bold text-white">
                            {!variant.priceCents ? <span className="text-emerald-400">Free</span> : fmtPrice(variant.priceCents)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-white/8">
          <p className="text-white/20 text-xs text-center">Each variant becomes a version · set its licensing type after importing</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
