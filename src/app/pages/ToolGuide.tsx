import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, BookOpen, AlertCircle, Loader2, ExternalLink, List, ChevronDown,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { ScrollingGradientBackground } from '../components/shared/ScrollingGradientBackground';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ToolMeta {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  category?: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;           // 1 | 2 | 3 | 4
}

/** Recursive tree node — every node can have children and be collapsed */
interface TocNode {
  item: TocItem;
  children: TocNode[];
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

/**
 * Strip any inline Table-of-Contents section from the document.
 * Targets heading text "Contents / Table of Contents / TOC / Navigation…"
 * plus any element whose id/class marks it as a TOC.
 */
function removeInlineToc(doc: Document): void {
  const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  for (const h of headings) {
    const text = h.textContent?.trim().toLowerCase() ?? '';
    if (
      /^(table[\s-]of[\s-])?contents?$|^\btoc\b$|^navigation$|^in this (guide|article|page)$/.test(text)
    ) {
      const next = h.nextElementSibling;
      if (next && /^(UL|OL|NAV|DIV)$/.test(next.tagName)) next.remove();
      h.remove();
      break;
    }
  }
  const selectors = [
    '[id*="table-of-contents"]', '[id*="toc"]', '[id*="contents"]',
    '[class*="table-of-contents"]', '[class*="toc"]',
  ];
  for (const sel of selectors) {
    try { doc.querySelectorAll(sel).forEach(el => el.remove()); } catch { /* ignore */ }
  }
}

/**
 * Build a recursive TocNode tree from a flat ordered list of heading items.
 * Uses a stack-based algorithm so any nesting depth is supported.
 */
function buildTocTree(items: TocItem[]): TocNode[] {
  const roots: TocNode[] = [];
  // stack holds [node, level] pairs
  const stack: TocNode[] = [];

  for (const item of items) {
    const node: TocNode = { item, children: [] };

    // Pop until we find a node whose level is strictly less than ours
    while (stack.length > 0 && stack[stack.length - 1].item.level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return roots;
}

/**
 * Collect all IDs that are ancestors of targetId in the tree.
 * Returns null if targetId is not found.
 */
function findAncestorIds(nodes: TocNode[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.item.id === targetId) return [];
    const childResult = findAncestorIds(node.children, targetId);
    if (childResult !== null) return [node.item.id, ...childResult];
  }
  return null;
}

/** Collect every id in the tree (for flat operations like scroll detection) */
function flattenTree(nodes: TocNode[]): TocItem[] {
  return nodes.flatMap(n => [n.item, ...flattenTree(n.children)]);
}

/**
 * Parse guide HTML:
 *  - remove inline TOC
 *  - inject ids on headings that lack them
 *  - build a recursive TocNode tree
 */
function processGuideHtml(html: string): { processedHtml: string; roots: TocNode[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  removeInlineToc(doc);

  // ─── Client-side safety net: strip all background colours from the guide ────
  const BODY_BG = 'rgb(7, 11, 24)';
  const CALLOUT_RE = /\b(tip|note|warning|caution|danger|error|info|success|alert|callout|admonition)\b/i;

  /** Remove background-* AND padding/margin declarations from an inline style element */
  const stripBgInline = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.removeProperty('background-image');
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  };

  // 1. Strip inline styles on <html> and <body> — also remove padding & margin from body
  stripBgInline(doc.documentElement);
  stripBgInline(doc.body);
  if (doc.body) {
    doc.body.style.removeProperty('padding');
    doc.body.style.removeProperty('padding-top');
    doc.body.style.removeProperty('padding-right');
    doc.body.style.removeProperty('padding-bottom');
    doc.body.style.removeProperty('padding-left');
    doc.body.style.removeProperty('margin');
    if (!doc.body.getAttribute('style')?.trim()) doc.body.removeAttribute('style');
  }

  // 2. Strip inline backgrounds on ALL elements except callout-class divs
  doc.querySelectorAll('*').forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    if (CALLOUT_RE.test(el.className)) return; // keep semantic callout colours
    stripBgInline(el);
  });

