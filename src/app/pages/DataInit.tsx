import { useState } from 'react';
import { GlassCard } from '../components/shared/GlassCard';
import { Button } from '../components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, Database, Layers, Users, Settings2, Zap } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ─── Sample Projects (6 total, exercising all fields) ───────────────────────

const sampleProjects = [
  {
    id: 'fintech-explainer',
    slug: 'fintech-explainer',
    title: 'FinTech Product Launch',
    category: 'Product',
    year: 2024,
    description: '2.3M views, 340% increase in sign-ups',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
    videoUrl: '',
    tags: ['Product', 'Animation', 'B2B'],
    featured: true,
    orderIndex: 1,
    client: 'TechCorp Financial',
    goal: 'Launch a new digital banking product to millennials with a clear value proposition and a seamless onboarding flow explanation.',
    approach:
      'Created a fast-paced, modern explainer combining bold typography, smooth transitions, and real UI demonstrations. Focus on trust-building and simplicity.',
    deliverables: [
      '90-second explainer video',
      'Social media cutdowns (15s, 30s, 60s)',
      'Animated UI components library',
      'Brand motion guidelines',
    ],
    outcome: '2.3M views in first month. 340% increase in sign-ups. Featured on Product Hunt.',
    screenshots: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
      'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80',
    ],
  },
  {
    id: 'saas-onboarding',
    slug: 'saas-onboarding',
    title: 'SaaS Onboarding Flow',
    category: 'Product',
    year: 2024,
    description: '40% faster user activation',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    videoUrl: '',
    tags: ['SaaS', 'UI/UX', 'Motion'],
    featured: false,
    orderIndex: 2,
    client: 'CloudSoft Inc',
    goal: 'Reduce user drop-off during onboarding and increase activation rates through clear visual guidance.',
    approach:
      'Designed animated micro-interactions and step-by-step tutorials that guide users through the product setup process.',
    deliverables: [
      'Onboarding video series',
      'Interactive UI animations',
      'Tutorial overlays',
      'Success state animations',
    ],
    outcome: '40% faster user activation and 25% reduction in support tickets.',
    screenshots: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80'],
  },
  {
    id: 'brand-identity',
    slug: 'brand-identity',
    title: 'Tech Brand Identity',
    category: 'Brand',
    year: 2023,
    description: 'Complete visual system in 3 weeks',
    imageUrl: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80',
    videoUrl: '',
    tags: ['Branding', 'Identity', 'Tech'],
    featured: true,
    orderIndex: 3,
    client: 'InnovateTech',
    goal: 'Create a modern, cohesive brand identity that positions the company as an innovative tech leader.',
    approach:
      'Developed a comprehensive visual system including logo, color palette, typography, and motion guidelines.',
    deliverables: [
      'Brand logo & variations',
      'Color system & guidelines',
      'Typography system',
      'Motion design principles',
      'Brand guideline document',
    ],
    outcome: 'Complete visual system delivered in 3 weeks. Brand recognition increased by 200%.',
    screenshots: [
      'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=1200&q=80',
      'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80',
    ],
  },
  {
    id: 'crypto-rebrand',
    slug: 'crypto-rebrand',
    title: 'Crypto Platform Rebrand',
    category: 'Brand',
    year: 2024,
    description: 'Brand recognition up 200%',
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80',
    videoUrl: '',
    tags: ['Branding', 'Crypto', 'Web3'],
    featured: false,
    orderIndex: 4,
    client: 'BlockVault',
    goal: 'Reposition a legacy crypto exchange as a premium, trustworthy platform for institutional investors.',
    approach:
      'Stripped back to core values — security, clarity, speed. New visual language uses geometric motion and dark-mode-first design.',
    deliverables: [
      'Full brand identity system',
      'Motion style guide',
      'App icon animations',
      'Marketing video (60s)',
      'Social media templates',
    ],
    outcome: 'Rebranding completed in 6 weeks. Platform signups up 200% in Q1 post-launch.',
    screenshots: [
      'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=1200&q=80',
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&q=80',
    ],
  },
  {
    id: 'social-campaign',
    slug: 'social-campaign',
    title: 'Viral Social Campaign',
    category: 'Social',
    year: 2023,
    description: '5M impressions in 2 weeks',
    imageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80',
    videoUrl: '',
    tags: ['Social Media', 'Campaign', 'Viral'],
    featured: false,
    orderIndex: 5,
    client: 'FreshDrop Apparel',
    goal: 'Drive awareness of a limited-edition drop across TikTok and Instagram Reels.',
    approach:
      'Produced 12 short-form videos (7–15 seconds each) optimised for native feel — no hard logos, just vibe-first storytelling.',
    deliverables: [
      '12 short-form videos',
      '30 static social graphics',
      'Story templates (IG + TikTok)',
      'Caption & hashtag strategy doc',
    ],
    outcome: '5M impressions in 14 days. Drop sold out in 4 hours. 180K new followers gained.',
    screenshots: [
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&q=80',
    ],
  },
  {
    id: 'ecommerce-ads',
    slug: 'ecommerce-ads',
    title: 'E-commerce Ad Series',
    category: 'Campaign',
    year: 2023,
    description: 'ROAS 8.5x across Meta & TikTok',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
    videoUrl: '',
    tags: ['Performance', 'Ads', 'E-commerce'],
    featured: false,
    orderIndex: 6,
    client: 'NovaSkin',
    goal: 'Build a scalable creative library for Meta and TikTok ads for a DTC skincare brand.',
    approach:
      'Developed a modular creative system — hero hooks, product demos, UGC-style cuts, and testimonial edits — allowing rapid A/B testing.',
    deliverables: [
      '40 video ads (various formats)',
      'Creative brief templates',
      '15 static/carousel ads',
      'Monthly performance audit',
    ],
    outcome: 'Average ROAS of 8.5x over 6 months. CPA down 60% from agency baseline.',
    screenshots: [
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80',
    ],
  },
];

