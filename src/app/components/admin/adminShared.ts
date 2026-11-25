// Types and helpers shared by the admin screens — split out of pages/Admin.tsx.
import { type StudioProfile } from './StudioProfileEditor';
import { projectId } from '/utils/supabase/info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// Helper function to create URL-friendly slug
export const createSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Module-level constant shared by SettingsForm and inline category/status panels
export const STATUS_COLOR_OPTIONS = [
  { name: 'purple', label: 'Purple', classes: 'from-purple-500 to-violet-500' },
  { name: 'green',  label: 'Green',  classes: 'from-green-500 to-emerald-500' },
  { name: 'amber',  label: 'Amber',  classes: 'from-yellow-500 to-orange-500' },
  { name: 'cyan',   label: 'Cyan',   classes: 'from-cyan-500 to-blue-400' },
  { name: 'pink',   label: 'Pink',   classes: 'from-pink-500 to-fuchsia-500' },
  { name: 'red',    label: 'Red',    classes: 'from-red-500 to-rose-400' },
];

export interface Project {
  id: string;
  slug?: string;
  title: string;
  description: string;
  category: string;
  year: number;
  imageUrl: string;
  videoUrl: string;
  tags: string[];
  featured: boolean;
  client?: string;
  goal?: string;
  approach?: string;
  deliverables?: string[];
  outcome?: string;
  screenshots?: string[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  toolCategory?: string;
  imageUrl: string;
  featured: boolean;
  slug?: string;
  faqs?: Array<{ question: string; answer: string }>;
  versions?: ToolVersion[];
  richFeatures?: Array<{ id: string; title: string; description: string; screenshots: string[]; featured?: boolean }>;
  [key: string]: any; // allow extra fields from API (tagline, demoUrl, etc.)
}

export interface ToolVersion {
  id: string;
  versionType: string;
  pricingModel: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  downloadUrl: string;
  tagline?: string;
  features?: string[];
  whatsIncluded?: string[];
  howItWorks?: Array<{ title: string; description: string }>;
  systemRequirements?: string;
  demoUrl?: string;
  color?: string;
  includedFeatureIds?: string[];
  [key: string]: any;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
  socialLinks: Record<string, string>;
}

export interface Settings {
  id?: string;
  heroVideoUrl?: string; // legacy fields still read by the settings form
  aboutText?: string;
  showreelUrl?: string;
  faviconUrl?: string;
  siteUrl?: string;
  defaultOgImage?: string;
  studioProfile?: StudioProfile;
  deployHookUrl?: string;
  calendlyUrl?: string;
  contactEmail?: string;
  emailReplyTo?: string;
  projectCategories?: string[];
  toolCategories?: string[];
  toolStatuses?: { label: string; color: string }[];
  clientLogos?: { name: string; imageUrl?: string }[];
  marqueeSpeed?: number;
  socialLinks?: {
    linkedin?: string;
    instagram?: string;
    twitter?: string;
    dribbble?: string;
    behance?: string;
    tiktok?: string;
  };
  geminiApiKey?: string;
  geminiModel?: string;
  geminiPaidTier?: boolean;
  downloadFollowUpEmail?: boolean;
}

// Admin sidebar navigation (shared by the desktop sidebar, the mobile drawer
// and the mobile top bar's current-section title).
export const ADMIN_NAV: { label: string; items: { value: string; label: string; danger?: boolean }[] }[] = [
  { label: 'Content', items: [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'projects',  label: 'Projects' },
    { value: 'tools',     label: 'Tools' },
    { value: 'team',      label: 'Team' },
    { value: 'home',      label: 'Home' },
    { value: 'workwithus', label: 'Page Text' },
    { value: 'reviews',   label: 'Reviews' },
    { value: 'usecases',  label: '🧩 Use cases' },
  ]},
  { label: 'Audience', items: [
    { value: 'leads',     label: '🎯 Leads' },
    { value: 'licenses',  label: '🔑 Licenses' },
    { value: 'broadcast', label: '📣 Broadcast' },
    { value: 'messages',  label: '🔧 Tool Requests' },
    { value: 'traffic',   label: '🌐 Traffic & links' },
  ]},
  { label: 'Site', items: [
    { value: 'media',        label: '🖼️ Media' },
    { value: 'seo',          label: 'SEO' },
    { value: 'style',        label: 'Style' },
    { value: 'translations', label: '🌍 Translations' },
    { value: 'guide',        label: '📖 Guide' },
    { value: 'settings',     label: 'Settings' },
    { value: 'legal',        label: '⚖️ Legal' },
    { value: 'activity',     label: '🕘 Activity' },
  ]},
  { label: 'Danger', items: [
    { value: 'reset', label: '⚠️ Reset', danger: true },
  ]},
];
export const ADMIN_TAB_VALUES = new Set(ADMIN_NAV.flatMap(g => g.items.map(i => i.value)));

export async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries > 0) {
      console.warn('Fetch failed, retrying in 2 s…', err);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}