  // 2b. Fix gradient-text on headings — stripping their background (above) leaves
  //     -webkit-text-fill-color: transparent / color: transparent behind, making
  //     the heading invisible. Remove those properties from inline styles too.
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    el.style.removeProperty('-webkit-text-fill-color');
    el.style.removeProperty('-webkit-background-clip');
    el.style.removeProperty('background-clip');
    // Only remove color if it was set to transparent (gradient-text trick)
    if (/^\s*transparent\s*$/i.test(el.style.color)) {
      el.style.removeProperty('color');
    }
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
  });

  // 3. Scrub every <style> block's CSS text so stylesheet rules can't fight us
  doc.querySelectorAll('style').forEach(styleEl => {
    let css = styleEl.textContent ?? '';

    // Remove background-*, padding, and margin declarations from body / html rules
    css = css.replace(
      /\b(html|body)\b([^{]*)\{([^}]*)\}/g,
      (_m, tag: string, extra: string, rules: string) => {
        const cleaned = rules
          .split(';')
          .filter(r => !/^\s*(background|padding|margin)/i.test(r))
          .join(';');
        return `${tag}${extra}{${cleaned}}`;
      }
    );

    // Remove background-* from ALL div selector rules
    css = css.replace(
      /\bdiv\b([^{]*)\{([^}]*)\}/g,
      (_m, extra: string, rules: string) => {
        const cleaned = rules
          .split(';')
          .filter(r => !/^\s*background/i.test(r))
          .join(';');
        return `div${extra}{${cleaned}}`;
      }
    );

    // Remove gradient-text tricks from h1-h6 CSS rules so they can't
    // make headings invisible after we wipe their background.
    css = css.replace(
      /\b(h[1-6])\b([^{]*)\{([^}]*)\}/g,
      (_m, tag: string, extra: string, rules: string) => {
        const cleaned = rules
          .split(';')
          .filter(r => !/^\s*(-webkit-background-clip|background-clip|-webkit-text-fill-color)/i.test(r.trim()))
          .filter(r => !/^\s*background(?!-color)/i.test(r.trim()))   // strip gradient backgrounds
          .filter(r => !/^\s*color\s*:\s*transparent/i.test(r.trim())) // strip color: transparent
          .join(';');
        return `${tag}${extra}{${cleaned}}`;
      }
    );

    styleEl.textContent = css;
  });

  // 4. Inject a final override <style> at the very end of <head>.
  //    Using !important + last-in-cascade guarantees we beat everything above.
  const override = doc.createElement('style');
  override.textContent = `
    html { background: transparent !important; }
    body {
      background-color: ${BODY_BG} !important;
      background-image: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    div  { background-color: transparent !important; background-image: none !important; }
    /* H1 — force same purple as H2; neutralise any leftover gradient-text tricks */
    h1 {
      color: #8842f0 !important;
      -webkit-text-fill-color: #8842f0 !important;
      background: none !important;
      -webkit-background-clip: unset !important;
      background-clip: unset !important;
    }
    h2 {
      color: #8842f0 !important;
      -webkit-text-fill-color: #8842f0 !important;
      background: none !important;
      -webkit-background-clip: unset !important;
      background-clip: unset !important;
    }
    h3 {
      color: #8842f0 !important;
      -webkit-text-fill-color: #8842f0 !important;
      background: none !important;
      -webkit-background-clip: unset !important;
      background-clip: unset !important;
    }
    /* Re-grant callout colours that the div rule above would otherwise wipe */
    [class*="tip"],[class*="hint"],[class*="success"]
      { background-color: rgba(124,58,237,0.10) !important; }
    [class*="warning"],[class*="caution"]
      { background-color: rgba(245,158,11,0.10) !important; }
    [class*="danger"],[class*="error"]
      { background-color: rgba(239,68,68,0.10) !important; }
    [class*="info"],[class*="note"]
      { background-color: rgba(99,102,241,0.10) !important; }
    [class*="callout"],[class*="admonition"]
      { background-color: rgba(255,255,255,0.04) !important; }
    /* Remove border from the .doc wrapper div */
    .doc { border: none !important; box-shadow: none !important; }
  `;
  doc.head.appendChild(override);
  // ─────────────────────────────────────────────────────────────────────────

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4'));
  const flatItems: TocItem[] = [];

  headings.forEach((el, i) => {
    if (!el.id) el.id = `toc-h-${i}`;
    const level = parseInt(el.tagName[1]);
    const text  = el.textContent?.trim() ?? '';
    if (text) flatItems.push({ id: el.id, text, level });
  });

  const roots = buildTocTree(flatItems);
  return { processedHtml: doc.documentElement.outerHTML, roots };
}