// ─── Sample Tools (3 tools, each with Free / Pro / Studio versions) ──────────

const sampleTools = [
  {
    id: 'ae-automation-toolkit',
    name: 'AE Automation Toolkit',
    slug: 'ae-automation-toolkit',
    description:
      'Professional automation suite for After Effects. Save hours on repetitive tasks with intelligent batch processing, smart cleanup tools, and advanced export management.',
    category: 'Automation',
    tagline: 'Stop doing the same tasks over and over. Let the toolkit handle it.',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80',
    demoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    featured: true,
    orderIndex: 1,
    systemRequirements:
      'After Effects CC 2020 or later\nmacOS 10.14+ or Windows 10+\n8GB RAM minimum (16GB recommended)\n500MB free disk space',
    howItWorks: [
      {
        title: 'Install the Script',
        description:
          'Download and place the script in your After Effects ScriptUI Panels folder. Restart AE.',
      },
      {
        title: 'Configure Your Settings',
        description:
          'Set up your preferred render settings, cleanup rules, and export presets once.',
      },
      {
        title: 'Automate Everything',
        description: 'Run batch operations on multiple projects with one click. Save hours every week.',
      },
    ],
    faqs: [
      {
        question: 'Does this work with the latest version of After Effects?',
        answer: 'Yes! We test and update the toolkit with every new AE release. Free updates included.',
      },
      {
        question: 'Can I use this for client work?',
        answer: 'Absolutely. All our tools come with a commercial license included in the purchase.',
      },
      {
        question: 'What if I need help installing or using the toolkit?',
        answer:
          'Every purchase includes email support and access to our detailed documentation and video tutorials.',
      },
    ],
    versions: [
      {
        id: 'ae-toolkit-free',
        versionType: 'Free',
        pricingModel: 'lifetime',
        lifetimePrice: 'Free',
        downloadUrl: 'https://example.com/download/ae-toolkit-free.zip',
        features: [
          'Basic batch rendering (up to 5 projects)',
          'Simple project cleanup',
          'Standard export presets',
          'Community support',
        ],
        whatsIncluded: [
          'Core automation script',
          'Basic documentation',
          'Community forum access',
          'Monthly updates',
        ],
      },
      {
        id: 'ae-toolkit-pro',
        versionType: 'Pro',
        pricingModel: 'lifetime',
        lifetimePrice: '$49',
        downloadUrl: 'https://example.com/download/ae-toolkit-pro.zip',
        features: [
          'Unlimited batch rendering',
          'Advanced cleanup rules',
          'Custom export presets',
          'Layer management tools',
          'Expression utilities',
          'Email support',
          'Video tutorials included',
        ],
        whatsIncluded: [
          'Full automation suite',
          'Custom preset builder',
          'Advanced documentation',
          'Priority email support',
          'Video tutorial library',
          'Lifetime updates',
          'Commercial license',
        ],
      },
      {
        id: 'ae-toolkit-studio',
        versionType: 'Studio',
        pricingModel: 'subscription',
        monthlyPrice: '$29',
        yearlyPrice: '$249',
        downloadUrl: 'https://example.com/download/ae-toolkit-studio.zip',
        features: [
          'Everything in Pro',
          'Network rendering support',
          'Team collaboration tools',
          'Custom script development',
          'API access for integration',
          'Priority support (24h response)',
          'Dedicated account manager',
          'Custom training sessions',
        ],
        whatsIncluded: [
          'Complete Studio suite',
          'Network render manager',
          'Team license (up to 10 users)',
          'API access & documentation',
          'White-glove onboarding',
          'Monthly video calls',
          'Custom feature requests',
          'Enterprise commercial license',
        ],
      },
    ],
  },
  {
    id: 'motion-presets-pro',
    name: 'Motion Presets Pro',
    slug: 'motion-presets-pro',
    description:
      'The ultimate collection of professional animation presets. Over 200 hand-crafted animations for text, shapes, transitions, and effects. Drag, drop, and deliver stunning motion graphics in minutes.',
    category: 'Animation',
    tagline: 'Professional animations, zero effort. Just drag and drop.',
    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&q=80',
    demoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    featured: true,
    orderIndex: 2,
    systemRequirements:
      'After Effects CC 2019 or later\nmacOS 10.13+ or Windows 10+\n4GB RAM minimum\n2GB free disk space for all presets',
    howItWorks: [
      {
        title: 'Browse the Library',
        description:
          'Access 200+ categorized presets through our custom AE panel. Preview each animation before applying.',
      },
      {
        title: 'Drag & Drop',
        description: 'Simply drag any preset onto your layer. All parameters are automatically configured.',
      },
      {
        title: 'Customize & Export',
        description:
          'Tweak timing, colors, and effects to match your brand. Render and deliver professional results.',
      },
    ],
    faqs: [
      {
        question: 'Are these presets compatible with older AE versions?',
        answer:
          'The presets work with After Effects CC 2019 and later. For older versions, please contact support.',
      },
      {
        question: 'Can I customize the presets?',
        answer: 'Yes! All presets are fully editable. Change colors, timing, scale, and any other parameter.',
      },
      {
        question: 'Do you add new presets regularly?',
        answer: 'We release new preset packs every month. All updates are free for Pro and Studio users.',
      },
    ],
    versions: [
      {
        id: 'motion-presets-free',
        versionType: 'Free',
        pricingModel: 'lifetime',
        lifetimePrice: 'Free',
        downloadUrl: 'https://example.com/download/motion-presets-free.zip',
        features: [
          '25 basic animation presets',
          'Text animations',
          'Simple transitions',
          'Community support',
        ],
        whatsIncluded: [
          '25 starter presets',
          'Installation guide',
          'Basic tutorial video',
          'Community forum access',
        ],
      },
      {
        id: 'motion-presets-pro-v',
        versionType: 'Pro',
        pricingModel: 'lifetime',
        lifetimePrice: '$79',
        downloadUrl: 'https://example.com/download/motion-presets-pro.zip',
        features: [
          '200+ professional presets',
          'Text, shape & transition animations',
          'VFX and particle effects',
          'Custom color controls',
          'Monthly new preset packs',
          'Video tutorials',
          'Email support',
        ],
        whatsIncluded: [
          'Complete 200+ preset library',
          'Custom browser panel',
          'Organised by category',
          'Full video course (3 hours)',
          'Project files included',
          'Lifetime updates',
          'Commercial license',
          'Priority support',
        ],
      },
      {
        id: 'motion-presets-studio',
        versionType: 'Studio',
        pricingModel: 'subscription',
        monthlyPrice: '$19',
        yearlyPrice: '$159',
        downloadUrl: 'https://example.com/download/motion-presets-studio.zip',
        features: [
          'Everything in Pro',
          '500+ premium presets',
          'Weekly new releases',
          'Custom preset creation service',
          'Brand kit integration',
          'Team sharing & sync',
          'Priority support',
          'Exclusive Studio-only presets',
        ],
        whatsIncluded: [
          'Complete 500+ preset library',
          'Advanced Studio panel',
          'Brand color sync',
          'Team cloud library (up to 5 users)',
          'Custom preset requests (2/month)',
          'Weekly video tutorials',
          '1-on-1 training sessions',
          'Enterprise commercial license',
        ],
      },
    ],
  },
  {
    id: 'ae-expression-library',
    name: 'AE Expression Library',
    slug: 'ae-expression-library',
    description:
      'A curated library of 150+ production-ready After Effects expressions. From dynamic text counters to procedural looping animations — stop writing code from scratch and ship faster.',
    category: 'Workflow',
    tagline: 'Copy, paste, animate. No coding knowledge required.',
    imageUrl: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=600&q=80',
    demoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    featured: false,
    orderIndex: 3,
    systemRequirements:
      'After Effects CC 2018 or later\nmacOS 10.12+ or Windows 10+\n4GB RAM minimum\n150MB free disk space',
    howItWorks: [
      {
        title: 'Open the Panel',
        description:
          'Launch the Expression Library panel from Window > Extensions. Browse by category or search by keyword.',
      },
      {
        title: 'Preview & Copy',
        description:
          'Click any expression to see a live preview. Copy it to clipboard with one click.',
      },
      {
        title: 'Paste & Customise',
        description:
          'Paste directly into an AE expression field. Adjust the highlighted variables for your project.',
      },
    ],
    faqs: [
      {
        question: 'Do I need to know how to code?',
        answer:
          'No. Every expression has clearly labelled variables you can tweak without understanding the underlying code.',
      },
      {
        question: 'Will these expressions break in future AE updates?',
        answer:
          'We audit every expression after each AE release and push free patches within 48 hours if anything breaks.',
      },
      {
        question: 'Can I request new expressions?',
        answer:
          'Pro and Studio users can submit expression requests. We build the most-requested ones every month.',
      },
      {
        question: 'Is there a refund policy?',
        answer:
          'Yes — 14-day no-questions-asked refund on all one-time purchases. Subscriptions can be cancelled anytime.',
      },
    ],
    versions: [
      {
        id: 'expr-lib-free',
        versionType: 'Free',
        pricingModel: 'lifetime',
        lifetimePrice: 'Free',
        downloadUrl: 'https://example.com/download/ae-expression-library-free.zip',
        features: [
          '20 essential expressions',
          'Text counter & timer',
          'Basic loop expressions',
          'Wiggle variations (5 types)',
          'Community forum access',
        ],
        whatsIncluded: [
          '20 starter expressions',
          'Cheat-sheet PDF',
          'Community forum access',
          'Free updates to starter pack',
        ],
      },
      {
        id: 'expr-lib-pro',
        versionType: 'Pro',
        pricingModel: 'lifetime',
        lifetimePrice: '$39',
        downloadUrl: 'https://example.com/download/ae-expression-library-pro.zip',
        features: [
          '150+ production-ready expressions',
          'Dynamic text & counters',
          'Procedural animation rigs',
          'Physics simulations',
          'Data-driven animations (JSON)',
          'Easing curve library',
          'Email support',
          'Lifetime updates',
        ],
        whatsIncluded: [
          'Complete 150+ expression library',
          'In-panel search & preview',
          'Categories: Motion, Text, UI, Data, Physics',
          'Full documentation site',
          'Video walkthrough (2 hours)',
          'Lifetime updates',
          'Commercial license',
          'Priority email support',
        ],
      },
      {
        id: 'expr-lib-studio',
        versionType: 'Studio',
        pricingModel: 'subscription',
        monthlyPrice: '$15',
        yearlyPrice: '$129',
        downloadUrl: 'https://example.com/download/ae-expression-library-studio.zip',
        features: [
          'Everything in Pro',
          '250+ expressions & growing',
          'Weekly new additions',
          'Team expression vault (shared library)',
          'Custom expression requests (1/month)',
          'Priority Slack support',
          'Monthly live Q&A sessions',
          'Early access to new releases',
        ],
        whatsIncluded: [
          'Complete 250+ expression library',
          'Shared team vault (up to 8 users)',
          'Private Slack community',
          'Monthly custom expression request',
          'Live Q&A recordings archive',
          'Early-access beta releases',
          'Enterprise commercial license',
        ],
      },
    ],
  },
];

