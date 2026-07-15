import { useState } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  LayoutDashboard, Home, FolderOpen, Wrench, Users, Settings,
  Palette, Download, Star, Globe2, BarChart2, Languages,
  ShieldAlert, Film, BookOpen, Lightbulb, TriangleAlert,
  CheckCircle2, Info, Zap, Lock, Eye, Play,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Step {
  text: string;
  tip?: string;
  warn?: string;
}

interface Section {
  id:          string;
  icon:        React.ReactNode;
  label:       string;
  color:       string;           // tailwind text colour
  borderColor: string;           // tailwind border colour
  bgColor:     string;           // subtle bg
  badge?:      string;
  intro:       string;
  steps:       Step[];
  notes?:      string[];
}

// ── Guide data ─────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    label: 'Dashboard',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/25',
    bgColor: 'bg-purple-500/5',
    intro: 'Your command center. Gives you a real-time pulse on every metric — revenue, leads, messages, video plays, and visitor behavior — broken into focused sub-views.',
    steps: [
      { text: 'Overview shows key KPI cards; click any card to jump to the relevant sub-view.' },
      { text: 'Analytics tab displays time-series charts for downloads, sign-ups, messages, and revenue.' },
      { text: 'LS Revenue tab connects to Lemon Squeezy and shows per-product sales, refunds, and recent orders.' },
      { text: 'Behavior tab renders a heatmap of clicks, scroll depth, and funnel drop-off rates.' },
      { text: 'Messages tab is a full inbox — click any message to expand it; mark as read or delete in bulk.' },
      { text: 'Videos tab shows per-project view counts and estimated watch-time. Use the Reset tab to clear this data when needed.', tip: 'Video analytics update in real-time as visitors play project or showreel videos.' },
    ],
    notes: ['A live notification badge appears in the header when a new contact message arrives.'],
  },
  {
    id: 'home',
    icon: <Home className="w-4 h-4" />,
    label: 'Home',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/25',
    bgColor: 'bg-blue-500/5',
    intro: 'Edit every piece of content shown on the public Home page — hero text, showreel, services, process steps, client logos, team section, and FAQ.',
    steps: [
      { text: 'Edit the Hero title, subtitle, and CTA button text directly in the form fields.' },
      { text: 'Paste a Bunny Stream, Vimeo, or YouTube URL to update the showreel embed.' },
      { text: 'Add, reorder, or remove Service cards with the + / × controls.' },
      { text: 'Upload client logos via the drag-and-drop uploader; they appear in the scrolling strip.' },
      { text: 'Save changes with the blue "Save" button at the bottom of each section.' },
    ],
  },
  {
    id: 'projects',
    icon: <FolderOpen className="w-4 h-4" />,
    label: 'Projects',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/25',
    bgColor: 'bg-cyan-500/5',
    intro: 'Full CRUD management for portfolio projects. Each project has a title, slug, description, cover image, video link, tags, category, year, deliverables, and a media gallery.',
    steps: [
      { text: 'Click "+ New Project" to open the project form.' },
      { text: 'Fill in the title — the slug is generated automatically but can be edited.', tip: 'The slug is used in the public URL: /projects/{slug}' },
      { text: 'Paste a Vimeo video URL in the "Video" field and use the picker to browse your Vimeo library.' },
      { text: 'Add gallery images or videos in the Media section; they appear in the project detail lightbox.' },
      { text: 'Use the "AI Improve" ✦ button on any text field to let Gemini rephrase or expand the copy.' },
      { text: 'Toggle the Featured switch to pin the project to the top of the Projects page.' },
      { text: 'Delete a project with the trash icon — this is immediate and permanent.' },
    ],
    notes: ['Project slugs must be unique. If you enter a duplicate, the form will warn you before saving.'],
  },
  {
    id: 'tools',
    icon: <Wrench className="w-4 h-4" />,
    label: 'Tools',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/25',
    bgColor: 'bg-amber-500/5',
    intro: 'Create and manage downloadable motion design tools. Each tool supports multiple pricing tiers (Free / Pro / Studio), a Lemon Squeezy product link, version history, and AI-generated descriptions.',
    steps: [
      { text: 'Click "+ New Tool" to open the tool form (ToolFormNew).' },
      { text: 'Select a category, set the tool\'s compatibility (After Effects, Premiere, etc.), and add tags.' },
      { text: 'For paid tiers, paste the Lemon Squeezy product/variant URL in the "Buy URL" field.' },
      { text: 'Enable "Featured" to show the tool in the hero section of the Tools page.' },
      { text: 'Use "AI Describe" to generate a description from the tool name and features automatically.' },
      { text: 'Add version entries with changelog notes — they appear in the tool\'s version history.' },
    ],
  },
  {
    id: 'team',
    icon: <Users className="w-4 h-4" />,
    label: 'Team',
    color: 'text-green-400',
    borderColor: 'border-green-500/25',
    bgColor: 'bg-green-500/5',
    intro: 'Manage team member profiles shown on the About page. Each member has a name, role, bio, avatar, and social links.',
    steps: [
      { text: 'Click "+ Add Member" to open the member form.' },
      { text: 'Upload an avatar image or paste an external URL.' },
      { text: 'Fill in the role, bio, and any social links (LinkedIn, Twitter/X, Dribbble, etc.).' },
      { text: 'Drag handles let you reorder members — the order here matches the public About page.' },
      { text: 'Use the trash icon to permanently remove a member.' },
    ],
  },
  {
    id: 'settings',
    icon: <Settings className="w-4 h-4" />,
    label: 'Settings',
    color: 'text-slate-400',
    borderColor: 'border-slate-500/25',
    bgColor: 'bg-slate-500/5',
    intro: 'Global site settings: studio name, contact email, social handles, footer text, and the "Work with us" page content.',
    steps: [
      { text: 'Update Studio Name and Tagline — these appear in the site header, footer, and SEO meta tags.' },
      { text: 'Set the primary contact email used for Resend notification delivery.' },
      { text: 'Edit the "Work with us" page headline, body copy, and the services offered checklist.' },
      { text: 'Save with the "Save Settings" button — changes are live immediately.' },
    ],
  },
  {
    id: 'style',
    icon: <Palette className="w-4 h-4" />,
    label: 'Style',
    color: 'text-fuchsia-400',
    borderColor: 'border-fuchsia-500/25',
    bgColor: 'bg-fuchsia-500/5',
    intro: 'Control the visual identity of the entire site — neon accent colors, typography, glassmorphism intensity, and gradient presets.',
    steps: [
      { text: 'Pick neon accent colors using the palette picker or enter hex values.' },
      { text: 'Choose a font pairing from the curated list; it updates the CSS variables site-wide.' },
      { text: 'Adjust the "Glass blur" and "Glass opacity" sliders to tune the glassmorphism effect.' },
      { text: 'Click a gradient preset to instantly apply it to the scrolling background.' },
      { text: 'Save — changes are reflected on every public page without a reload.' },
    ],
  },
  {
    id: 'leads',
    icon: <Download className="w-4 h-4" />,
    label: 'Leads',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    bgColor: 'bg-emerald-500/5',
    intro: 'View every email collected through the Free Download flow. Leads can be filtered, searched, and exported as a CSV.',
    steps: [
      { text: 'The table shows email, tool name, download date, and country.' },
      { text: 'Use the search box to filter by email or tool name.' },
      { text: 'Click "Export CSV" to download the full list for use in an email marketing tool.' },
      { text: 'Individual leads can be deleted from the table with the trash icon.' },
    ],
    notes: ['Leads are captured after a visitor enters their email and verifies it with a 6-digit OTP.'],
  },
  {
    id: 'reviews',
    icon: <Star className="w-4 h-4" />,
    label: 'Reviews',
    color: 'text-yellow-400',
    borderColor: 'border-yellow-500/25',
    bgColor: 'bg-yellow-500/5',
    intro: 'Moderate user reviews and star ratings submitted for tools. Approve, hide, or delete reviews before they appear publicly.',
    steps: [
      { text: 'Pending reviews are shown with a yellow "Pending" badge.' },
      { text: 'Click "Approve" to make a review visible on the public Tools page.' },
      { text: 'Click "Hide" to remove a live review without deleting it — it can be re-approved later.' },
      { text: 'Click the trash icon to permanently delete a review.' },
    ],
  },
  {
    id: 'seo',
    icon: <Globe2 className="w-4 h-4" />,
    label: 'SEO',
    color: 'text-sky-400',
    borderColor: 'border-sky-500/25',
    bgColor: 'bg-sky-500/5',
    intro: 'Set per-page meta titles, descriptions, Open Graph images, and canonical URLs. Also manages the robots.txt and sitemap configuration.',
    steps: [
      { text: 'Select a page from the dropdown at the top of the SEO panel.' },
      { text: 'Edit the meta title — aim for 50–60 characters including the studio name.' },
      { text: 'Write a compelling meta description — 120–160 characters works best for search snippets.' },
      { text: 'Upload an OG image (1200×630 px) for social sharing previews.' },
      { text: 'Toggle "Index this page" off for pages you want excluded from search engines.' },
      { text: 'Save to publish the changes; a cache-bust is triggered automatically.' },
    ],
  },
  {
    id: 'traffic',
    icon: <BarChart2 className="w-4 h-4" />,
    label: 'Traffic',
    color: 'text-indigo-400',
    borderColor: 'border-indigo-500/25',
    bgColor: 'bg-indigo-500/5',
    intro: 'Deep-dive analytics: referrer breakdown, UTM campaign performance, country distribution, and page-view trends. All data is captured server-side without cookies.',
    steps: [
      { text: 'The Referrers table ranks traffic sources by session count and conversion rate.' },
      { text: 'Switch to the UTM view to see campaign / source / medium breakdowns.' },
      { text: 'The Countries map shows where your visitors come from.' },
      { text: 'Trend charts show daily/weekly page-view and session patterns over the last 30 days.' },
    ],
    notes: ['Traffic data is stored in the KV store — use the Reset tab to clear test traffic before launch.'],
  },
  {
    id: 'translations',
    icon: <Languages className="w-4 h-4" />,
    label: 'Translations',
    color: 'text-rose-400',
    borderColor: 'border-rose-500/25',
    bgColor: 'bg-rose-500/5',
    intro: 'Manage the three locale files (en / fr / ar) that power the i18next localization. An AI-assisted bulk translate feature can auto-fill missing keys using Gemini.',
    steps: [
      { text: 'Select a locale (English, French, or Arabic) from the language switcher.' },
      { text: 'Browse the key tree; click any value to edit it inline.' },
      { text: 'Click "AI Translate" to have Gemini fill in all missing keys for the selected locale.' },
      { text: 'Review the AI suggestions in the diff panel before applying.' },
      { text: 'Save to write the updated locale file — the public site switches language instantly.' },
    ],
    notes: ['Arabic (ar) applies RTL layout across all public-facing components automatically.', 'The admin panel always stays in English regardless of the active locale.'],
  },
  {
    id: 'reset',
    icon: <ShieldAlert className="w-4 h-4" />,
    label: 'Reset',
    color: 'text-red-400',
    borderColor: 'border-red-500/25',
    bgColor: 'bg-red-500/5',
    badge: 'Danger Zone',
    intro: 'A selective data-initialization panel. Designed to be used before going live — it lets you wipe any combination of test data categories while keeping all content (Projects, Tools, Home, Style, SEO, Translations) completely untouched.',
    steps: [
      {
        text: 'Read the warning banner carefully — all deletions are permanent and irreversible.',
        warn: 'Never run a reset on a live production site with real user data.',
      },
      {
        text: 'Check the categories you want to clear. Each card shows the current record count pulled live from the database.',
        tip: 'You can check multiple categories at once and clear them all in a single operation.',
      },
      {
        text: '"Traffic & Sessions" deletes all visitor sessions, page views, UTM tracking records, and heatmap click data.',
      },
      {
        text: '"Contact Messages" removes all contact form submissions and tool support inquiries.',
      },
      {
        text: '"Reviews & Ratings" wipes every tool review and star rating.',
      },
      {
        text: '"Free Download Leads" clears all email addresses from the download flow plus any pending OTP codes.',
      },
      {
        text: '"User Accounts" deletes all registered accounts except the admin account you are currently logged in with.',
        warn: 'This also removes user profiles, purchases, and download history from the database.',
      },
      {
        text: '"Video Analytics" clears all project video view counts and watch-time data, plus the showreel analytics.',
        tip: 'Video data lives in the KV store under project_video_stats:{id} and showreel_video_stats keys.',
      },
      {
        text: 'Click "Reset X categories" to open the confirmation modal.',
      },
      {
        text: 'Step 1 — Review the final list of what will be deleted and the total record count.',
      },
      {
        text: 'Step 2 — Enter your admin email and password to authorize the operation. This re-verifies your identity server-side before any deletion runs.',
        tip: 'Wrong credentials will abort the reset immediately — nothing is deleted.',
      },
      {
        text: 'A results summary shows each category with the number of deleted entries or an error message if something failed.',
      },
    ],
    notes: [
      'Projects, Tools, Team members, Client Logos, Home content, Style, SEO, and Translations are never touched by any reset.',
      'Use "Select All" to check every category, or "Deselect All" to start fresh.',
      '"Refresh counts" at the bottom of the page re-fetches live counts without reloading the tab.',
    ],
  },
];