// ─── Recursive TOC node component ────────────────────────────────────────────

interface TocNodeRowProps {
  node: TocNode;
  depth: number;
  activeId: string;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  handleTocClick: (id: string) => void;
}

function TocNodeRow({
  node, depth, activeId, expandedIds, toggleExpanded, handleTocClick,
}: TocNodeRowProps) {
  const isActive   = node.item.id === activeId;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.item.id);

  // Check if any descendant is active (to highlight the parent subtly)
  const hasActiveDescendant = (n: TocNode): boolean =>
    n.children.some(c => c.item.id === activeId || hasActiveDescendant(c));
  const descendantActive = !isActive && hasActiveDescendant(node);

  // Indentation per depth level
  const pl = depth === 0 ? 'pl-2' : depth === 1 ? 'pl-5' : depth === 2 ? 'pl-8' : 'pl-11';

  // Font size and weight
  const textSize = depth === 0 ? 'text-[0.78rem] font-semibold' : 'text-[0.74rem] font-normal';

  return (
    <li>
      <div className="flex items-center gap-1">
        {/* Item label — click to navigate */}
        <button
          onClick={() => handleTocClick(node.item.id)}
          className={`
            flex-1 text-left leading-snug py-1.5 pr-1 rounded-lg
            transition-all duration-150 flex items-center gap-2
            ${pl} ${textSize}
            ${isActive
              ? 'text-purple-300 bg-purple-500/10'
              : descendantActive
                ? 'text-white/65 bg-white/[0.04]'
                : depth === 0
                  ? 'text-white/55 hover:text-white/85 hover:bg-white/5'
                  : 'text-white/35 hover:text-white/65 hover:bg-white/5'
            }`}
        >
          <span
            className={`w-1 h-1 rounded-full flex-shrink-0 transition-all mt-px
              ${isActive
                ? 'bg-purple-400 scale-125'
                : descendantActive
                  ? 'bg-purple-400/40'
                  : 'bg-white/20'
              }`}
          />
          <span className="leading-snug">{node.item.text}</span>
        </button>

        {/* Chevron — click to toggle children (only if has children) */}
        {hasChildren && (
          <button
            onClick={() => toggleExpanded(node.item.id)}
            className="p-1 rounded-md text-white/20 hover:text-white/60
              hover:bg-white/5 transition-all duration-150 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200
                ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
            />
          </button>
        )}
      </div>

      {/* Children — animated expand/collapse */}
      {hasChildren && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.ul
              key="children"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="overflow-hidden mt-0.5 space-y-0.5"
            >
              {node.children.map(child => (
                <TocNodeRow
                  key={child.item.id}
                  node={child}
                  depth={depth + 1}
                  activeId={activeId}
                  expandedIds={expandedIds}
                  toggleExpanded={toggleExpanded}
                  handleTocClick={handleTocClick}
                />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      )}
    </li>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export function ToolGuide() {
  const { slug } = useParams<{ slug: string }>();

  const [tool, setTool]                     = useState<ToolMeta | null>(null);
  const [rawHtml, setRawHtml]               = useState<string | null>(null);
  const [processedHtml, setProcessedHtml]   = useState<string | null>(null);
  const [roots, setRoots]                   = useState<TocNode[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  const [activeId, setActiveId]             = useState<string>('');
  // Set of node IDs that are currently expanded
  const [expandedIds, setExpandedIds]       = useState<Set<string>>(new Set());
  const [mobileTocOpen, setMobileTocOpen]   = useState(false);

  const iframeRef                           = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight]     = useState(600);

  // ── Process raw HTML ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!rawHtml) return;
    const { processedHtml: ph, roots: r } = processGuideHtml(rawHtml);
    setProcessedHtml(ph);
    setRoots(r);
    // Default: expand all root nodes so secondary titles are visible
    setExpandedIds(new Set(r.map(n => n.item.id)));
    setActiveId(r[0]?.item.id ?? '');
  }, [rawHtml]);

  // ── Auto-expand ancestors of the active heading ───────────────────────────
  useEffect(() => {
    if (!activeId || roots.length === 0) return;
    const ancestors = findAncestorIds(roots, activeId);
    if (ancestors && ancestors.length > 0) {
      setExpandedIds(prev => {
        const next = new Set(prev);
        ancestors.forEach(id => next.add(id));
        return next;
      });
    }
  }, [activeId, roots]);

  // ── Toggle a node's expansion ─────────────────────────────────────────────
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Auto-size iframe ──────────────────────────────────────────────────────
  const handleIframeLoad = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) setIframeHeight(Math.max(400, doc.documentElement.scrollHeight + 40));
    } catch { /* cross-origin guard */ }
  }, []);

  // ── Active-heading tracking via page scroll ───────────────────────────────
  useEffect(() => {
    const allItems = flattenTree(roots);
    if (allItems.length === 0) return;

    const updateActive = () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument) return;
      const iframeTop = iframe.getBoundingClientRect().top;
      const threshold = 110;
      let current = allItems[0].id;
      for (const item of allItems) {
        const el = iframe.contentDocument.getElementById(item.id);
        if (!el) continue;
        if (iframeTop + el.getBoundingClientRect().top <= threshold) current = item.id;
      }
      setActiveId(current);
    };

    window.addEventListener('scroll', updateActive, { passive: true });
    return () => window.removeEventListener('scroll', updateActive);
  }, [roots]);

  // ── Click TOC item → scroll page to that heading ─────────────────────────
  const handleTocClick = useCallback((id: string) => {
    if (!id) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    const el = iframe.contentDocument.getElementById(id);
    if (!el) return;
    const scrollTarget =
      window.scrollY + iframe.getBoundingClientRect().top + el.getBoundingClientRect().top - 96;
    window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
    setActiveId(id);
    setMobileTocOpen(false);
  }, []);

  // ── Fetch guide ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const [toolRes, guideRes] = await Promise.all([
        fetch(`${API_BASE}/tools/slug/${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${API_BASE}/tools/${encodeURIComponent(slug)}/guide-html`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
      ]);

      if (toolRes.ok) {
        const d = await toolRes.json();
        const found = d.data ?? d.tool ?? d ?? null;
        if (found && typeof found === 'object' && found.name) setTool(found as ToolMeta);
      }

      if (!guideRes.ok) { setError('No guide available for this tool yet.'); return; }
      const guideData = await guideRes.json();
      if (!guideData.success || !guideData.html) {
        setError('No guide available for this tool yet.');
        return;
      }
      setRawHtml(guideData.html);
    } catch (err) {
      console.error('[ToolGuide] load error:', err);
      setError('Failed to load the guide. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // ── TOC sidebar (shared desktop + mobile) ────────────────────────────────
  const TocContent = () => (
    <nav aria-label="Table of contents">
      <div className="flex items-center gap-2 mb-4 px-1">
        <List className="w-3.5 h-3.5 text-purple-400/70 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
          On this page
        </span>
      </div>
      <ul className="space-y-0.5">
        {roots.map(node => (
          <TocNodeRow
            key={node.item.id}
            node={node}
            depth={0}
            activeId={activeId}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            handleTocClick={handleTocClick}
          />
        ))}
      </ul>
    </nav>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative">
      <ScrollingGradientBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-24">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-10"
        >
          <Link
            to={slug ? `/tools/${slug}` : '/tools'}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/90
              transition-colors px-3 py-1.5 rounded-lg border border-white/10
              hover:border-white/20 bg-white/5 hover:bg-white/8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tool ? tool.name : 'Tool'}
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-sm text-white/40 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            User Guide
          </span>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Loading */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 gap-4"
            >
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-white/40 text-sm">Loading guide…</p>
            </motion.div>
          )}

          {/* Error */}
          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 gap-4 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10
                flex items-center justify-center mb-2">
                <AlertCircle className="w-6 h-6 text-white/40" />
              </div>
              <p className="text-white/60 text-base font-medium">{error}</p>
              <Link
                to={slug ? `/tools/${slug}` : '/tools'}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors
                  underline underline-offset-2"
              >
                Back to tool page
              </Link>
            </motion.div>
          )}

          {/* Guide */}
          {!loading && !error && processedHtml && (
            <motion.div
              key="guide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Header card */}
              <div
                className="rounded-2xl border border-white/8 mb-8 p-7 backdrop-blur-xl"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
              >
                <div className="flex items-start gap-4">
                  {tool?.imageUrl && (
                    <img
                      src={tool.imageUrl}
                      alt={tool.name}
                      className="w-14 h-14 rounded-xl object-cover border border-white/10 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-purple-400/70">
                        User Guide
                      </span>
                    </div>
                    <h1 className="text-2xl font-black text-white leading-tight mb-1">
                      {tool?.name ?? slug}
                    </h1>
                    {tool?.description && (
                      <p className="text-white/40 text-sm leading-relaxed line-clamp-2">
                        {tool.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Mobile TOC toggle */}
                    {roots.length > 0 && (
                      <button
                        onClick={() => setMobileTocOpen(v => !v)}
                        className="lg:hidden inline-flex items-center gap-1.5 text-xs
                          text-white/40 hover:text-white/70 transition-colors border
                          border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg
                          bg-white/5 hover:bg-white/8"
                      >
                        <List className="w-3.5 h-3.5" />
                        Contents
                      </button>
                    )}
                    <Link
                      to={slug ? `/tools/${slug}` : '/tools'}
                      className="inline-flex items-center gap-1.5 text-xs text-white/40
                        hover:text-white/70 transition-colors border border-white/10
                        hover:border-white/20 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Tool page
                    </Link>
                  </div>
                </div>
              </div>

              {/* Mobile TOC dropdown */}
              <AnimatePresence>
                {mobileTocOpen && roots.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="lg:hidden mb-6 overflow-hidden"
                  >
                    <div
                      className="rounded-2xl border border-white/8 p-5 backdrop-blur-xl"
                      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                    >
                      <TocContent />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Two-column layout */}
              <div className="flex gap-8 items-start">

                {/* Desktop sidebar */}
                {roots.length > 0 && (
                  <motion.aside
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.35 }}
                    className="hidden lg:block w-56 xl:w-64 flex-shrink-0"
                  >
                    <div
                      className="sticky top-8 rounded-2xl border border-white/8 p-5
                        backdrop-blur-xl max-h-[calc(100vh-5rem)] overflow-y-auto"
                      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                    >
                      <TocContent />
                    </div>
                  </motion.aside>
                )}

                {/* Guide iframe */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.35 }}
                  className="flex-1 min-w-0 rounded-2xl border border-white/8 overflow-hidden"
                >
                  <iframe
                    ref={iframeRef}
                    srcDoc={processedHtml}
                    title={`${tool?.name ?? slug} – User Guide`}
                    sandbox="allow-same-origin allow-scripts allow-popups"
                    onLoad={handleIframeLoad}
                    className="w-full border-0 block"
                    style={{
                      height: iframeHeight,
                      colorScheme: 'dark',
                      minHeight: 400,
                      backgroundColor: 'rgb(7, 11, 24)',
                    }}
                  />
                </motion.div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}