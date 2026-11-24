// Use-case pages ("How to automate X in After Effects") and per-tool
// audience info. Both are stored as site settings so they are edited from
// Admin → Use cases without a server change:
//   settings.useCases   → UseCase[]
//   settings.toolExtras → Record<toolSlug, ToolExtras>
// They are rendered by /use-cases, /use-cases/:slug, the tool pages, and the
// prerender script (pages for crawlers, structured data, llms.txt).

export interface UseCaseStep { title: string; text: string }
export interface UseCaseFaq { q: string; a: string }

export interface UseCase {
  id: string;
  slug: string;
  title: string;          // the question people search, phrased as a task
  toolSlug: string;       // which tool solves it
  summary: string;        // 1–2 sentence answer shown first
  audience: string[];     // who has this problem
  problem: string;        // why doing it by hand hurts
  steps: UseCaseStep[];
  example?: string;       // a concrete example (numbers help)
  faq: UseCaseFaq[];
  published: boolean;
  updatedAt?: string;
}

export interface ToolExtras {
  audience?: string[];    // "Who it's for"
  automates?: string[];   // "What it automates"
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const publishedUseCases = (all: unknown): UseCase[] =>
  (Array.isArray(all) ? all as UseCase[] : []).filter(u => u && u.published && u.slug && u.title);

// ── Drafts ───────────────────────────────────────────────────────────────────
// Starting points written from the tool's documented features. They are
// loaded UNPUBLISHED — review every claim before publishing.
const DA = 'fastoosh-data-automator';

export const DRAFT_USE_CASES: Omit<UseCase, 'id'>[] = [
  {
    slug: 'automate-lower-thirds-from-excel-after-effects',
    title: 'Automate lower thirds and name titles from Excel in After Effects',
    toolSlug: DA,
    summary: 'Design one lower third in After Effects, list every name and title in an Excel sheet, and Fastoosh Data Automator generates one finished composition per row — no copy-pasting text layer by layer.',
    audience: ['Motion designers', 'Video editors', 'Event and broadcast teams', 'Studios delivering name titles in bulk'],
    problem: 'Typing 50 or 200 names into duplicated compositions takes hours, and every manual edit is a chance for a typo, a wrong title or a misnamed file.',
    steps: [
      { title: 'Build one template', text: 'Design a single lower-third composition with text layers for the name and the job title (and an image layer if you show a logo).' },
      { title: 'List the people in a spreadsheet', text: 'One row per person and one column per field, for example Name and Title. Excel (XLSX), CSV and JSON files all work.' },
      { title: 'Load the data', text: 'Open Data Automator in After Effects, load the file and pick the sheet. It scans the template\'s layers.' },
      { title: 'Map columns to layers', text: 'Link each column to its layer with the KeyMap builder. Save the KeyMap to reuse it for the next event.' },
      { title: 'Dry run, then generate', text: 'Use Dry Run to check the data, then generate one composition per row with your own naming prefix and send them to the Render Queue.' },
    ],
    example: 'A conference with 40 speakers: one template plus a 40-row sheet gives 40 named lower-third compositions, ready to render.',
    faq: [
      { q: 'Can I use an Excel file directly?', a: 'Yes. Data Automator reads XLSX files and lets you choose which sheet to use. CSV and JSON work too.' },
      { q: 'Can I reuse the same setup for the next event?', a: 'Yes. Export the KeyMap and import it next time, then load the new spreadsheet.' },
      { q: 'How many names can I generate at once?', a: 'The free version handles up to 10 rows per run. Paid versions have no row limit.' },
    ],
    published: false,
  },
  {
    slug: 'localized-versions-after-effects-template',
    title: 'Create localized versions of an After Effects template',
    toolSlug: DA,
    summary: 'Keep every language in one spreadsheet — one row per language or market — and generate a separate After Effects composition for each version from a single template.',
    audience: ['Studios and agencies with international clients', 'Marketing teams', 'Motion designers'],
    problem: 'Duplicating a project for every language and swapping text by hand is slow, and late copy changes mean redoing every version.',
    steps: [
      { title: 'Prepare the master template', text: 'Build the animation once, with every piece of on-screen text on its own text layer.' },
      { title: 'Put translations in a sheet', text: 'One row per language or market, one column per text field. The sheet can be a local file or a shared online sheet the translators fill in.' },
      { title: 'Map and validate', text: 'Link each column to its layer with the KeyMap builder and run a Dry Run to catch empty or missing fields.' },
      { title: 'Generate the versions', text: 'Data Automator creates one composition per language, named with your prefix, ready for the Render Queue.' },
    ],
    example: 'One 20-second promo in English, French, Arabic and Spanish: four rows, four finished compositions.',
    faq: [
      { q: 'Does it work with nested precomps?', a: 'Yes. Data Automator has a nested precomp policy so text inside precompositions can be updated per version.' },
      { q: 'What happens when the copy changes?', a: 'Update the spreadsheet and generate again — no manual retyping in each version.' },
    ],
    published: false,
  },
  {
    slug: 'social-media-ad-variants-from-spreadsheet',
    title: 'Generate social media ad variants from a spreadsheet in After Effects',
    toolSlug: DA,
    summary: 'Turn one After Effects ad template into many variants — different headlines, prices, images or colors — by filling a spreadsheet instead of editing each version.',
    audience: ['Performance marketing teams', 'Agencies running A/B tests', 'Motion designers', 'E-commerce brands'],
    problem: 'Ad testing needs many small variations. Making each one by hand is repetitive, error-prone and slow to update.',
    steps: [
      { title: 'Build the ad template', text: 'Create the ad once with layers for the headline, price, product image and brand color.' },
      { title: 'Plan variants in a sheet', text: 'Each row is one ad variant; columns hold the text, image file and color values.' },
      { title: 'Map columns to layers', text: 'Link text, image and color columns to their layers with the KeyMap builder.' },
      { title: 'Generate and render', text: 'Create every variant as its own composition and queue them for rendering.' },
    ],
    example: '5 headlines × 3 product images = 15 ad variants from one template and one 15-row sheet.',
    faq: [
      { q: 'Can it change images and colors, not just text?', a: 'Yes. Columns can be linked to text, image and color properties in the template.' },
      { q: 'Can I name the outputs for my ad platform?', a: 'Yes. Set a custom prefix and output naming so each composition is easy to identify.' },
    ],
    published: false,
  },
  {
    slug: 'conference-speaker-titles-event-graphics',
    title: 'Make conference speaker titles and event graphics in bulk',
    toolSlug: DA,
    summary: 'Event teams keep the speaker list in a spreadsheet; Data Automator turns it into speaker titles, session slides or name screens in After Effects — one composition per speaker.',
    audience: ['Event production teams', 'Conference organizers', 'Videographers covering events', 'Motion designers'],
    problem: 'Speaker lists change until the last minute. Rebuilding graphics by hand every time a name or title changes is stressful and risky on event day.',
    steps: [
      { title: 'Design one speaker graphic', text: 'Text layers for name, role and company; an image layer for a photo or logo if needed.' },
      { title: 'Use the organizer\'s speaker sheet', text: 'Keep one row per speaker. A shared online sheet lets the organizer update it directly.' },
      { title: 'Map, check, generate', text: 'Link columns to layers, run a Dry Run, then generate every speaker graphic at once.' },
      { title: 'Update late changes', text: 'When the list changes, update the sheet and regenerate instead of editing compositions one by one.' },
    ],
    example: 'A 25-speaker conference: one speaker-title template and a 25-row sheet give 25 finished compositions. (Fastoosh produces event videos for conferences such as the Morocco Berry and Tomato Conferences.)',
    faq: [
      { q: 'Can the organizer edit the list instead of me?', a: 'Yes. Data Automator can read online sheets, so the organizer updates the sheet and you regenerate.' },
      { q: 'Can I find a specific speaker\'s composition quickly?', a: 'Yes. The Generated Comps Navigator lists every generated composition so you can jump to one directly.' },
    ],
    published: false,
  },
  {
    slug: 'generate-after-effects-compositions-from-google-sheets',
    title: 'Generate After Effects compositions from Google Sheets',
    toolSlug: DA,
    summary: 'Connect a Google Sheet to an After Effects template so your team edits data online and Data Automator builds one composition per row.',
    audience: ['Studios and teams sharing data', 'Producers and project managers', 'Motion designers'],
    problem: 'Exporting and emailing spreadsheets back and forth creates version confusion. Teams want one live source of data.',
    steps: [
      { title: 'Connect Google Sheets', text: 'Sign in with Google (OAuth) from Data Automator, or load a sheet by URL. SharePoint and OneDrive links work too.' },
      { title: 'Pick the sheet and map it', text: 'Choose the tab, then link each column to a template layer with the KeyMap builder.' },
      { title: 'Validate with a Dry Run', text: 'Check the data before anything is created.' },
      { title: 'Generate and queue', text: 'Create one composition per row and add them to the Render Queue.' },
    ],
    example: 'A producer fills a shared sheet with 30 product names and prices; the designer generates all 30 versions without retyping anything.',
    faq: [
      { q: 'Do I need to download the sheet first?', a: 'No. Data Automator can read Google Sheets directly through your Google account, or by URL.' },
      { q: 'Can I export the template\'s fields to start a sheet?', a: 'Yes. Skeleton export creates an Excel or Google Sheet with the right columns for your template.' },
    ],
    published: false,
  },
];

export const DRAFT_TOOL_EXTRAS: Record<string, ToolExtras> = {
  [DA]: {
    audience: ['Motion designers', 'Video editors', 'Videographers', 'Design studios and agencies', 'Event production teams', 'Marketing teams'],
    automates: [
      'Duplicating compositions for every version',
      'Typing names, titles and copy into text layers',
      'Swapping images, logos and colors per version',
      'Naming output compositions consistently',
      'Adding generated versions to the Render Queue',
    ],
  },
  'cep-packager': {
    audience: ['Developers of Adobe CEP extensions', 'Script and tool makers for After Effects and Premiere Pro', 'Studios distributing internal tools'],
    automates: [
      'Checking and fixing the extension manifest',
      'Creating and managing signing certificates',
      'Obfuscating JavaScript before release',
      'Signing and building the .zxp installer',
    ],
  },
};