// ── Accordion section ──────────────────────────────────────────────────────────

function GuideSection({ section, defaultOpen = false }: { section: Section; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200 ${section.borderColor} ${open ? section.bgColor : 'bg-white/2 hover:bg-white/3'}`}>

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-black/20 border ${section.borderColor} flex items-center justify-center flex-shrink-0`}>
            <span className={section.color}>{section.icon}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{section.label}</span>
            {section.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 font-medium uppercase tracking-wider">
                {section.badge}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">

              {/* Intro */}
              <p className="text-white/60 text-sm leading-relaxed">{section.intro}</p>

              {/* Steps */}
              <ol className="space-y-3">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    {/* Number */}
                    <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center bg-black/20 border ${section.borderColor} ${section.color}`}>
                      {i + 1}
                    </span>

                    <div className="flex-1 space-y-1.5">
                      <p className="text-white/75 text-sm leading-relaxed">{step.text}</p>

                      {step.tip && (
                        <div className="flex items-start gap-1.5 rounded-lg bg-blue-500/8 border border-blue-500/20 px-3 py-2">
                          <Lightbulb className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-blue-300/90 text-xs leading-relaxed">{step.tip}</p>
                        </div>
                      )}

                      {step.warn && (
                        <div className="flex items-start gap-1.5 rounded-lg bg-red-500/8 border border-red-500/20 px-3 py-2">
                          <TriangleAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-red-300/90 text-xs leading-relaxed">{step.warn}</p>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {/* Notes */}
              {section.notes && section.notes.length > 0 && (
                <div className="rounded-xl bg-white/3 border border-white/8 p-4 space-y-2">
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3 h-3" /> Notes
                  </p>
                  <ul className="space-y-1.5">
                    {section.notes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                        <p className="text-white/45 text-xs leading-relaxed">{note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function GuideTab() {
  const [search, setSearch] = useState('');

  const filtered = SECTIONS.filter(s =>
    search.trim() === '' ||
    s.label.toLowerCase().includes(search.toLowerCase()) ||
    s.intro.toLowerCase().includes(search.toLowerCase()) ||
    s.steps.some(st => st.text.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Admin Guide</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Step-by-step reference for every tab in this admin panel.
              Expand a section to see how it works and what to watch out for.
            </p>
          </div>
        </div>

        {/* Quick-access chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => {
                setSearch('');
                setTimeout(() => {
                  document.getElementById(`guide-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors bg-white/4 hover:bg-white/8 border-white/10 text-white/50 hover:text-white/80 ${s.id === 'reset' ? 'border-red-500/25 text-red-400/70 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10' : ''}`}
            >
              <span className={s.color}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search guide…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 outline-none focus:border-purple-500/40 transition-colors"
        />
      </div>

      {/* ── Sections ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">No matching sections found.</p>
        )}
        {filtered.map((section, i) => (
          <div key={section.id} id={`guide-${section.id}`}>
            <GuideSection section={section} defaultOpen={section.id === 'reset' && search === ''  ? false : false} />
          </div>
        ))}
      </div>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <p className="text-white/20 text-xs text-center pb-4">
        This guide covers the Fastoosh admin panel — English only. Public-facing content follows the active locale.
      </p>
    </div>
  );
}