// ─── Sample Team (3 members) ─────────────────────────────────────────────────

const sampleTeam = [
  {
    id: 'team-1',
    name: 'Alex Rivera',
    role: 'Motion Design Director',
    bio: '15+ years in motion design for global brands. Former creative lead at top agencies. Obsessed with the intersection of storytelling and technology.',
    imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
    orderIndex: 1,
    socialLinks: {
      linkedin: 'https://linkedin.com/in/alexrivera',
      twitter: 'https://twitter.com/alexrivera',
    },
  },
  {
    id: 'team-2',
    name: 'Sam Chen',
    role: 'Lead Animator',
    bio: 'Award-winning animator specialised in character animation and visual effects. Previously at Pixar and Framestore.',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
    orderIndex: 2,
    socialLinks: {
      linkedin: 'https://linkedin.com/in/samchen',
      dribbble: 'https://dribbble.com/samchen',
    },
  },
  {
    id: 'team-3',
    name: 'Nadia Osei',
    role: 'Creative Strategist',
    bio: 'Bridges the gap between brand strategy and motion design. 10+ years helping DTC and B2B brands find their visual voice.',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
    orderIndex: 3,
    socialLinks: {
      linkedin: 'https://linkedin.com/in/nadiaosei',
      instagram: 'https://instagram.com/nadiaosei',
    },
  },
];

