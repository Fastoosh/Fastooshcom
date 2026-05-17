import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface LsVariant {
  id: string;
  name: string;
  price: number; // cents
  interval: 'month' | 'year' | null;
  isSubscription: boolean;
  productUrl?: string;  // clean product URL — shows all variants on checkout page
  enabledUrl?: string;  // productUrl + ?enabled=variantId — may not honor pre-select reliably
  buyNowUrl: string;    // legacy fallback (same as enabledUrl)
  status: string;
}

interface LsProduct {
  id: string;
  name: string;
  variants: LsVariant[];
}

export interface LsImportPayload {
  versionName: string;
  pricingModel: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  buyNowUrl: string;
  variantId: string;
  productId: string;
}

interface Props {
  open: boolean;
  onImport: (payload: LsImportPayload) => void;
  onImportAll: (payloads: LsImportPayload[]) => void;
  onClose: () => void;
}

function fmtPrice(cents: number): string {
  if (!cents) return '';
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

type UrlMode = 'product' | 'enabled';

export function LsImportModal({ open, onImport, onImportAll, onClose }: Props) {
  const [products, setProducts] = useState<LsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [mode, setMode] = useState<'test' | 'production'>('production'); // LS API mode
  const [urlMode, setUrlMode] = useState<UrlMode>('product');             // URL format to import

  const fetchProducts = async (apiMode: 'test' | 'production' = mode) => {
    setLoading(true);
    setError('');
    try {
      const adminToken = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/ls/variants?mode=${apiMode}`, {
        headers: { 
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': adminToken || '',
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch LemonSqueezy data');
      setProducts(data.products ?? []);
      if (data.products?.length === 1) setExpandedProduct(data.products[0].id);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (open) fetchProducts(); 
  }, [open]);

  if (!open) return null;

  const buildPayload = (product: LsProduct, variant: LsVariant): LsImportPayload => {
    const isFree = !variant.price || variant.price === 0;
    let pricingModel: 'subscription' | 'lifetime';
    let monthlyPrice: string | undefined;
    let yearlyPrice: string | undefined;
    let lifetimePrice: string | undefined;
    let versionName = variant.name || product.name;

    if (isFree) {
      versionName = 'Free';
      pricingModel = 'lifetime';
    } else if (variant.isSubscription && variant.interval === 'month') {
      pricingModel = 'subscription';
      monthlyPrice = fmtPrice(variant.price);
    } else if (variant.isSubscription && variant.interval === 'year') {
      pricingModel = 'subscription';
      yearlyPrice = fmtPrice(variant.price);
    } else {
      pricingModel = 'lifetime';
      lifetimePrice = fmtPrice(variant.price);
    }

    // Pick URL based on selected mode. Fall back to legacy buyNowUrl if the new fields aren't present.
    const chosenUrl = urlMode === 'product'
      ? (variant.productUrl || variant.buyNowUrl)
      : (variant.enabledUrl || variant.buyNowUrl);

    return { versionName, pricingModel, monthlyPrice, yearlyPrice, lifetimePrice, buyNowUrl: chosenUrl, variantId: String(variant.id), productId: String(product.id) };
  };

  const handleSelectVariant = (product: LsProduct, variant: LsVariant) => {
    onImport(buildPayload(product, variant));
  };

  const handleImportAllForProduct = (product: LsProduct) => {
    const payloads = product.variants
      .filter(v => v.status === 'published')
      .map(v => buildPayload(product, v));
    if (payloads.length > 0) { onImportAll(payloads); onClose(); }
  };

  const intervalLabel = (v: LsVariant) => {
    if (!v.isSubscription) return 'One-time';
    if (v.interval === 'month') return '/ mo';
    if (v.interval === 'year') return '/ yr';
    return '';
  };

  const intervalBadge = (v: LsVariant) => {
    // Check if variant is free
    if (!v.price || v.price === 0) return { text: 'Free', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
    
    if (!v.isSubscription) return { text: 'Lifetime', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' };
    if (v.interval === 'month') return { text: 'Monthly', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/25' };
    if (v.interval === 'year') return { text: 'Yearly', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
    return { text: 'Sub', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/25' };
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0d0f] border border-white/12 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🍋</span>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Import from LemonSqueezy
                {/* Mode badge */}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  mode === 'test' 
                    ? 'bg-purple-500/15 border border-purple-500/25 text-purple-400' 
                    : 'bg-green-500/15 border border-green-500/25 text-green-400'
                }`}>
                  {mode}
                </span>
              </h3>
              <p className="text-xs text-white/35 mt-0.5">Click a variant to auto-fill version fields</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/8">
              {(['test', 'production'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    fetchProducts(m);
                  }}
                  disabled={loading}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all disabled:opacity-40 ${
                    mode === m 
                      ? m === 'test'
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-green-500/20 text-green-300'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {m === 'test' ? 'Test' : 'Prod'}
                </button>
              ))}
            </div>
            {!loading && (
              <button
                onClick={() => fetchProducts(mode)}
                className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* URL mode toggle */}
        <div className="px-5 py-3 border-b border-white/8 bg-white/[0.02]">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Checkout URL format</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUrlMode('product')}
              className={`flex flex-col items-start gap-1 px-3 py-2 rounded-lg border text-left transition-all ${
                urlMode === 'product'
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                  : 'bg-white/3 border-white/8 text-white/50 hover:bg-white/6'
              }`}
            >
              <span className="text-xs font-semibold">Product URL</span>
              <span className="text-[10px] text-white/40 leading-tight">Clean URL, shows all variants — recommended</span>
            </button>
            <button
              type="button"
              onClick={() => setUrlMode('enabled')}
              className={`flex flex-col items-start gap-1 px-3 py-2 rounded-lg border text-left transition-all ${
                urlMode === 'enabled'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-white/3 border-white/8 text-white/50 hover:bg-white/6'
              }`}
            >
              <span className="text-xs font-semibold">Pre-select variant ⚠</span>
              <span className="text-[10px] text-white/40 leading-tight">?enabled=ID — may break display</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <p className="text-sm text-white/40">Fetching your LemonSqueezy products…</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-300">
              <p className="font-semibold mb-1">Failed to load products</p>
              <p className="text-xs text-red-400/70">{error}</p>
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="text-center py-12 text-sm text-white/30">
              No published products found in your LemonSqueezy store.
            </div>
          )}

          {!loading && products.map(product => (
            <div key={product.id} className="border border-white/8 rounded-xl overflow-hidden">
              {/* Product row */}
              <button
                type="button"
                onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/6 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">📦</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-white/35">{product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {expandedProduct === product.id
                  ? <ChevronDown className="w-4 h-4 text-white/30" />
                  : <ChevronRight className="w-4 h-4 text-white/30" />}
              </button>

              {/* Variants */}
              {expandedProduct === product.id && (
                <div className="border-t border-white/8 divide-y divide-white/5">
                  {product.variants.length === 0 && (
                    <p className="px-4 py-3 text-xs text-white/30 italic">No variants found for this product.</p>
                  )}
                  {product.variants.filter(v => v.status === 'published').length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleImportAllForProduct(product)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/8 hover:bg-amber-500/15 text-amber-300/80 hover:text-amber-300 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Import all {product.variants.filter(v => v.status === 'published').length} variants
                    </button>
                  )}
                  {product.variants.map(variant => {
                    const badge = intervalBadge(variant);
                    const isPending = variant.status !== 'published';
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => { handleSelectVariant(product, variant); onClose(); }}
                        disabled={isPending}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed group"
                      >
                        <div className="flex items-center gap-3">
                          <Download className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                          <div>
                            <p className="text-sm text-white/80 font-medium group-hover:text-white transition-colors">
                              {variant.name}
                            </p>
                            {isPending && (
                              <p className="text-xs text-white/25 mt-0.5">Status: {variant.status}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${badge.cls}`}>
                            {badge.text}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {(!variant.price || variant.price === 0) ? (
                              <span className="text-emerald-400">Free</span>
                            ) : (
                              <>
                                {fmtPrice(variant.price)}
                                <span className="text-xs font-normal text-white/30 ml-0.5">{intervalLabel(variant)}</span>
                              </>
                            )}
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

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 space-y-2">
          {urlMode === 'enabled' && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <span className="text-amber-400 text-xs mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-amber-300/80 text-xs leading-relaxed">
                Some LemonSqueezy share configurations ignore <code className="px-1 rounded bg-black/40 text-amber-200">?enabled=</code>{' '}
                or hide product media. If checkout opens the wrong variant, switch to <strong className="text-amber-300">Product URL</strong> mode and re-import.
              </p>
            </div>
          )}
          <p className="text-white/20 text-xs text-center">Each variant creates a separate version · Click monthly &amp; yearly separately for distinct pricing tiers</p>
        </div>
      </div>
    </div>,
    document.body
  );
}