// ─── Summary of what will be seeded ──────────────────────────────────────────

const SEED_SUMMARY = [
  {
    icon: Database,
    label: 'Projects',
    count: sampleProjects.length,
    detail: 'Product, Brand, Social, Campaign',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Zap,
    label: 'Tools',
    count: sampleTools.length,
    detail: 'Automation, Animation, Workflow',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: Layers,
    label: 'Tool Versions',
    count: sampleTools.reduce((n, t) => n + t.versions.length, 0),
    detail: 'Free / Pro / Studio per tool',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
  },
  {
    icon: Users,
    label: 'Team Members',
    count: sampleTeam.length,
    detail: 'Director, Animator, Strategist',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  {
    icon: Settings2,
    label: 'Site Settings',
    count: 4,
    detail: 'Showreel, categories, socials',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

type LogLine = { type: 'info' | 'success' | 'error' | 'warn'; text: string };

export function DataInit() {
  const [log, setLog] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const addLog = (type: LogLine['type'], text: string) =>
    setLog((prev) => [...prev, { type, text }]);

  const seedData = async () => {
    setLoading(true);
    setDone(false);
    setLog([]);

    addLog('info', `Starting data init — ${sampleProjects.length} projects, ${sampleTools.length} tools (${sampleTools.reduce((n, t) => n + t.versions.length, 0)} versions), ${sampleTeam.length} team members…`);

    try {
      const response = await fetch(`${API_BASE}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          projects: sampleProjects,
          tools: sampleTools,
          team: sampleTeam,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const c = result.counts;
        addLog('success', `✓ Projects inserted: ${c.projects}`);
        addLog(c.tools > 0 ? 'success' : 'error', `${c.tools > 0 ? '✓' : '✗'} Tools inserted: ${c.tools}`);
        addLog(c.versions > 0 ? 'success' : 'error', `${c.versions > 0 ? '✓' : '✗'} Tool versions inserted: ${c.versions}`);
        addLog('success', `✓ Team members inserted: ${c.team}`);
        addLog('success', `✓ Site settings seeded: ${c.settings}`);

        if (result.errors?.length) {
          addLog('error', `── ${result.errors.length} error(s) detected ──`);
          result.errors.forEach((e: string) => addLog('error', `✗ ${e}`));
        } else {
          addLog('success', '✓ No errors — all data seeded cleanly.');
        }

        addLog('success', '🎉 Init complete! Your database is ready to test.');
        setDone(true);
      } else {
        console.error('Init error:', result.error);
        addLog('error', `✗ Server error: ${result.error}`);
      }
    } catch (error) {
      console.error('Init fetch error:', error);
      addLog('error', `✗ Network error: ${String(error)}`);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
      <GlassCard className="p-8 max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <CheckCircle2 className="w-14 h-14 text-purple-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Initialize CMS Data</h1>
          <p className="text-white/60">
            Seeds your Supabase database with sample content — projects, tools with versioned
            pricing, team members, and site settings. Safe to run multiple times (clears &amp;
            re-inserts each time).
          </p>
        </div>

        {/* What will be seeded */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {SEED_SUMMARY.map(({ icon: Icon, label, count, detail, color, bg, border }) => (
            <div
              key={label}
              className={`rounded-xl border ${border} ${bg} p-4 flex flex-col gap-1`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`text-sm font-semibold ${color}`}>{label}</span>
              </div>
              <span className="text-2xl font-bold text-white">{count}</span>
              <span className="text-xs text-white/40">{detail}</span>
            </div>
          ))}
        </div>

        {/* Tools preview */}
        <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Tools being seeded
          </p>
          <div className="space-y-3">
            {sampleTools.map((tool) => (
              <div key={tool.id} className="flex items-start gap-3">
                <img
                  src={tool.imageUrl}
                  alt={tool.name}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{tool.name}</p>
                  <p className="text-xs text-white/40">{tool.category}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {tool.versions.map((v) => (
                      <span
                        key={v.id}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          v.versionType === 'Free'
                            ? 'bg-green-500/20 text-green-300'
                            : v.versionType === 'Pro'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {v.versionType}{' '}
                        {v.pricingModel === 'subscription'
                          ? `${v.monthlyPrice}/mo`
                          : v.lifetimePrice}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Seed button */}
        <Button
          onClick={seedData}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 text-base font-semibold disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Seeding Data…
            </span>
          ) : done ? (
            '↺ Re-seed (Clears & Re-inserts)'
          ) : (
            '🌱 Seed Sample Data'
          )}
        </Button>

        {/* Log output */}
        {log.length > 0 && (
          <div className="mt-6 p-4 bg-black/60 rounded-xl border border-white/10 font-mono text-xs space-y-1 max-h-56 overflow-y-auto">
            {log.map((line, i) => (
              <p
                key={i}
                className={
                  line.type === 'success'
                    ? 'text-green-400'
                    : line.type === 'error'
                    ? 'text-red-400'
                    : line.type === 'warn'
                    ? 'text-amber-400'
                    : 'text-white/60'
                }
              >
                {line.text}
              </p>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">After seeding, test these pages:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: '/projects', label: '📁 Projects' },
              { href: '/tools', label: '🔧 Tools' },
              { href: '/about', label: '👥 About' },
              { href: '/work-with-us', label: '📬 Work With Us' },
              { href: '/admin/login', label: '🔑 Admin Login' },
              { href: '/admin', label: '⚙️ Admin Panel' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors text-center"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}