import * as kv from './kv_store.tsx';

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

// Service-role client — for DB operations and admin tasks (bypasses RLS)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);



// Initialize storage buckets on startup
const BUCKET_NAME       = 'make-e07959ec-images';
const VIDEO_BUCKET_NAME = 'make-e07959ec-videos';
const BRAND_BUCKET_NAME = 'make-e07959ec-brand';

async function initializeStorage() {
  try {
    console.log('Initializing storage buckets...');
    
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    // Initialize image bucket
    const imageBucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!imageBucketExists) {
      console.log('Creating image storage bucket:', BUCKET_NAME);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB limit
      });
      
      if (error && (error.message?.includes('already exists') || error?.statusCode === '409')) {
        console.log('Image bucket already exists (409 error caught)');
      } else if (error) {
        console.error('Error creating image bucket:', error);
      } else {
        console.log('Image bucket created successfully');
      }
    } else {
      console.log('Image bucket already exists');
    }
    
    // Initialize video bucket
    const videoBucketExists = buckets?.some(bucket => bucket.name === VIDEO_BUCKET_NAME);
    
    if (!videoBucketExists) {
      console.log('Creating video storage bucket:', VIDEO_BUCKET_NAME);
      const { error } = await supabase.storage.createBucket(VIDEO_BUCKET_NAME, {
        public: true,
      });
      
      if (error && (error.message?.includes('already exists') || error?.statusCode === '409')) {
        console.log('Video bucket already exists (409 error caught)');
      } else if (error) {
        console.error('Error creating video bucket:', error);
      } else {
        console.log('Video bucket created successfully');
      }
    } else {
      console.log('Video bucket already exists');
    }

    // Initialize brand bucket (public — logo is a public asset)
    const brandBucketExists = buckets?.some(bucket => bucket.name === BRAND_BUCKET_NAME);
    if (!brandBucketExists) {
      console.log('Creating brand storage bucket:', BRAND_BUCKET_NAME);
      const { error } = await supabase.storage.createBucket(BRAND_BUCKET_NAME, {
        public: true,
        fileSizeLimit: 5242880, // 5 MB
      });
      if (error && (error.message?.includes('already exists') || error?.statusCode === '409')) {
        console.log('Brand bucket already exists (409 caught)');
      } else if (error) {
        console.error('Error creating brand bucket:', error);
      } else {
        console.log('Brand bucket created successfully');
      }
    } else {
      console.log('Brand bucket already exists');
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

// Initialize storage on startup
initializeStorage();

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-e07959ec/health", (c) => {
  return c.json({ status: "ok" });
});

// ========== AUTH MIDDLEWARE ==========

// ── Field-name helpers ──────────────────────────────────────────────────────
// The frontend uses camelCase; the DB uses snake_case.
// These helpers translate at the API boundary so neither side has to change.

const camelToSnake = (s: string) =>
  s.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);

const snakeToCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

/** Converts all top-level keys of an object from camelCase → snake_case. */
const toDbRow = (obj: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) out[camelToSnake(k)] = v;
  return out;
};

/** Converts all keys of an object (and nested arrays) from snake_case → camelCase. */
const fromDbRow = (obj: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const ck = snakeToCamel(k);
    if (Array.isArray(v)) {
      out[ck] = v.map(item =>
        item !== null && typeof item === 'object' ? fromDbRow(item) : item
      );
    } else {
      out[ck] = v;
    }
  }
  return out;
};

/**
 * Like fromDbRow but also remaps the Supabase join key `toolVersions`
 * (which comes from the `tool_versions` table name) to `versions`,
 * which is what every frontend page expects.
 */
const normalizeTool = (tool: Record<string, any>): Record<string, any> => {
  const t = fromDbRow(tool);
  // Remap toolVersions → versions
  if (t.toolVersions !== undefined) {
    t.versions = t.toolVersions;
    delete t.toolVersions;
  }
  // Extract hidden sentinel entries from faqs and surface them as first-class fields:
  //   🎬  → tool.demoUrl    (video URL)
  //   📋  → tool.howItWorks (JSON array of { title, description } steps)
  if (Array.isArray(t.faqs)) {
    const demoEntry = t.faqs.find((f: any) => f.question === '🎬');
    if (demoEntry) {
      t.demoUrl = demoEntry.answer;
    }
    const hiwEntry = t.faqs.find((f: any) => f.question === '📋');
    if (hiwEntry) {
      try { t.howItWorks = JSON.parse(hiwEntry.answer); } catch { t.howItWorks = []; }
    }
    const sysReqEntry = t.faqs.find((f: any) => f.question === '🖥️');
    if (sysReqEntry) {
      t.systemRequirements = sysReqEntry.answer;
    }
    const taglineEntry = t.faqs.find((f: any) => f.question === '🏷️');
    if (taglineEntry) {
      t.tagline = taglineEntry.answer;
    }
    // Strip sentinels so they never appear in the visible FAQ list
    t.faqs = t.faqs.filter((f: any) =>
      f.question !== '🎬' && f.question !== '📋' && f.question !== '🖥️' && f.question !== '🏷️'
    );
  }

  // Decode version-level sentinel info stored in features[]
  // 💰 <encoded>  → version.pricingModel + individual price fields + pricingDisplay
  //   "Free"                      → pricingDisplay = 'Free'
  //   "subscription|<mo>|<yr>"   → pricingModel, monthlyPrice, yearlyPrice, pricingDisplay
  //   "lifetime|<price>"          → pricingModel, lifetimePrice, pricingDisplay
  // 📦 <item>     → version.whatsIncluded[]
  if (Array.isArray(t.versions)) {
    t.versions = t.versions.map((v: any) => {
      if (!Array.isArray(v.features)) return v;
      const priceEntry = v.features.find((f: string) => typeof f === 'string' && f.startsWith('💰 '));
      if (priceEntry) {
        const raw = (priceEntry as string).replace('💰 ', '');
        if (raw === 'Free') {
          v.pricingDisplay = 'Free';
        } else if (raw.startsWith('subscription|') || raw.startsWith('lifetime|')) {
          // Unambiguous pipe-delimited format introduced to replace the old plain-text format
          const [model, p1, p2] = raw.split('|');
          v.pricingModel = model;
          if (model === 'subscription') {
            v.monthlyPrice   = p1 || '';
            v.yearlyPrice    = p2 || '';
            v.pricingDisplay = [v.monthlyPrice, v.yearlyPrice ? v.yearlyPrice + '/yr' : ''].filter(Boolean).join(' / ');
          } else {
            v.lifetimePrice  = p1 || '';
            v.pricingDisplay = v.lifetimePrice;
          }
        } else {
          // Legacy plain-text format — surface for display only; admin must re-enter prices on edit
          v.pricingDisplay = raw;
        }
      }
      const includedEntries = v.features.filter((f: string) => typeof f === 'string' && f.startsWith('📦 '));
      if (includedEntries.length > 0) {
        v.whatsIncluded = includedEntries.map((f: string) => f.replace('📦 ', ''));
      }
      // Decode activation steps
      const stepEntries = v.features.filter((f: string) => typeof f === 'string' && f.startsWith('🔑 '));
      if (stepEntries.length > 0) {
        v.activationSteps = stepEntries.map((f: string) => f.replace('🔑 ', ''));
      }
      // Decode rich features with screenshots (🎨 JSON)
      const richFeatEntries = v.features.filter((f: string) => typeof f === 'string' && f.startsWith('🎨 '));
      if (richFeatEntries.length > 0) {
        v.richFeatures = richFeatEntries.map((f: string) => {
          try { return JSON.parse(f.replace('🎨 ', '')); } catch { return null; }
        }).filter(Boolean);
      }
      v.features = v.features.filter(
        (f: string) => typeof f === 'string' && !f.startsWith('💰 ') && !f.startsWith('📦 ') && !f.startsWith('🔑 ') && !f.startsWith('🎨 ')
      );
      return v;
    });
  }

  return t;
};
// ────────────────────────────────────────────────────────────────────────────

// ── Admin session auth ────────────────────────────────────────────────────
// The Supabase edge-function gateway validates the standard `Authorization`
// header BEFORE the request reaches Hono — sending a UUID there causes a 401
// from Supabase itself, never reaching our code.
//
// Solution: `Authorization: Bearer <anonKey>` satisfies Supabase's gateway;
// our opaque UUID session token travels in a separate `X-Admin-Token` header
// that Supabase ignores entirely.
const requireAuth = async (c: any, next: any) => {
  try {
    const token = c.req.header('X-Admin-Token')?.trim();

    if (!token) {
      console.log('❌ Admin auth: no X-Admin-Token header');
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const session = await kv.get(`admin_session:${token}`);

    if (!session) {
      console.log('❌ Admin auth: session not found for token prefix', token.substring(0, 8));
      return c.json({ success: false, error: 'Invalid or expired session' }, 401);
    }

    if (new Date(session.expiresAt) < new Date()) {
      console.log('❌ Admin auth: session expired');
      await kv.del(`admin_session:${token}`);
      return c.json({ success: false, error: 'Session expired — please log in again' }, 401);
    }

    console.log('✅ Admin auth OK:', session.email);
    c.set('user', { id: session.userId, email: session.email });
    await next();
  } catch (error) {
    console.log('❌ Error in admin auth middleware:', error);
    return c.json({ success: false, error: `Unauthorized - ${String(error)}` }, 401);
  }
};

// ── User JWT auth middleware ───────────────────────────────────────────────
const requireUserAuth = async (c: any, next: any) => {
  try {
    // Read the user JWT from the custom X-User-Token header.
    // We avoid Authorization for user JWTs because the Supabase gateway
    // (verify_jwt = true default) rejects ES256 asymmetric tokens before
    // they reach our code. The anon key rides in Authorization; the real
    // user JWT comes in X-User-Token, which the gateway never inspects.
    const token = c.req.header('X-User-Token') || '';
    if (!token) {
      console.log('requireUserAuth: missing X-User-Token header');
      return c.json({ success: false, error: 'Unauthorized — no X-User-Token header' }, 401);
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log('requireUserAuth: token rejected —', error?.message);
      return c.json({ success: false, error: `Invalid or expired session — ${error?.message}` }, 401);
    }
    c.set('user', { id: user.id, email: user.email });
    await next();
  } catch (err) {
    console.log('requireUserAuth: unexpected error —', String(err));
    return c.json({ success: false, error: `Unauthorized — ${String(err)}` }, 401);
  }
};
// ────────────────────────────────────────────────────────────────────────────

// ========== AUTH ENDPOINTS ==========

// Sign up endpoint (creates user)
app.post("/make-server-e07959ec/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, fullName } = body;

    if (!email || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName || '' },
      email_confirm: true, // Auto-confirm since email server not configured
    });

    if (error) {
      console.log(`Error creating user: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }

    return c.json({ 
      success: true, 
      data: { 
        user: {
          id: data.user.id,
          email: data.user.email,
        }
      } 
    });
  } catch (error) {
    console.log(`Error in signup: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Login endpoint
app.post('/make-server-e07959ec/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    // Create a client with anon key for auth
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error || !data.user || !data.session) {
      console.log('Login failed:', error?.message);
      return c.json({ success: false, error: error?.message || 'Authentication failed' }, 401);
    }
    
    console.log('✅ Credentials verified for:', data.user.email);

    // Mint an opaque server-side session token (UUID) stored in KV.
    // This is completely independent of Supabase JWT/OAuth — no client-side
    // JWT crypto, no supabase.auth state conflicts.
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day session

    await kv.set(`admin_session:${sessionToken}`, {
      userId:    data.user.id,
      email:     data.user.email,
      expiresAt: expiresAt.toISOString(),
    });

    console.log('✅ Admin session created for:', data.user.email);

    return c.json({
      success: true,
      session: {
        access_token: sessionToken, // opaque UUID — verified server-side in KV
      },
      user: {
        id:    data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    console.log('Login error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get current user
app.get("/make-server-e07959ec/auth/me", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    
    // Get user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.log(`Error fetching user profile: ${error.message}`);
    }
    
    return c.json({ 
      success: true, 
      data: {
        id: user.id,
        email: user.email,
        ...(profile ?? {}),
      }
    });
  } catch (error) {
    console.log(`Error in auth/me: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Test auth endpoint (for debugging)
app.get("/make-server-e07959ec/auth/test", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    console.log('Auth test successful for user:', user.id, user.email);
    
    return c.json({ 
      success: true, 
      message: 'Authentication working!',
      user: {
        id: user.id,
        email: user.email,
      }
    });
  } catch (error) {
    console.log(`Error in auth test: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Logout endpoint — deletes the server-side KV session
app.post("/make-server-e07959ec/logout", requireAuth, async (c) => {
  try {
    const token = c.req.header('X-Admin-Token')?.trim();
    if (token) {
      await kv.del(`admin_session:${token}`);
      console.log('✅ Admin session deleted');
    }
    return c.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.log(`Error in logout: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== JSON REPAIR HELPER ==========
// Closes truncated JSON strings/objects that result from token-limit cutoffs
function repairJson(raw: string): string {
  let s = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try { JSON.parse(s); return s; } catch {}

  const opens: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') opens.push('}');
      else if (ch === '[') opens.push(']');
      else if (ch === '}' || ch === ']') opens.pop();
    }
  }

  if (inString) s += '"';
  s += opens.reverse().join('');
  return s;
}

// ========== AI CONTENT GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-tool-content", requireAuth, async (c) => {
  try {
    const { tool, versions, instruction = '', improveExisting = false } = await c.req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return c.json({ success: false, error: 'GEMINI_API_KEY not configured in environment' }, 500);
    }

    const toolName = (tool.name || '').trim();
    if (!toolName) {
      return c.json({ success: false, error: 'Tool name is required to generate content' }, 400);
    }
    const toolCategory = (tool.category || 'After Effects').trim();

    // ── Determine which fields need generation ──────────────────────────────
    // improveExisting=true  → rewrite mode: all fields are regenerated
    // improveExisting=false → fill mode: only empty fields are generated
    const gen: Record<string, boolean> = {};
    if (improveExisting || !tool.description?.trim())         gen.description        = true;
    if (improveExisting || !tool.tagline?.trim())             gen.tagline            = true;
    if (improveExisting || !tool.systemRequirements?.trim())  gen.systemRequirements = true;

    const hiwEmpty = !tool.howItWorks || tool.howItWorks.length === 0 ||
      tool.howItWorks.every((s: any) => !s.title?.trim() && !s.description?.trim());
    if (improveExisting || hiwEmpty) gen.howItWorks = true;

    const faqsEmpty = !tool.faqs || tool.faqs.length === 0 ||
      tool.faqs.every((f: any) => !f.question?.trim());
    if (improveExisting || faqsEmpty) gen.faqs = true;

    const versionsNeedGen = (versions || []).map((v: any) => {
      const featEmpty  = !v.features        || v.features.filter((f: string)       => f?.trim()).length === 0;
      const inclEmpty  = !v.whatsIncluded   || v.whatsIncluded.filter((f: string)  => f?.trim()).length === 0;
      const stepsEmpty = !v.activationSteps || v.activationSteps.filter((s: string)=> s?.trim()).length === 0;
      return {
        id: v.id,
        versionType: v.versionType,
        existingFeatures:        (v.features        || []).filter((f: string) => f?.trim()),
        existingWhatsIncluded:   (v.whatsIncluded   || []).filter((f: string) => f?.trim()),
        existingActivationSteps: (v.activationSteps || []).filter((s: string) => s?.trim()),
        genFeatures:        improveExisting || featEmpty,
        genWhatsIncluded:   improveExisting || inclEmpty,
        genActivationSteps: improveExisting || stepsEmpty,
        needsAny: improveExisting || featEmpty || inclEmpty || stepsEmpty,
      };
    }).filter((v: any) => v.needsAny);

    const hasToolFields    = Object.values(gen).some(Boolean);
    const hasVersionFields = versionsNeedGen.length > 0;

    if (!hasToolFields && !hasVersionFields) {
      return c.json({
        success: true,
        data: {},
        message: 'All fields are already filled — nothing to generate.',
        nothingToGenerate: true,
      });
    }

    // ── Build Gemini prompt ─────────────────────────────────────────────────

    const instructionLine = instruction?.trim()
      ? `\nUser instruction: "${instruction.trim()}" — let this guide your tone, focus, and style.`
      : '';

    // Rewrite mode: surface existing values so Gemini can improve them meaningfully
    const existingToolContext = improveExisting ? [
      tool.description?.trim()        ? `Current description: "${tool.description.trim()}"` : '',
      tool.tagline?.trim()            ? `Current tagline: "${tool.tagline.trim()}"` : '',
      tool.systemRequirements?.trim() ? `Current system requirements: "${tool.systemRequirements.trim()}"` : '',
    ].filter(Boolean).join('\n') : (
      tool.description?.trim() ? `Existing description (use as context): "${tool.description.trim()}"` : ''
    );

    const modeInstruction = improveExisting
      ? `Your task: IMPROVE and REWRITE the marketing copy below. Make it more specific, compelling, and polished${instruction?.trim() ? ' per the user instruction above' : ''}.`
      : `Your task: Generate marketing copy for the following tool.`;

    let schemaLines = '';
    if (gen.description) {
      schemaLines += `  "description": "<2-3 sentence product description. Professional, benefit-focused, concrete>",\n`;
    }
    if (gen.tagline) {
      schemaLines += `  "tagline": "<One punchy tagline max 10 words. E.g. Automate the boring. Amplify the creative.>",\n`;
    }
    if (gen.systemRequirements) {
      schemaLines += `  "systemRequirements": "<Technical requirements. E.g. After Effects CC 2022 or later · Windows 10 / macOS 11+ · 8 GB RAM>",\n`;
    }
    if (gen.howItWorks) {
      schemaLines += `  "howItWorks": [\n    { "title": "<short step name>", "description": "<1-sentence explanation>" },\n    { "title": "...", "description": "..." },\n    { "title": "...", "description": "..." },\n    { "title": "...", "description": "..." }\n  ],\n`;
    }
    if (gen.faqs) {
      schemaLines += `  "faqs": [\n    { "question": "...", "answer": "..." },\n    { "question": "...", "answer": "..." },\n    { "question": "...", "answer": "..." },\n    { "question": "...", "answer": "..." }\n  ],\n`;
    }
    if (versionsNeedGen.length > 0) {
      schemaLines += `  "versions": [\n`;
      for (const v of versionsNeedGen) {
        schemaLines += `    {\n      "id": "${v.id}",\n`;
        if (v.genFeatures) {
          const hint = improveExisting && v.existingFeatures.length > 0
            ? ` /* improve these: ${JSON.stringify(v.existingFeatures.slice(0, 2))} */`
            : '';
          schemaLines += `      "features": ["<feature 1>", "<feature 2>", "<feature 3>", "<feature 4>", "<feature 5>"],${hint}\n`;
        }
        if (v.genWhatsIncluded) {
          schemaLines += `      "whatsIncluded": ["<item 1>", "<item 2>", "<item 3>"],\n`;
        }
        if (v.genActivationSteps) {
          schemaLines += `      "activationSteps": ["<step 1>", "<step 2>", "<step 3>", "<step 4>"]\n`;
        }
        schemaLines += `    },\n`;
      }
      schemaLines += `  ],\n`;
    }

    const versionContext = versionsNeedGen.length > 0
      ? `\nVersions to process: ${versionsNeedGen.map((v: any) => `${v.versionType} (id: ${v.id})`).join(', ')}.`
      : '';

    const prompt = `You are a professional copywriter for Fastoosh, a premium motion design studio that creates After Effects plugins, scripts, and automation tools for professional motion designers and VFX artists.

${modeInstruction} Return ONLY valid JSON — no markdown fences, no extra text.

Tool Name: "${toolName}"
Category: "${toolCategory}"${instructionLine}${existingToolContext ? '\n' + existingToolContext : ''}${versionContext}

Rules:
- description: 1-2 sentences, professional and benefit-focused, no buzzword fluff. HARD LIMIT: 250 characters maximum (count carefully — this is strict)
- tagline: max 10 words, punchy, active voice
- systemRequirements: concise, use middle dot as separator
- howItWorks: exactly 4 steps, each title is short (2-4 words), description is 1 sentence
- faqs: 4 realistic questions a buyer would ask; answers helpful and concise
- features per version: 5 bullet points specific to the tier. Free = limited/basic, Pro = full set, Studio = everything plus team perks. Write as short capability statements like "Batch process 500 layers in seconds"
- whatsIncluded per version: 3-4 items like "After Effects .jsx script file", "PDF quick-start guide", "Free updates for 12 months"
- activationSteps per version: 4 clear numbered steps after purchase. E.g. "Download the .jsx file from your Fastoosh account dashboard", "In After Effects choose File > Scripts > Install Script File", "Restart After Effects to complete installation", "Open the panel under Window > Extensions > ${toolName}"
- Tailor all content specifically to "${toolName}" — make it specific, not generic
${improveExisting ? '- REWRITE mode: improve and elevate existing copy — do not repeat it verbatim\n' : ''}
Return exactly this JSON shape:
{
${schemaLines}}`;

    console.log(`Calling Gemini for "${toolName}" [${improveExisting ? 'REWRITE' : 'FILL'}]${instruction ? ` instruction="${instruction.substring(0,60)}"` : ''} — fields: ${Object.keys(gen).join(', ')}${versionsNeedGen.length ? ` + ${versionsNeedGen.length} version(s)` : ''}`);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.75,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.log('Gemini API error:', errText);
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.log('Gemini empty response:', JSON.stringify(geminiData));
      return c.json({ success: false, error: 'Gemini returned an empty response' }, 500);
    }

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('Tool content JSON repair failed. Raw (first 500):', rawText.substring(0, 500));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Gemini generation complete for "${toolName}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('Error in generate-tool-content:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI RICH FEATURES GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-rich-features", requireAuth, async (c) => {
  try {
    const { toolName, category, description, versionType, instruction, count = 5 } = await c.req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!toolName?.trim()) return c.json({ success: false, error: 'toolName is required' }, 400);

    const instructionLine = instruction?.trim() ? `\nInstruction: "${instruction.trim()}"` : '';
    const descLine = description?.trim() ? `\nTool description: "${description.trim()}"` : '';
    const tierHint = versionType === 'Free' ? 'basic/limited capabilities'
      : versionType === 'Pro' ? 'full professional feature set'
      : 'all features plus team/studio extras';

    const prompt = `You are a professional copywriter for Fastoosh, a premium motion design studio (After Effects plugins & scripts).

Generate exactly ${count} feature items for the "${versionType ?? 'Pro'}" tier of the tool "${toolName}" (category: ${category ?? 'After Effects'}).${descLine}${instructionLine}

Tier context: ${tierHint}

Rules:
- title: 3-7 words, capability-focused, specific to this tool (e.g. "Batch Process 500+ Layers at Once")
- description: max 100 characters, benefit-focused, starts with an action verb, no filler
- Make each feature distinct — no repetition
- Tailor everything specifically to "${toolName}", not generic

Return ONLY valid JSON:
{
  "richFeatures": [
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." }
  ]
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error: ${err}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Empty response from Gemini' }, 500);

    let parsed: any;
    try {
      const repaired = repairJson(rawText);
      parsed = JSON.parse(repaired);
    } catch (e) {
      return c.json({ success: false, error: `Invalid JSON from AI: ${String(e)}` }, 500);
    }

    const richFeatures = (parsed.richFeatures ?? []).map((f: any) => ({
      id: `feat-${crypto.randomUUID()}`,
      title: (f.title ?? '').slice(0, 80),
      description: (f.description ?? '').slice(0, 100),
      screenshots: [],
    }));

    console.log(`✅ Generated ${richFeatures.length} rich features for "${toolName}" [${versionType}]`);
    return c.json({ success: true, richFeatures });

  } catch (error) {
    console.log('Error in generate-rich-features:', error);
    return c.json({ success: false, error: `Feature generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI PROJECT CONTENT GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-project-content", requireAuth, async (c) => {
  try {
    const { project, instruction = '', improveExisting = false } = await c.req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const title = (project.title || '').trim();
    if (!title) return c.json({ success: false, error: 'Project title is required' }, 400);

    const category = (project.category || 'Motion Design').trim();

    const gen: Record<string, boolean> = {};
    if (improveExisting || !project.description?.trim())  gen.description  = true;
    if (improveExisting || !project.goal?.trim())         gen.goal         = true;
    if (improveExisting || !project.approach?.trim())     gen.approach     = true;
    if (improveExisting || !project.outcome?.trim())      gen.outcome      = true;
    const tagsEmpty = !project.tags || project.tags.length === 0 || project.tags.every((t: string) => !t?.trim());
    if (improveExisting || tagsEmpty) gen.tags = true;
    const delivEmpty = !project.deliverables || project.deliverables.length === 0 || project.deliverables.every((d: string) => !d?.trim());
    if (improveExisting || delivEmpty) gen.deliverables = true;

    if (!Object.values(gen).some(Boolean)) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const existingCtx = improveExisting ? [
      project.description?.trim() ? `Current description: "${project.description.trim()}"` : '',
      project.goal?.trim()        ? `Current goal: "${project.goal.trim()}"` : '',
      project.approach?.trim()    ? `Current approach: "${project.approach.trim()}"` : '',
      project.outcome?.trim()     ? `Current outcome: "${project.outcome.trim()}"` : '',
    ].filter(Boolean).join('\n') : (project.description?.trim() ? `Existing description (context): "${project.description.trim()}"` : '');

    let schemaLines = '';
    if (gen.description)  schemaLines += `  "description": "<1-2 sentence card description. HARD LIMIT: 250 characters>",\n`;
    if (gen.goal)         schemaLines += `  "goal": "<2-3 sentences: what the client needed and why>",\n`;
    if (gen.approach)     schemaLines += `  "approach": "<2-3 sentences: creative process and techniques used>",\n`;
    if (gen.outcome)      schemaLines += `  "outcome": "<2-3 sentences: results, impact, client reaction>",\n`;
    if (gen.tags)         schemaLines += `  "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>"],\n`;
    if (gen.deliverables) schemaLines += `  "deliverables": ["<deliverable 1>", "<deliverable 2>", "<deliverable 3>"],\n`;

    const clientHint = project.client?.trim() ? `\nClient: "${project.client.trim()}"` : '';
    const modeInstruction = improveExisting
      ? `REWRITE and IMPROVE the existing copy. Make it more compelling and polished.`
      : `Generate professional marketing copy for this project.`;

    const prompt = `You are a copywriter for Fastoosh, a premium motion design studio. ${modeInstruction} Return ONLY valid JSON — no markdown fences, no extra text.

Project Title: "${title}"
Category: "${category}"${clientHint}${instructionLine}${existingCtx ? '\n' + existingCtx : ''}

Rules:
- description: 1-2 sentences, max 250 characters HARD LIMIT, shown on project cards
- goal: what challenge the client faced and what they needed
- approach: the creative process, tools, and techniques Fastoosh used
- outcome: the impact, results, and client reaction — specific and compelling
- tags: 3-5 short industry tags like "Motion Design", "After Effects", "Brand Identity"
- deliverables: 3-5 concrete deliverables like "90-second hero video", "Social media cutdowns (9:16 + 1:1)"
- Be specific to "${title}" — avoid generic filler
${improveExisting ? '- REWRITE mode: elevate existing copy, do not repeat it verbatim\n' : ''}
Return exactly this JSON:
{
${schemaLines}}`;

    console.log(`Calling Gemini for project "${title}" [${improveExisting ? 'REWRITE' : 'FILL'}] fields: ${Object.keys(gen).join(', ')}`);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.75, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('Project content JSON repair failed. Raw (first 500):', rawText.substring(0, 500));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Gemini project generation complete for "${title}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('Error in generate-project-content:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI TEAM MEMBER CONTENT GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-team-content", requireAuth, async (c) => {
  try {
    const { member, instruction = '', improveExisting = false } = await c.req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const name = (member.name || '').trim();
    const role = (member.role || '').trim();
    if (!name || !role) return c.json({ success: false, error: 'Name and role are required to generate a bio' }, 400);

    const bioEmpty = !member.bio?.trim();
    if (!improveExisting && !bioEmpty) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const existingCtx = improveExisting && member.bio?.trim() ? `Current bio: "${member.bio.trim()}"` : '';
    const modeInstruction = improveExisting
      ? `REWRITE and IMPROVE the existing bio.`
      : `Write a professional bio for this team member.`;

    const prompt = `You are writing team bios for Fastoosh, a premium motion design studio. ${modeInstruction} Return ONLY valid JSON — no markdown fences.

Name: "${name}"
Role: "${role}"${instructionLine}${existingCtx ? '\n' + existingCtx : ''}

Rules:
- bio: 2-3 sentences in third-person. Mention their expertise, what they bring to Fastoosh, and one specific creative strength. Professional yet human tone. Max 400 characters.
- Be specific to "${name}" and their role as "${role}"
${improveExisting ? '- REWRITE mode: improve and elevate existing copy\n' : ''}
Return exactly this JSON:
{
  "bio": "<2-3 sentence professional bio>"
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('Team bio JSON repair failed. Raw (first 300):', rawText.substring(0, 300));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Gemini team bio generated for "${name}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('Error in generate-team-content:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI STYLE GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-style", requireAuth, async (c) => {
  try {
    const { prompt, mode = 'dark' } = await c.req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!prompt?.trim()) return c.json({ success: false, error: 'Style prompt is required' }, 400);

    const isLight = mode === 'light';

    const headingFonts = ['Inter', 'Space Grotesk', 'Syne', 'Outfit', 'Orbitron', 'Exo 2', 'Rajdhani', 'Bebas Neue', 'Montserrat', 'DM Sans'];
    const bodyFonts    = ['Inter', 'DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Nunito', 'Manrope', 'Rubik', 'Space Grotesk', 'IBM Plex Sans', 'Karla'];

    const systemPrompt = `You are a world-class UI/UX designer and color theorist specializing in premium ${isLight ? 'light' : 'dark'}-mode web applications with glassmorphism and neon gradient aesthetics.

Your task: Generate a complete, harmonious design system for "Fastoosh" — a premium motion design studio.
Style vibe requested: "${prompt.trim()}"

CRITICAL: ALL hex color values MUST be EXACTLY 6 hexadecimal digits after the # symbol.
Examples of VALID hex colors: #7c3aed, #ec4899, #000000, #ffffff, #0f0519
Examples of INVALID hex colors: #0, #, #fff, #7c3ae, rgb(0,0,0)

STRICT COLOR THEORY RULES:
1. Pick a PRIMARY HUE (0–360 in HSL) that best matches the mood
2. accentPrimary: primary hue, HSL saturation 75–95%, lightness ${isLight ? '45–60%' : '60–80%'}
3. accentSecondary: rotate 30–50° FORWARD from primary hue (analogous harmony), same saturation band
4. accentGlow: rotate 160–185° from primary (near-complement = visual pop / contrast)
5. All three accent hex colors must differ visually and be EXACTLY 6 hex digits
6. Background and overlay colors must be ${isLight ? 'very light (near white with subtle hue traces)' : 'very dark (near black with subtle hue traces)'}
${isLight ? `
LIGHT MODE SPECIFICS:
- bgBase: #f5f4fe or similar very soft cool white (L >= 94%), MUST be 6 hex digits
- bgGrad1: mix of white + primary hue at very low saturation (L 88-96%), MUST be 6 hex digits
- bgGrad2: even lighter / near white (L 95-99%), MUST be 6 hex digits
- textPrimary: deep near-black with a hue tint e.g. #0d0620, #120624, MUST be 6 hex digits
- overlayColor1: the primary accent hex (shows in gradient over light bg), MUST be 6 hex digits
- overlayColor2: a blue-violet e.g. #6366f1 or #7c3aed adjusted to mood, MUST be 6 hex digits
- headerBg: "rgba(255,255,255,0.65)" to "rgba(255,255,255,0.85)"
- footerBg: "rgba(245,244,254,0.70)" to "rgba(255,255,255,0.75)"
- cardBg: "rgba(255,255,255,0.55)" to "rgba(255,255,255,0.72)"
- cardDarkFill: "rgba(255,255,255,0.92)" to "rgba(255,255,255,0.97)"
- signinBg: use accent primary rgb values at 0.07 opacity
- navText: use textPrimary rgb values at 0.60 opacity` : `
DARK MODE SPECIFICS:
- bgBase: #000000 or near-black like #02010a (L <= 3%), MUST be 6 hex digits
- bgGrad1: very dark with primary hue trace e.g. #0f0519 (L 4-8%), MUST be 6 hex digits
- bgGrad2: very dark with secondary hue trace e.g. #05050f (L 3-5%), MUST be 6 hex digits
- textPrimary: #ffffff or #f8f8ff, MUST be 6 hex digits
- overlayColor1: saturated version of accentPrimary (keep the hue, S >= 60%, L 60-75%), MUST be 6 hex digits
- overlayColor2: a contrasting saturated blue-indigo in the #3b82f6 range (adjustable to mood), MUST be 6 hex digits
- headerBg: "rgba(0,0,0,0.08)" to "rgba(r,g,b,0.06)" using accent primary rgb
- footerBg: "rgba(0,0,0,0.28)" to "rgba(0,0,0,0.42)"
- cardBg: "rgba(255,255,255,0.018)" to "rgba(255,255,255,0.038)"
- cardDarkFill: "rgba(0,0,0,0.90)" to "rgba(0,0,0,0.97)"
- signinBg: "rgba(255,255,255,0.05)" to "rgba(255,255,255,0.08)"
- navText: "rgba(255,255,255,0.62)" to "rgba(255,255,255,0.78)"`}

TYPOGRAPHY PAIRING RULES:
- Available headingFont: ${headingFonts.join(', ')}
- Available bodyFont: ${bodyFonts.join(', ')}
- Pair expressive heading with clean body — they should complement, not compete
- Cyberpunk/tech vibes: Orbitron or Exo 2 heading + IBM Plex Sans or Manrope body
- Elegant/luxury vibes: Syne or Montserrat heading + Manrope or Karla body
- Minimal/clean vibes: Space Grotesk or DM Sans heading + Inter or Plus Jakarta Sans body
- Bold/studio vibes: Bebas Neue or Rajdhani heading + Rubik or Nunito body
- Do NOT use same font for both

CRITICAL OUTPUT RULES:
1. Return ONLY valid JSON - no markdown code blocks, no explanation text before or after
2. ALL hex color values MUST be exactly 6 hexadecimal characters after # (e.g., #7c3aed)
3. Double-check every hex color before responding
4. Do not use shorthand hex colors (e.g., #fff is INVALID, use #ffffff)

OUTPUT JSON SCHEMA:
{
  "accentPrimary":   "#XXXXXX",
  "accentSecondary": "#XXXXXX",
  "accentGlow":      "#XXXXXX",
  "bgBase":          "#XXXXXX",
  "bgGrad1":         "#XXXXXX",
  "bgGrad2":         "#XXXXXX",
  "overlayColor1":   "#XXXXXX",
  "overlayColor2":   "#XXXXXX",
  "textPrimary":     "#XXXXXX",
  "headingFont":     "FontName",
  "bodyFont":        "FontName",
  "headerBg":        "rgba(r,g,b,a)",
  "footerBg":        "rgba(r,g,b,a)",
  "cardBg":          "rgba(r,g,b,a)",
  "cardDarkFill":    "rgba(r,g,b,a)",
  "signinBg":        "rgba(r,g,b,a)",
  "navText":         "rgba(r,g,b,a)",
  "gradSpeed":       "medium",
  "themeName":       "Short evocative theme name (2-4 words)",
  "themeDescription":"One sentence capturing the visual mood."
}

Where XXXXXX represents exactly 6 hexadecimal digits (0-9, a-f). Example: #7c3aed, #000000, #ffffff`;

    console.log(`[generate-style] prompt="${prompt.trim().substring(0, 60)}" mode=${mode}`);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { 
            temperature: 0.8,
            maxOutputTokens: 1500,
            responseSchema: {
              type: "object",
              properties: {
                accentPrimary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                accentSecondary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                accentGlow: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                bgBase: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                bgGrad1: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                bgGrad2: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                overlayColor1: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                overlayColor2: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                textPrimary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                headingFont: { type: "string" },
                bodyFont: { type: "string" },
                headerBg: { type: "string" },
                footerBg: { type: "string" },
                cardBg: { type: "string" },
                cardDarkFill: { type: "string" },
                signinBg: { type: "string" },
                navText: { type: "string" },
                gradSpeed: { type: "string" },
                themeName: { type: "string" },
                themeDescription: { type: "string" }
              },
              required: [
                "accentPrimary", "accentSecondary", "accentGlow", 
                "bgBase", "bgGrad1", "bgGrad2",
                "overlayColor1", "overlayColor2", "textPrimary",
                "headingFont", "bodyFont", "themeName", "themeDescription"
              ]
            },
            responseMimeType: "application/json"
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.log('[generate-style] Gemini error:', errText);
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('[generate-style] JSON parse error. Raw:', rawText.substring(0, 400));
      return c.json({ success: false, error: `AI returned invalid JSON: ${String(parseErr)}` }, 500);
    }

    // Helper function to normalize hex colors
    const normalizeHex = (hex: string, fallback: string): string => {
      if (!hex || typeof hex !== 'string') return fallback;
      let cleaned = hex.trim();
      
      // Remove any # and whitespace
      cleaned = cleaned.replace(/^#/, '').replace(/\s/g, '');
      
      // If empty or invalid, use fallback
      if (cleaned.length === 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
        console.log(`[generate-style] Invalid hex "${hex}", using fallback ${fallback}`);
        return fallback;
      }
      
      // If too short, pad with zeros or expand shorthand
      if (cleaned.length === 1) {
        cleaned = cleaned + cleaned + '0000';
      } else if (cleaned.length === 2) {
        cleaned = cleaned + '0000';
      } else if (cleaned.length === 3) {
        // Expand shorthand: #abc -> #aabbcc
        cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
      } else if (cleaned.length === 4) {
        cleaned = cleaned + '00';
      } else if (cleaned.length === 5) {
        cleaned = cleaned + '0';
      } else if (cleaned.length > 6) {
        // Truncate if too long
        cleaned = cleaned.substring(0, 6);
      }
      
      // Final validation
      if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        console.log(`[generate-style] Could not normalize "${hex}", using fallback ${fallback}`);
        return fallback;
      }
      
      return '#' + cleaned.toLowerCase();
    };

    // Default fallback colors based on mode
    const fallbacks = isLight ? {
      accentPrimary: '#7c3aed',
      accentSecondary: '#a855f7',
      accentGlow: '#ec4899',
      bgBase: '#f5f4fe',
      bgGrad1: '#ede9fe',
      bgGrad2: '#faf9ff',
      overlayColor1: '#7c3aed',
      overlayColor2: '#6366f1',
      textPrimary: '#0d0620',
    } : {
      accentPrimary: '#7c3aed',
      accentSecondary: '#a855f7',
      accentGlow: '#ec4899',
      bgBase: '#000000',
      bgGrad1: '#0f0519',
      bgGrad2: '#05050f',
      overlayColor1: '#8b5cf6',
      overlayColor2: '#3b82f6',
      textPrimary: '#ffffff',
    };

    // Normalize and validate all hex color fields
    const hexFields = ['accentPrimary','accentSecondary','accentGlow','bgBase','bgGrad1','bgGrad2','overlayColor1','overlayColor2','textPrimary'];
    for (const field of hexFields) {
      generated[field] = normalizeHex(generated[field], fallbacks[field as keyof typeof fallbacks]);
    }

    // Validate all required fields are present
    if (!generated.themeName) generated.themeName = 'Generated Theme';
    if (!generated.themeDescription) generated.themeDescription = 'A harmonious design system.';
    if (!generated.headingFont) generated.headingFont = 'Inter';
    if (!generated.bodyFont) generated.bodyFont = 'Inter';
    if (!generated.gradSpeed) generated.gradSpeed = 'medium';

    console.log(`[generate-style] Done. Theme: "${generated.themeName}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('[generate-style] Error:', error);
    return c.json({ success: false, error: `Style generation failed: ${String(error)}` }, 500);
  }
});

// ========== FILE UPLOAD ENDPOINTS ==========

// Upload favicon to Supabase Storage (protected)
app.post('/make-server-e07959ec/upload-favicon', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ success: false, error: 'Invalid file type. Allowed: PNG, JPEG, WEBP, ICO, SVG' }, 400);
    }

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ success: false, error: 'File size exceeds 1MB limit' }, 400);
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `favicon.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Favicon storage upload error:', error);
      return c.json({ success: false, error: `Upload failed: ${error.message}` }, 500);
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    return c.json({ success: true, data: { url: bustedUrl, path: fileName } });
  } catch (error) {
    console.error('Error in favicon upload:', error);
    return c.json({ success: false, error: `Upload error: ${String(error)}` }, 500);
  }
});

// Upload image to Supabase Storage (protected)
app.post('/make-server-e07959ec/upload-image', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: 'Invalid file type. Allowed types: PNG, JPEG, GIF, WEBP' 
      }, 400);
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ 
        success: false, 
        error: 'File size exceeds 10MB limit' 
      }, 400);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = crypto.randomUUID().split('-')[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return c.json({ 
        success: false, 
        error: `Upload failed: ${error.message}` 
      }, 500);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
    
    return c.json({ 
      success: true, 
      data: {
        url: urlData.publicUrl,
        path: fileName,
      }
    });
  } catch (error) {
    console.error('Error in image upload:', error);
    return c.json({ 
      success: false, 
      error: `Upload error: ${String(error)}` 
    }, 500);
  }
});

// Upload video to Supabase Storage (protected)
app.post('/make-server-e07959ec/upload-video', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }
    
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: 'Invalid file type. Allowed types: MP4, MOV, AVI, WebM' 
      }, 400);
    }
    
    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ 
        success: false, 
        error: 'File size exceeds 100MB limit' 
      }, 400);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = crypto.randomUUID().split('-')[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(VIDEO_BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return c.json({ 
        success: false, 
        error: `Upload failed: ${error.message}` 
      }, 500);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(VIDEO_BUCKET_NAME)
      .getPublicUrl(fileName);
    
    return c.json({ 
      success: true, 
      data: {
        url: urlData.publicUrl,
        path: fileName,
      }
    });
  } catch (error) {
    console.error('Error in video upload:', error);
    return c.json({ 
      success: false, 
      error: `Upload error: ${String(error)}` 
    }, 500);
  }
});

// ========== PROJECTS ENDPOINTS ==========

/** Converts a project title into a URL-safe slug. */
const generateSlug = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');

// Get all projects
app.get("/make-server-e07959ec/projects", async (c) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('order_index', { ascending: true });
    
    if (error) {
      console.log(`Error fetching projects: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true, data: (data || []).map(fromDbRow) });
  } catch (error) {
    console.log(`Error fetching projects: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get single project by slug OR UUID
app.get("/make-server-e07959ec/projects/:id", async (c) => {
  try {
    const idOrSlug = c.req.param("id");
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Try slug lookup first (works for both slug and UUID columns)
    const isUuid = UUID_RE.test(idOrSlug);
    
    // Build query: if it looks like a UUID, match on id; otherwise match on slug
    let query = supabase.from('projects').select('*');
    if (isUuid) {
      // Could be either a real UUID id or a slug that happens to look like a UUID (unlikely)
      // Try id first, then fall back to slug
      const { data: byId, error: idErr } = await query.eq('id', idOrSlug).single();
      if (!idErr && byId) {
        return c.json({ success: true, data: fromDbRow(byId) });
      }
    }

    // Look up by slug (covers both slug-based URLs and UUID fallback miss above)
    const { data: bySlug, error: slugErr } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', idOrSlug)
      .single();

    if (!slugErr && bySlug) {
      return c.json({ success: true, data: fromDbRow(bySlug) });
    }

    // Nothing found
    console.log(`Project not found for slug/id: ${idOrSlug}`);
    return c.json({ success: false, error: "Project not found" }, 404);
  } catch (error) {
    console.log(`Error fetching project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create project (protected)
app.post("/make-server-e07959ec/projects", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    // Strip any temp client-side id so Supabase auto-generates a real UUID
    const { id: _tempId, ...rest } = body;
    // Always derive slug from title (override any client-supplied slug so it stays in sync)
    rest.slug = rest.slug?.trim() || (rest.title ? generateSlug(rest.title) : undefined);
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('projects')
      .insert(dbRow)
      .select()
      .single();
    
    if (error) {
      console.log(`Error creating project: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error creating project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update project (protected)
app.put("/make-server-e07959ec/projects/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { id: _bodyId, ...rest } = body;
    // Keep slug in sync: if a slug was explicitly provided use it, otherwise derive from title
    if (rest.title) {
      rest.slug = rest.slug?.trim() || generateSlug(rest.title);
    }
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('projects')
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.log(`Error updating project: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error updating project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete project (protected)
app.delete("/make-server-e07959ec/projects/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log(`Error deleting project: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== VIDEO TRACKING ENDPOINTS ==========

// Record a video view and/or accumulated watch time (public — called from frontend)
app.post("/make-server-e07959ec/projects/:id/video-view", async (c) => {
  try {
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const addView      = body.addView === true;
    const watchSeconds = typeof body.watchSeconds === 'number' ? Math.max(0, Math.round(body.watchSeconds)) : 0;

    // Resolve real UUID if a slug was passed
    let realId = projectId;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(projectId)) {
      const { data: row } = await supabase.from('projects').select('id').eq('slug', projectId).single();
      if (row) realId = row.id;
    }

    const kvKey  = `project_video_stats:${realId}`;
    const existing = (await kv.get(kvKey)) ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };

    const updated = {
      views:             (existing.views || 0) + (addView ? 1 : 0),
      totalWatchSeconds: (existing.totalWatchSeconds || 0) + watchSeconds,
      lastViewed:        addView ? new Date().toISOString() : (existing.lastViewed ?? null),
    };

    await kv.set(kvKey, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.log(`Error recording video view: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Record showreel view / watch time (public — called from Home page)
app.post("/make-server-e07959ec/showreel/video-view", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const addView      = body.addView === true;
    const watchSeconds = typeof body.watchSeconds === 'number' ? Math.max(0, Math.round(body.watchSeconds)) : 0;

    const kvKey    = 'showreel_video_stats';
    const existing = (await kv.get(kvKey)) ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };

    const updated = {
      views:             (existing.views || 0) + (addView ? 1 : 0),
      totalWatchSeconds: (existing.totalWatchSeconds || 0) + watchSeconds,
      lastViewed:        addView ? new Date().toISOString() : (existing.lastViewed ?? null),
    };

    await kv.set(kvKey, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.log(`Error recording showreel view: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get video stats for all projects + showreel (admin only)
app.get("/make-server-e07959ec/admin/video-stats", requireAuth, async (c) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, slug, image_url, video_url')
      .order('order_index', { ascending: true });

    if (error) {
      console.log(`Error fetching projects for video stats: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }

    const keys     = (projects || []).map(p => `project_video_stats:${p.id}`);
    const statsArr = keys.length > 0 ? await kv.mget(keys) : [];

    const result = (projects || []).map((project, i) => {
      const stats             = statsArr[i] ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };
      const views             = stats.views || 0;
      const totalWatchSeconds = stats.totalWatchSeconds || 0;
      return {
        projectId:       project.id,
        title:           project.title,
        slug:            project.slug,
        imageUrl:        project.image_url,
        hasVideo:        !!project.video_url,
        isShowreel:      false,
        views,
        totalWatchSeconds,
        avgWatchSeconds: views > 0 ? Math.round(totalWatchSeconds / views) : 0,
        lastViewed:      stats.lastViewed ?? null,
      };
    });

    // Sort projects by views descending
    result.sort((a, b) => b.views - a.views);

    // Prepend showreel (always pinned at the top)
    const showreelRaw = (await kv.get('showreel_video_stats')) ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };
    const srViews     = showreelRaw.views || 0;
    const srWatch     = showreelRaw.totalWatchSeconds || 0;
    result.unshift({
      projectId:        'showreel',
      title:            'Showreel',
      slug:             null,
      imageUrl:         null,
      hasVideo:         true,
      isShowreel:       true,
      views:            srViews,
      totalWatchSeconds: srWatch,
      avgWatchSeconds:  srViews > 0 ? Math.round(srWatch / srViews) : 0,
      lastViewed:       showreelRaw.lastViewed ?? null,
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    console.log(`Error fetching video stats: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== TOOLS ENDPOINTS ==========

// Get all tools with versions
app.get("/make-server-e07959ec/tools", async (c) => {
  try {
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .order('order_index', { ascending: true });
    
    if (toolsError) {
      console.log(`Error fetching tools: ${toolsError.message}`);
      return c.json({ success: false, error: toolsError.message }, 500);
    }
    
    return c.json({ success: true, data: (tools || []).map(normalizeTool) });
  } catch (error) {
    console.log(`Error fetching tools: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get single tool by ID with versions
app.get("/make-server-e07959ec/tools/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ success: false, error: "Tool not found" }, 404);
      }
      console.log(`Error fetching tool: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true, data: normalizeTool(data) });
  } catch (error) {
    console.log(`Error fetching tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get tool by slug with versions
app.get("/make-server-e07959ec/tools/slug/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('slug', slug)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ success: false, error: "Tool not found" }, 404);
      }
      console.log(`Error fetching tool: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true, data: normalizeTool(data) });
  } catch (error) {
    console.log(`Error fetching tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create tool (protected)
app.post("/make-server-e07959ec/tools", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    // Strip temp client-side id and pull out versions + ALL fields that have no DB column.
    // tagline            → NO DB column → 🏷️ sentinel in faqs (plain string)
    // howItWorks         → NO DB column → 📋 sentinel in faqs (JSON-encoded array)
    // systemRequirements → NO DB column → 🖥️ sentinel in faqs (plain string)
    // demoUrl            → NO DB column → 🎬 sentinel in faqs (plain string)
    const {
      versions,
      id: _tempId,
      demoUrl: toolDemoUrl,
      howItWorks: toolHowItWorks,
      systemRequirements: toolSysReq,
      tagline: toolTagline,
      ...toolRest
    } = body;

    // Fold sentinel-encoded fields into faqs so they survive in the DB
    const toolFaqs = [
      ...(toolDemoUrl   ? [{ question: '🎬', answer: toolDemoUrl }]                          : []),
      ...(toolHowItWorks && toolHowItWorks.length > 0
                        ? [{ question: '📋', answer: JSON.stringify(toolHowItWorks) }]        : []),
      ...(toolSysReq    ? [{ question: '🖥️', answer: toolSysReq }]                           : []),
      ...(toolTagline   ? [{ question: '🏷️', answer: toolTagline }]                          : []),
      ...(toolRest.faqs ?? []),
    ];
    const toolDbRow = toDbRow({ ...toolRest, faqs: toolFaqs });
    
    // Insert tool
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .insert(toolDbRow)
      .select()
      .single();
    
    if (toolError) {
      console.log(`Error creating tool: ${toolError.message}`);
      return c.json({ success: false, error: toolError.message }, 400);
    }
    
    // Insert versions if provided
    if (versions && Array.isArray(versions) && versions.length > 0) {
      const versionsWithToolId = versions.map(v => {
        // Strip all frontend-only / non-DB fields from each version
        const {
          id: _vId,
          pricingModel,
          monthlyPrice,
          yearlyPrice,
          lifetimePrice,
          whatsIncluded,
          activationSteps,
          richFeatures,
          demoUrl: _vDemoUrl,
          pricingDisplay: _pd,
          ...vRest
        } = v;

        // Encode pricing as the first 💰 feature in an unambiguous pipe-delimited format:
        //   Free version    → "Free"
        //   Subscription    → "subscription|<monthly>|<yearly>"
        //   Lifetime        → "lifetime|<price>"
        const priceSentinel =
          v.versionType === 'Free'
            ? 'Free'
            : pricingModel === 'subscription'
            ? `subscription|${monthlyPrice ?? ''}|${yearlyPrice ?? ''}`
            : `lifetime|${lifetimePrice ?? ''}`;

        const enrichedFeatures = [
          ...(priceSentinel ? [`💰 ${priceSentinel}`] : []),
          ...((whatsIncluded ?? []) as string[]).filter(Boolean).map((item: string) => `📦 ${item}`),
          ...((activationSteps ?? []) as string[]).filter(Boolean).map((step: string) => `🔑 ${step}`),
          ...((richFeatures ?? []) as any[]).filter(Boolean).map((f: any) => `🎨 ${JSON.stringify(f)}`),
          ...(vRest.features ?? []),
        ];

        return { ...toDbRow(vRest), features: enrichedFeatures, tool_id: tool.id };
      });
      
      const { error: versionsError } = await supabase
        .from('tool_versions')
        .insert(versionsWithToolId);
      
      if (versionsError) {
        console.log(`Error creating tool versions: ${versionsError.message}`);
        // Roll back — delete the tool so we don't have orphaned records
        await supabase.from('tools').delete().eq('id', tool.id);
        return c.json({ success: false, error: `Version save failed: ${versionsError.message}` }, 400);
      }
    }
    
    // Fetch complete tool with versions
    const { data: completeData } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('id', tool.id)
      .single();
    
    return c.json({ success: true, data: completeData ? normalizeTool(completeData) : null });
  } catch (error) {
    console.log(`Error creating tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update tool (protected)
app.put("/make-server-e07959ec/tools/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    // Strip id and versions for separate handling. ALL non-DB fields must be extracted.
    // tagline            → NO DB column → 🏷️ sentinel in faqs (plain string)
    // howItWorks         → NO DB column → 📋 sentinel in faqs (JSON-encoded array)
    // systemRequirements → NO DB column → 🖥️ sentinel in faqs (plain string)
    // demoUrl            → NO DB column → 🎬 sentinel in faqs (plain string)
    const {
      versions,
      id: _bodyId,
      demoUrl: toolDemoUrl,
      howItWorks: toolHowItWorks,
      systemRequirements: toolSysReq,
      tagline: toolTagline,
      ...toolRest
    } = body;

    // Fold sentinel-encoded fields into faqs so they survive in the DB
    const toolFaqs = [
      ...(toolDemoUrl   ? [{ question: '🎬', answer: toolDemoUrl }]                          : []),
      ...(toolHowItWorks && toolHowItWorks.length > 0
                        ? [{ question: '📋', answer: JSON.stringify(toolHowItWorks) }]        : []),
      ...(toolSysReq    ? [{ question: '🖥️', answer: toolSysReq }]                           : []),
      ...(toolTagline   ? [{ question: '🏷️', answer: toolTagline }]                          : []),
      ...(toolRest.faqs ?? []),
    ];
    const toolDbRow = toDbRow({ ...toolRest, faqs: toolFaqs });
    
    // Update tool
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .update(toolDbRow)
      .eq('id', id)
      .select()
      .single();
    
    if (toolError) {
      console.log(`Error updating tool: ${toolError.message}`);
      return c.json({ success: false, error: toolError.message }, 400);
    }
    
    // Update versions if provided
    if (versions && Array.isArray(versions)) {
      // Delete existing versions
      const { error: deleteError } = await supabase
        .from('tool_versions')
        .delete()
        .eq('tool_id', id);

      if (deleteError) {
        console.log(`Error deleting old tool versions: ${deleteError.message}`);
        return c.json({ success: false, error: `Failed to clear old versions: ${deleteError.message}` }, 400);
      }
      
      // Insert new versions
      if (versions.length > 0) {
        const versionsWithToolId = versions.map(v => {
          // Strip all frontend-only / non-DB fields from each version
          const {
            id: _vId,
            pricingModel,
            monthlyPrice,
            yearlyPrice,
            lifetimePrice,
            whatsIncluded,
            activationSteps,
            richFeatures,
            demoUrl: _vDemoUrl,
            pricingDisplay: _pd,
            ...vRest
          } = v;

          // Encode pricing as the first 💰 feature in an unambiguous pipe-delimited format:
          //   Free version    → "Free"
          //   Subscription    → "subscription|<monthly>|<yearly>"
          //   Lifetime        → "lifetime|<price>"
          const priceSentinel =
            v.versionType === 'Free'
              ? 'Free'
              : pricingModel === 'subscription'
              ? `subscription|${monthlyPrice ?? ''}|${yearlyPrice ?? ''}`
              : `lifetime|${lifetimePrice ?? ''}`;

          const enrichedFeatures = [
            ...(priceSentinel ? [`💰 ${priceSentinel}`] : []),
            ...((whatsIncluded ?? []) as string[]).filter(Boolean).map((item: string) => `📦 ${item}`),
            ...((activationSteps ?? []) as string[]).filter(Boolean).map((step: string) => `🔑 ${step}`),
            ...((richFeatures ?? []) as any[]).filter(Boolean).map((f: any) => `🎨 ${JSON.stringify(f)}`),
            ...(vRest.features ?? []),
          ];

          return { ...toDbRow(vRest), features: enrichedFeatures, tool_id: id };
        });
        
        const { error: versionsError } = await supabase
          .from('tool_versions')
          .insert(versionsWithToolId);

        if (versionsError) {
          console.log(`Error inserting tool versions: ${versionsError.message}`);
          return c.json({ success: false, error: `Version save failed: ${versionsError.message}` }, 400);
        }
      }
    }
    
    // Fetch complete tool with versions
    const { data: completeData } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('id', id)
      .single();
    
    return c.json({ success: true, data: completeData ? normalizeTool(completeData) : null });
  } catch (error) {
    console.log(`Error updating tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete tool (protected)
app.delete("/make-server-e07959ec/tools/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    
    // Versions will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from('tools')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log(`Error deleting tool: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── DEBUG: raw tool_versions rows (public, read-only) ─────────────────────────
app.get("/make-server-e07959ec/debug/tool-versions", async (c) => {
  try {
    const { data, error } = await supabase
      .from('tool_versions')
      .select('*')
      .limit(50);
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, count: (data || []).length, data });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ── DEBUG: raw tools rows with joined tool_versions (public, read-only) ────────
app.get("/make-server-e07959ec/debug/tools-raw", async (c) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('id, name, slug, tool_versions(*)')
      .limit(10);
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ========== TEAM MEMBERS ENDPOINTS ==========

// Get all team members
app.get("/make-server-e07959ec/team", async (c) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('order_index', { ascending: true });
    
    if (error) {
      console.log(`Error fetching team members: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true, data: (data || []).map(fromDbRow) });
  } catch (error) {
    console.log(`Error fetching team members: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create team member (protected)
app.post("/make-server-e07959ec/team", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { id: _tempId, ...rest } = body;
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('team_members')
      .insert(dbRow)
      .select()
      .single();
    
    if (error) {
      console.log(`Error creating team member: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error creating team member: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update team member (protected)
app.put("/make-server-e07959ec/team/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { id: _bodyId, ...rest } = body;
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('team_members')
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.log(`Error updating team member: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error updating team member: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete team member (protected)
app.delete("/make-server-e07959ec/team/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log(`Error deleting team member: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting team member: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== SITE SETTINGS ENDPOINT ==========

// Get site settings
app.get("/make-server-e07959ec/settings", async (c) => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*');
    
    if (error) {
      console.log(`Error fetching settings: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    // Convert array of key-value pairs to object
    const settings = (data || []).reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.log(`Error fetching settings: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update site settings (protected)
app.post("/make-server-e07959ec/settings", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    
    // Update or insert each setting
    for (const [key, value] of Object.entries(body)) {
      await supabase
        .from('site_settings')
        .upsert({ 
          key, 
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });
    }
    
    return c.json({ success: true, data: body });
  } catch (error) {
    console.log(`Error saving settings: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== LOGO MANAGEMENT ==========

// ── Shared logo upload helper ────────────────────────────────────────────────
const LOGO_EXTS = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'];

async function uploadLogoVariant(
  file: File,
  variant: 'dark' | 'light',
): Promise<{ logoUrl: string } | { error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  if (!LOGO_EXTS.includes(ext)) {
    return { error: 'Unsupported file type. Use PNG, JPG, SVG, WEBP, or GIF.' };
  }
  const path = `logo-${variant}.${ext}`;
  const buf  = await file.arrayBuffer();

  // Remove all previous variants of this slot (different extensions)
  await supabase.storage.from(BRAND_BUCKET_NAME).remove(
    LOGO_EXTS.map(e => `logo-${variant}.${e}`)
  );

  const { error: upErr } = await supabase.storage
    .from(BRAND_BUCKET_NAME)
    .upload(path, buf, { contentType: file.type, upsert: true });

  if (upErr) return { error: upErr.message };

  const { data: pubData } = supabase.storage.from(BRAND_BUCKET_NAME).getPublicUrl(path);
  const logoUrl = `${pubData.publicUrl}?v=${Date.now()}`;

  const settingKey = variant === 'dark' ? 'logoDarkUrl' : 'logoLightUrl';
  await supabase.from('site_settings').upsert(
    { key: settingKey, value: logoUrl, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  return { logoUrl };
}

// Upload dark logo (admin-protected, multipart/form-data)
app.post('/make-server-e07959ec/logo/dark', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return c.json({ success: false, error: 'No file uploaded' }, 400);
    const result = await uploadLogoVariant(file, 'dark');
    if ('error' in result) return c.json({ success: false, error: result.error }, 400);
    console.log('Dark logo uploaded:', result.logoUrl);
    return c.json({ success: true, logoUrl: result.logoUrl });
  } catch (err) {
    console.log('Dark logo upload error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Upload light logo (admin-protected, multipart/form-data)
app.post('/make-server-e07959ec/logo/light', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return c.json({ success: false, error: 'No file uploaded' }, 400);
    const result = await uploadLogoVariant(file, 'light');
    if ('error' in result) return c.json({ success: false, error: result.error }, 400);
    console.log('Light logo uploaded:', result.logoUrl);
    return c.json({ success: true, logoUrl: result.logoUrl });
  } catch (err) {
    console.log('Light logo upload error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Delete dark logo (admin-protected)
app.delete('/make-server-e07959ec/logo/dark', requireAuth, async (c) => {
  try {
    await supabase.storage.from(BRAND_BUCKET_NAME).remove(LOGO_EXTS.map(e => `logo-dark.${e}`));
    await supabase.from('site_settings').delete().eq('key', 'logoDarkUrl');
    console.log('Dark logo deleted');
    return c.json({ success: true });
  } catch (err) {
    console.log('Dark logo delete error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Delete light logo (admin-protected)
app.delete('/make-server-e07959ec/logo/light', requireAuth, async (c) => {
  try {
    await supabase.storage.from(BRAND_BUCKET_NAME).remove(LOGO_EXTS.map(e => `logo-light.${e}`));
    await supabase.from('site_settings').delete().eq('key', 'logoLightUrl');
    console.log('Light logo deleted');
    return c.json({ success: true });
  } catch (err) {
    console.log('Light logo delete error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== USER PURCHASES & LICENSES ==========

// Get user's purchases — accepts Supabase OAuth JWT (requireUserAuth)
app.get("/make-server-e07959ec/user/purchases", requireUserAuth, async (c) => {
  try {
    const user = c.get('user');

    // Simple select — avoids PostgREST FK-join errors if relationships aren't declared
    const { data, error } = await supabase
      .from('user_purchases')
      .select('*')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.log(`Error fetching user purchases: ${error.message} | code: ${error.code} | details: ${error.details}`);
      return c.json({ success: false, error: `${error.message} (${error.code})` }, 500);
    }

    // Enrich each row with tool_version + tool data from the database
    const enriched = await Promise.all((data || []).map(async (row: any) => {
      try {
        let tv: any = null;
        let tool: any = null;

        console.log(`Enriching purchase id=${row.id} | tool_version_id=${row.tool_version_id} | product_name="${row.product_name}" | variant_name="${row.variant_name}" | amount=${row.amount}`);

        // Primary path: look up via tool_version_id FK
        if (row.tool_version_id) {
          const { data: tvData } = await supabase
            .from('tool_versions')
            .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
            .eq('id', row.tool_version_id)
            .maybeSingle();
          tv = tvData ?? null;
          console.log(`  → Primary path version: ${tv?.version_type ?? 'not found'}`);

          if (tv?.tool_id) {
            const { data: toolData } = await supabase
              .from('tools')
              .select('id, name, slug, image_url')
              .eq('id', tv.tool_id)
              .maybeSingle();
            tool = toolData ?? null;
          }
        }

        // Fallback: match tool by product_name when tool_version_id is missing or lookup failed
        if (!tool && row.product_name) {
          const { data: toolData } = await supabase
            .from('tools')
            .select('id, name, slug, image_url')
            .ilike('name', row.product_name.trim())
            .maybeSingle();
          tool = toolData ?? null;
          console.log(`  → Fallback tool by product_name: ${tool?.name ?? 'not found'}`);

          if (tool) {
            // 1. Match version via lemon_squeezy_variant_id on the purchase row
            if (!tv && row.lemon_squeezy_variant_id) {
              const { data: tvData } = await supabase
                .from('tool_versions')
                .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
                .eq('lemon_squeezy_variant_id', row.lemon_squeezy_variant_id)
                .maybeSingle();
              tv = tvData ?? null;
              console.log(`  → Step 1 (variant_id match): ${tv?.version_type ?? 'not found'}`);
            }

            // 2. Match version by variant_name keyword (LS can send "Pro License", "Studio Plan", etc.)
            if (!tv && row.variant_name) {
              const vn = row.variant_name.toLowerCase();
              let versionType: string | null = null;
              if (vn.includes('studio'))    versionType = 'Studio';
              else if (vn.includes('pro'))  versionType = 'Pro';
              else if (vn.includes('free')) versionType = 'Free';
              console.log(`  → Step 2 variant_name="${row.variant_name}" → keyword="${versionType}"`);
              if (versionType) {
                const { data: tvData } = await supabase
                  .from('tool_versions')
                  .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
                  .eq('tool_id', tool.id)
                  .eq('version_type', versionType)
                  .maybeSingle();
                tv = tvData ?? null;
                console.log(`  → Step 2 result: ${tv?.version_type ?? 'not found'}`);
              }
            }

            // 3. Last resort: use variant_name to decide paid vs free — NEVER use amount
            //    (amount is $0 in test mode even for Pro/Studio purchases)
            if (!tv) {
              const variantLower = (row.variant_name || '').toLowerCase();
              const isFreeVariant = variantLower.includes('free') || variantLower === '';
              console.log(`  → Step 3 last resort: isFreeVariant=${isFreeVariant}`);
              const { data: tvData } = await supabase
                .from('tool_versions')
                .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
                .eq('tool_id', tool.id)
                .neq('version_type', isFreeVariant ? '' : 'Free')
                .limit(1)
                .maybeSingle();
              tv = tvData ?? null;
              console.log(`  → Step 3 result: ${tv?.version_type ?? 'not found'}`);
            }
          }
        }

        // Extract activation steps from the raw features[] before returning
        let activationSteps: string[] = [];
        if (Array.isArray(tv?.features)) {
          activationSteps = (tv.features as string[])
            .filter((f: string) => typeof f === 'string' && f.startsWith('🔑 '))
            .map((f: string) => f.replace('🔑 ', ''));
        }

        console.log(`  → Final: tool="${tool?.name}" version="${tv?.version_type}" image="${tool?.image_url ? 'yes' : 'no'}" steps=${activationSteps.length}`);
        if (!tv && !tool) return row;
        return { ...row, tool_version: { ...tv, activation_steps: activationSteps }, tool };
      } catch (e) {
        console.warn('Could not enrich purchase with tool info:', e);
        return row;
      }
    }));

    console.log(`Purchases enriched: ${enriched.length} rows. Tool images found: ${enriched.filter((r: any) => r.tool?.image_url).length}`);
    return c.json({ success: true, data: enriched });
  } catch (error) {
    console.log(`Error fetching user purchases: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Verify license key (public)
app.post("/make-server-e07959ec/verify-license", async (c) => {
  try {
    const { licenseKey } = await c.req.json();
    
    if (!licenseKey) {
      return c.json({ success: false, error: "License key is required" }, 400);
    }
    
    const { data, error } = await supabase
      .from('user_purchases')
      .select(`
        *,
        tool_versions (
          *,
          tools (*)
        )
      `)
      .eq('license_key', licenseKey)
      .eq('status', 'active')
      .single();
    
    if (error || !data) {
      return c.json({ 
        success: false, 
        valid: false,
        error: "Invalid or inactive license key" 
      }, 404);
    }
    
    // Check if subscription has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return c.json({ 
        success: false, 
        valid: false,
        error: "License has expired" 
      }, 400);
    }
    
    return c.json({ 
      success: true, 
      valid: true,
      data: {
        product_name: data.product_name,
        variant_name: data.variant_name,
        expires_at: data.expires_at,
      }
    });
  } catch (error) {
    console.log(`Error verifying license: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== USER PURCHASE SYNC ==========

// Sync orphan purchases — links purchases made before sign-up to the authenticated user
app.post("/make-server-e07959ec/user/sync-purchases", requireUserAuth, async (c) => {
  try {
    const user  = c.get('user');
    const email = user.email?.toLowerCase();

    if (!email) return c.json({ success: false, error: 'No email on account' }, 400);

    // Look up KV key written during the webhook for this email
    const orphanKey    = `ls_orphan:${email}`;
    const orphanOrders: string[] = (await kv.get(orphanKey)) || [];

    let synced = 0;

    if (orphanOrders.length > 0) {
      for (const orderId of orphanOrders) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ user_id: user.id })
          .eq('lemon_squeezy_order_id', String(orderId))
          .is('user_id', null);
        if (!error) synced++;
        else console.log(`Error linking order ${orderId}:`, error.message);
      }
      if (synced > 0) {
        await kv.del(orphanKey);
        console.log(`✅ Synced ${synced} orphan purchase(s) for ${email}`);
      }
    }

    return c.json({ success: true, synced });
  } catch (error) {
    console.log('Error syncing purchases:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== LEMON SQUEEZY DEBUG ==========

// Temporary debug endpoint — logs the raw LS payload to Edge Function logs
// Call: POST /webhooks/lemon-squeezy-debug  (no auth required)
// REMOVE this after debugging is done
app.post("/make-server-e07959ec/webhooks/lemon-squeezy-debug", async (c) => {
  const rawBody   = await c.req.text();
  const signature = c.req.header('X-Signature') || '(none)';
  const headers   = Object.fromEntries(c.req.raw.headers.entries());

  console.log('=== LS DEBUG DUMP ===');
  console.log('Signature header:', signature);
  console.log('Headers:', JSON.stringify(headers, null, 2));
  try {
    const parsed = JSON.parse(rawBody);
    console.log('Parsed body:', JSON.stringify(parsed, null, 2));
    // Also verify signature for comparison
    const secret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET');
    if (secret) {
      const valid = await verifyLSSignature(secret, rawBody, signature);
      console.log('Signature valid?', valid);
    }
    return c.json({ success: true, event: parsed.meta?.event_name, signatureReceived: signature });
  } catch (e) {
    console.log('Body parse error:', e);
    console.log('Raw body (first 500):', rawBody.substring(0, 500));
    return c.json({ success: false, error: String(e) });
  }
});

// ========== LEMON SQUEEZY WEBHOOK ==========

// Helper: verify Lemon Squeezy HMAC-SHA256 signature
async function verifyLSSignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === signature;
  } catch (e) {
    console.error('LS signature verification error:', e);
    return false;
  }
}

// Webhook endpoint to receive purchase notifications from Lemon Squeezy
app.post("/make-server-e07959ec/webhooks/lemon-squeezy", async (c) => {
  try {
    // Must read raw body first for HMAC verification
    const rawBody   = await c.req.text();
    const signature = c.req.header('X-Signature') || '';

    // ── Signature verification ────────────────────────────────────────────
    const webhookSecret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const valid = await verifyLSSignature(webhookSecret, rawBody, signature);
      if (!valid) {
        console.log('❌ Invalid Lemon Squeezy webhook signature');
        return c.json({ error: 'Invalid signature' }, 401);
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.warn('⚠️  LEMON_SQUEEZY_WEBHOOK_SECRET not set — skipping verification');
    }

    const body      = JSON.parse(rawBody);
    const eventType = body.meta?.event_name;
    console.log('Lemon Squeezy webhook event:', eventType);

    // ── order_created ────────────────────────────────────────────────────
    if (eventType === 'order_created') {
      const orderData     = body.data;
      const customerEmail = orderData.attributes?.user_email;
      const orderId       = String(orderData.id);

      // Priority 1: user_id passed as custom checkout data
      let userId: string | null = body.meta?.custom_data?.user_id || null;

      // Priority 2: look up by email in user_profiles
      if (!userId && customerEmail) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', customerEmail)
          .maybeSingle();
        userId = profile?.id || null;
      }

      // Priority 3: search auth.users directly via admin API
      if (!userId && customerEmail) {
        try {
          const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = users?.find((u: any) => u.email === customerEmail);
          if (found) userId = found.id;
        } catch (e) {
          console.warn('Could not list users for webhook lookup:', e);
        }
      }

      console.log(`order_created: email=${customerEmail}, resolved user_id=${userId}`);

      // If we have a tool_version_id from checkout custom data, look up our own version_type
      // from the DB so variant_name always stores our clean value ("Free", "Pro", "Studio")
      // instead of whatever arbitrary string Lemon Squeezy uses for the variant name.
      const toolVersionId: string | null = body.meta?.custom_data?.tool_version_id || null;
      let resolvedVariantName: string = orderData.attributes?.first_order_item?.variant_name || '';
      if (toolVersionId) {
        const { data: tvRow } = await supabase
          .from('tool_versions')
          .select('version_type')
          .eq('id', toolVersionId)
          .maybeSingle();
        if (tvRow?.version_type) {
          resolvedVariantName = tvRow.version_type;
          console.log(`  → variant_name resolved from DB: "${resolvedVariantName}" (LS sent: "${orderData.attributes?.first_order_item?.variant_name}")`);
        }
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from('user_purchases')
        .insert({
          user_id:                   userId,
          tool_version_id:           toolVersionId,
          lemon_squeezy_order_id:    orderId,
          lemon_squeezy_customer_id: orderData.attributes?.customer_id,
          license_key:               orderData.attributes?.first_order_item?.license_key || null,
          product_name:              orderData.attributes?.first_order_item?.product_name,
          variant_name:              resolvedVariantName,
          status:                    'active',
          amount:                    parseFloat(orderData.attributes?.total || '0') / 100,
          currency:                  orderData.attributes?.currency || 'USD',
          purchased_at:              orderData.attributes?.created_at,
        })
        .select()
        .single();

      if (purchaseError) {
        console.log(`Error creating purchase: ${purchaseError.message}`);
        return c.json({ success: false, error: purchaseError.message }, 500);
      }

      console.log('✅ Purchase created:', purchase.id);

      // ── Mark the behavior tracking session as converted ──────────────────
      const trackingSessionId: string | null = body.meta?.custom_data?.session_id || null;
      if (trackingSessionId) {
        try {
          const tSession: any = await kv.get(`session:${trackingSessionId}`);
          if (tSession) {
            tSession.events = tSession.events || [];
            tSession.events.push({
              type: 'purchase_complete',
              timestamp: new Date().toISOString(),
              data: {
                orderId,
                toolVersionId: toolVersionId || null,
                productName: orderData.attributes?.first_order_item?.product_name || '',
                amount: parseFloat(orderData.attributes?.total || '0') / 100,
              },
            });
            tSession.converted   = true;
            tSession.funnelStage = 'purchase';
            if (customerEmail && !tSession.userEmail) tSession.userEmail = customerEmail;
            await kv.set(`session:${trackingSessionId}`, tSession);
            console.log(`✅ Tracking session ${trackingSessionId} marked as converted`);
          }
        } catch (e) {
          console.warn('Could not update tracking session on purchase:', e);
        }
      }

      // If no user found, track in KV so the user can claim it after sign-up
      if (!userId && customerEmail) {
        const orphanKey = `ls_orphan:${customerEmail.toLowerCase()}`;
        const existing: string[] = (await kv.get(orphanKey)) || [];
        if (!existing.includes(orderId)) {
          await kv.set(orphanKey, [...existing, orderId]);
          console.log(`📦 Orphan purchase tracked for ${customerEmail}`);
        }
      }

      return c.json({ success: true, data: purchase });
    }

    // ── license_key_created ───────────────────────────────────────────────
    // Lemon Squeezy fires this as a SEPARATE event — the key may not be
    // present in order_created yet, so we upsert it here.
    if (eventType === 'license_key_created') {
      const licenseData   = body.data;
      const licenseKey    = licenseData.attributes?.key;
      const orderId       = String(licenseData.attributes?.order_id);
      const customerEmail = licenseData.attributes?.user_email;

      console.log(`license_key_created: order_id=${orderId}, key=${licenseKey?.substring(0, 8)}…`);

      if (licenseKey && orderId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ license_key: licenseKey })
          .eq('lemon_squeezy_order_id', orderId);

        if (error) console.error('Error updating license key:', error.message);
        else console.log('✅ License key saved for order:', orderId);
      }

      // Keep orphan KV in sync
      if (customerEmail && orderId) {
        const orphanKey = `ls_orphan:${customerEmail.toLowerCase()}`;
        const existing: string[] = (await kv.get(orphanKey)) || [];
        if (!existing.includes(orderId)) {
          await kv.set(orphanKey, [...existing, orderId]);
        }
      }

      return c.json({ success: true, message: 'License key saved' });
    }

    // ── order_refunded ────────────────────────────────────────────────────
    if (eventType === 'order_refunded') {
      const orderId = String(body.data?.id);
      if (orderId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: 'refunded' })
          .eq('lemon_squeezy_order_id', orderId);
        if (error) console.error('Error marking refund:', error.message);
        else console.log('✅ Order marked refunded:', orderId);
      }
      return c.json({ success: true, message: 'Refund recorded' });
    }

    // ── subscription_created ──────────────────────────────────────────────
    // First event after checkout for subscription products.
    // Links the subscription ID to the purchase row and stores expires_at.
    if (eventType === 'subscription_created') {
      const sub       = body.data;
      const subId     = String(sub?.id);
      const orderId   = String(sub?.attributes?.order_id);
      const renewsAt  = sub?.attributes?.renews_at || null;
      const endsAt    = sub?.attributes?.ends_at   || null;
      const expiresAt = endsAt || renewsAt || null;

      console.log(`subscription_created: sub_id=${subId} order_id=${orderId} renews_at=${renewsAt} ends_at=${endsAt}`);

      if (subId && orderId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ lemon_squeezy_subscription_id: subId, status: 'active', expires_at: expiresAt })
          .eq('lemon_squeezy_order_id', orderId);
        if (error) console.error('subscription_created update error:', error.message);
        else console.log(`✅ Linked subscription ${subId} to order ${orderId}`);
      }
      return c.json({ success: true, message: 'Subscription linked' });
    }

    // ── subscription_updated ──────────────────────────────────────────────
    // Fires whenever subscription data changes (renewals, plan changes, etc.)
    if (eventType === 'subscription_updated') {
      const sub      = body.data;
      const subId    = String(sub?.id);
      const lsStatus = sub?.attributes?.status; // active | cancelled | expired | on_trial | paused | past_due
      const renewsAt = sub?.attributes?.renews_at || null;
      const endsAt   = sub?.attributes?.ends_at   || null;
      const expiresAt = endsAt || renewsAt || null;

      const statusMap: Record<string, string> = {
        active:   'active',
        on_trial: 'active',
        past_due: 'active', // still has access
        paused:   'cancelled',
        cancelled: 'cancelled',
        expired:  'expired',
      };
      const newStatus = statusMap[lsStatus] ?? 'active';

      console.log(`subscription_updated: sub_id=${subId} ls_status=${lsStatus} → db_status=${newStatus} expires_at=${expiresAt}`);

      if (subId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: newStatus, expires_at: expiresAt })
          .eq('lemon_squeezy_subscription_id', subId);
        if (error) console.error('subscription_updated error:', error.message);
        else console.log(`✅ Subscription ${subId} updated → ${newStatus}`);
      }
      return c.json({ success: true, message: 'Subscription updated' });
    }

    // ── subscription_payment_success ──────────────────────────────────────
    // Fires on every successful renewal payment — restore active + new expires_at
    if (eventType === 'subscription_payment_success') {
      const sub       = body.data;
      const subId     = String(sub?.attributes?.subscription_id || sub?.id);
      const renewsAt  = sub?.attributes?.renews_at || null;
      const endsAt    = sub?.attributes?.ends_at   || null;
      const expiresAt = endsAt || renewsAt || null;

      console.log(`subscription_payment_success: sub_id=${subId} expires_at=${expiresAt}`);

      if (subId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: 'active', expires_at: expiresAt })
          .eq('lemon_squeezy_subscription_id', subId);
        if (error) console.error('subscription_payment_success error:', error.message);
        else console.log(`✅ Subscription ${subId} renewed → active`);
      }
      return c.json({ success: true, message: 'Subscription renewed' });
    }

    // ── subscription_resumed ──────────────────────────────────────────────
    // Fires when a paused/cancelled subscription is reactivated
    if (eventType === 'subscription_resumed') {
      const sub      = body.data;
      const subId    = String(sub?.id);
      const renewsAt = sub?.attributes?.renews_at || null;

      console.log(`subscription_resumed: sub_id=${subId}`);

      if (subId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: 'active', expires_at: renewsAt })
          .eq('lemon_squeezy_subscription_id', subId);
        if (error) console.error('subscription_resumed error:', error.message);
        else console.log(`✅ Subscription ${subId} resumed → active`);
      }
      return c.json({ success: true, message: 'Subscription resumed' });
    }

    // ── subscription_cancelled / subscription_expired ─────────────────────
    if (eventType === 'subscription_cancelled' || eventType === 'subscription_expired') {
      const sub       = body.data;
      const subId     = String(sub?.id);
      const orderId   = String(sub?.attributes?.order_id || '');
      const newStatus = eventType === 'subscription_expired' ? 'expired' : 'cancelled';
      const endsAt    = sub?.attributes?.ends_at || null;

      console.log(`${eventType}: sub_id=${subId} order_id=${orderId} ends_at=${endsAt}`);

      if (subId) {
        // Primary: match by subscription ID
        const { data: updated, error } = await supabase
          .from('user_purchases')
          .update({ status: newStatus, expires_at: endsAt })
          .eq('lemon_squeezy_subscription_id', subId)
          .select('id');
        if (error) console.error(`${eventType} error:`, error.message);

        // Fallback: if subscription ID wasn't stored yet, match by order ID
        if (!updated?.length && orderId) {
          const { error: err2 } = await supabase
            .from('user_purchases')
            .update({ status: newStatus, lemon_squeezy_subscription_id: subId, expires_at: endsAt })
            .eq('lemon_squeezy_order_id', orderId);
          if (err2) console.error(`${eventType} fallback error:`, err2.message);
          else console.log(`✅ Subscription ${subId} → ${newStatus} (matched via order_id fallback)`);
        } else {
          console.log(`✅ Subscription ${subId} → ${newStatus}`);
        }
      }
      return c.json({ success: true, message: 'Subscription status updated' });
    }

    return c.json({ success: true, message: 'Webhook received (unhandled event)' });
  } catch (error) {
    console.log(`Error in Lemon Squeezy webhook: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== CONTACT FORM ENDPOINT ==========

// Submit contact form (public, sends email)
app.post("/make-server-e07959ec/contact", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, projectType, timeline, budget, message } = body;

    if (!name || !email || !message) {
      return c.json({ 
        success: false, 
        error: "Name, email, and message are required" 
      }, 400);
    }

    // ── Store message in KV for admin dashboard (always, even if email fails) ──
    try {
      const msgTs    = Date.now();
      const msgUuid  = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
      const msgKvKey = `msg:${msgTs}:contact:${msgUuid}`;
      await kv.set(msgKvKey, {
        kvKey: msgKvKey,
        id: `${msgTs}-${msgUuid}`,
        type: 'contact',
        name: name || '',
        email: email || '',
        projectType: projectType || '',
        timeline: timeline || '',
        budget: budget || '',
        message: message || '',
        read: false,
        createdAt: new Date().toISOString(),
      });
      console.log(`[contact] Message stored in KV: ${msgKvKey}`);
    } catch (kvErr) {
      console.log('[contact] KV store warning:', kvErr);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('Error: RESEND_API_KEY not configured');
      return c.json({ 
        success: false, 
        error: "Email service not configured" 
      }, 500);
    }

    const resend = new Resend(resendApiKey);

    const emailHtml = `
      <h2>New Contact Form Submission</h2>
      <p><strong>From:</strong> ${name} (${email})</p>
      
      ${projectType ? `<p><strong>Project Type:</strong> ${projectType}</p>` : ''}
      ${timeline ? `<p><strong>Timeline:</strong> ${timeline}</p>` : ''}
      ${budget ? `<p><strong>Budget:</strong> ${budget}</p>` : ''}
      
      <h3>Message:</h3>
      <p>${message.replace(/\n/g, '<br>')}</p>
      
      <hr>
      <p style="color: #666; font-size: 12px;">
        Submitted on ${new Date().toLocaleString('en-US', { 
          dateStyle: 'full', 
          timeStyle: 'short' 
        })}
      </p>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Fastoosh Contact Form <onboarding@resend.dev>',
      to: ['youssefdari7@gmail.com'],
      subject: `New Contact: ${name} - ${projectType || 'General Inquiry'}`,
      html: emailHtml,
      replyTo: email,
    });

    if (error) {
      console.log(`Error sending email: ${JSON.stringify(error)}`);
      return c.json({ 
        success: false, 
        error: 'Failed to send email' 
      }, 500);
    }

    console.log(`Contact form email sent. Resend ID: ${data?.id}`);

    return c.json({ 
      success: true, 
      message: "Your message has been sent successfully! We'll reply within 24-48 hours." 
    });
  } catch (error) {
    console.log(`Error in contact form: ${error}`);
    return c.json({ 
      success: false, 
      error: "An unexpected error occurred" 
    }, 500);
  }
});

// Tool support form (public, tool-specific email)
app.post("/make-server-e07959ec/tool-support", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, toolName, inquiryType, message } = body;

    if (!name || !email || !message || !toolName || !inquiryType) {
      return c.json({ success: false, error: "All fields are required" }, 400);
    }

    // ── Store message in KV for admin dashboard ──
    try {
      const msgTs    = Date.now();
      const msgUuid  = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
      const msgKvKey = `msg:${msgTs}:support:${msgUuid}`;
      await kv.set(msgKvKey, {
        kvKey: msgKvKey,
        id: `${msgTs}-${msgUuid}`,
        type: 'support',
        name: name || '',
        email: email || '',
        toolName: toolName || '',
        inquiryType: inquiryType || '',
        message: message || '',
        read: false,
        createdAt: new Date().toISOString(),
      });
      console.log(`[tool-support] Message stored in KV: ${msgKvKey}`);
    } catch (kvErr) {
      console.log('[tool-support] KV store warning:', kvErr);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('Error: RESEND_API_KEY not configured for tool-support');
      return c.json({ success: false, error: "Email service not configured" }, 500);
    }

    const resend = new Resend(resendApiKey);

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 20px;font-size:20px;color:#111">Tool Support Request</h2>

        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          <tr style="background:#f5f5f5">
            <td style="padding:10px 14px;color:#555;font-size:13px;width:130px">Tool</td>
            <td style="padding:10px 14px;font-weight:700;font-size:13px;color:#111">${toolName}</td>
          </tr>
          <tr style="background:#ebebeb">
            <td style="padding:10px 14px;color:#555;font-size:13px">Inquiry type</td>
            <td style="padding:10px 14px;font-size:13px;color:#111">${inquiryType}</td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:10px 14px;color:#555;font-size:13px">Name</td>
            <td style="padding:10px 14px;font-size:13px;color:#111">${name}</td>
          </tr>
          <tr style="background:#ebebeb">
            <td style="padding:10px 14px;color:#555;font-size:13px">Email</td>
            <td style="padding:10px 14px;font-size:13px"><a href="mailto:${email}" style="color:#7c3aed">${email}</a></td>
          </tr>
        </table>

        <h3 style="margin:0 0 8px;font-size:13px;color:#555;text-transform:uppercase;letter-spacing:0.05em">Message</h3>
        <p style="margin:0;white-space:pre-wrap;line-height:1.7;font-size:14px;color:#111;background:#f9f9f9;padding:14px;border-left:3px solid #7c3aed">${message.replace(/\n/g, '<br>')}</p>

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
        <p style="color:#999;font-size:11px;margin:0">
          Submitted on ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
        </p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Fastoosh Tools <onboarding@resend.dev>',
      to: ['youssefdari7@gmail.com'],
      subject: `[${inquiryType}] ${toolName} — ${name}`,
      html: emailHtml,
      replyTo: email,
    });

    if (error) {
      console.log(`Error sending tool support email: ${JSON.stringify(error)}`);
      return c.json({ success: false, error: 'Failed to send email' }, 500);
    }

    console.log(`Tool support email sent. Resend ID: ${data?.id}`);
    return c.json({ success: true, message: "Message sent! We'll reply within 24 hours." });
  } catch (error) {
    console.log(`Error in tool-support route: ${error}`);
    return c.json({ success: false, error: "An unexpected error occurred" }, 500);
  }
});

// ========== FREE TOOL DOWNLOAD LEAD CAPTURE ==========

// POST /free-download — records guest email (or signed-in user) before download
app.post('/make-server-e07959ec/free-download', async (c) => {
  try {
    const { email, toolVersionId, toolName, toolSlug } = await c.req.json();

    if (!email || !toolVersionId) {
      return c.json({ success: false, error: 'email and toolVersionId are required' }, 400);
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ success: false, error: 'Invalid email address' }, 400);
    }

    // Verify the tool version exists and is Free
    const { data: version, error: vErr } = await supabase
      .from('tool_versions')
      .select('id, version_type, download_url')
      .eq('id', toolVersionId)
      .single();

    if (vErr || !version) {
      console.log(`[free-download] Tool version not found: ${toolVersionId}`);
      return c.json({ success: false, error: 'Tool version not found' }, 404);
    }

    if (version.version_type !== 'Free') {
      return c.json({ success: false, error: 'This endpoint is only for free tool downloads' }, 400);
    }

    // Store lead in KV — keyed per version+email so we don't duplicate
    const safeEmail = btoa(email.toLowerCase().trim()).replace(/=/g, '');
    const kvKey     = `lead:free:${toolVersionId}:${safeEmail}`;
    const logKey    = `lead:free:log:${Date.now()}:${safeEmail}`;

    const leadData = {
      email:         email.toLowerCase().trim(),
      toolVersionId,
      toolName:      toolName  || '',
      toolSlug:      toolSlug  || '',
      downloadedAt:  new Date().toISOString(),
    };

    // Upsert deduplicated entry + append to log
    await kv.set(kvKey,  leadData);
    await kv.set(logKey, leadData);

    console.log(`[free-download] ✅ Lead recorded: ${email} → ${toolName}`);

    return c.json({
      success:     true,
      downloadUrl: version.download_url,
    });
  } catch (error) {
    console.log(`[free-download] Error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /free-download/leads — admin: list all free download leads (protected)
app.get('/make-server-e07959ec/free-download/leads', requireAuth, async (c) => {
  try {
    const toolVersionId = c.req.query('toolVersionId');
    const prefix = toolVersionId
      ? `lead:free:${toolVersionId}:`
      : 'lead:free:log:';

    const leads = await kv.getByPrefix(prefix);
    return c.json({ success: true, data: leads, count: leads.length });
  } catch (error) {
    console.log(`[free-download/leads] Error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== UNIFIED LEADS ENDPOINT ==========

// GET /leads — admin: all emails from every source (free downloads + signups), enriched
app.get('/make-server-e07959ec/leads', requireAuth, async (c) => {
  try {
    // ── 1. Free-download KV leads ───────────────────────────────────────────
    const kvLeads: any[] = await kv.getByPrefix('lead:free:log:');

    // Batch-enrich with tool category by joining tool_versions → tools
    const uniqueVersionIds = [...new Set(kvLeads.map((l: any) => l.toolVersionId).filter(Boolean))];
    const versionCategoryMap: Record<string, string> = {};

    if (uniqueVersionIds.length > 0) {
      const { data: versions, error: vErr } = await supabase
        .from('tool_versions')
        .select('id, tools(category)')
        .in('id', uniqueVersionIds);

      if (vErr) {
        console.log('[leads] Warning: could not enrich categories:', vErr.message);
      } else if (versions) {
        for (const v of versions) {
          versionCategoryMap[v.id] = (v as any).tools?.category || '';
        }
      }
    }

    const freeLeads = kvLeads.map((l: any) => ({
      email:         l.email || '',
      source:        'free_download',
      tier:          'Free',
      toolName:      l.toolName     || '',
      toolSlug:      l.toolSlug     || '',
      toolCategory:  versionCategoryMap[l.toolVersionId] || '',
      toolVersionId: l.toolVersionId || '',
      createdAt:     l.downloadedAt  || '',
    }));

    // ── 2. Supabase Auth registered users ───────────────────────────────────
    let signupLeads: any[] = [];
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (usersErr) {
      console.log('[leads] Warning: could not fetch auth users:', usersErr.message);
    } else {
      signupLeads = (usersData?.users || []).map((u: any) => ({
        email:         u.email || '',
        source:        'signup',
        tier:          'Registered',
        toolName:      '',
        toolSlug:      '',
        toolCategory:  '',
        toolVersionId: '',
        createdAt:     u.created_at || '',
        displayName:   u.user_metadata?.full_name || '',
      }));
    }

    // ── 3. Merge & sort newest-first ─────────────────────────────────────────
    const allLeads = [...freeLeads, ...signupLeads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`[leads] Returning ${allLeads.length} leads (${freeLeads.length} free downloads + ${signupLeads.length} signups)`);
    return c.json({ success: true, data: allLeads, count: allLeads.length });
  } catch (error) {
    console.log('[leads] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/leads/behavior?email=<email> — behavioral summary for a known lead
app.get('/make-server-e07959ec/admin/leads/behavior', requireAuth, async (c) => {
  try {
    const email = (c.req.query('email') || '').toLowerCase().trim();
    if (!email) return c.json({ success: false, error: 'email param required' }, 400);

    const allSessions: any[] = await kv.getByPrefix('session:');
    const matched = allSessions.filter((s: any) =>
      (s.userEmail || '').toLowerCase() === email
    );

    if (matched.length === 0) {
      return c.json({ success: true, data: null });
    }

    const FUNNEL_RANK: Record<string, number> = {
      visit: 0, tool_view: 1, buy_click: 2, purchase: 3,
    };

    let topFunnel     = 'visit';
    let converted     = false;
    let totalDuration = 0;
    const pagesSet    = new Set<string>();
    const toolsSet    = new Set<string>();
    let firstSeen     = matched[0].startedAt  || '';
    let lastSeen      = matched[0].lastSeenAt || '';

    for (const s of matched) {
      if (s.startedAt  && (!firstSeen || new Date(s.startedAt)  < new Date(firstSeen))) firstSeen = s.startedAt;
      if (s.lastSeenAt && (!lastSeen  || new Date(s.lastSeenAt) > new Date(lastSeen)))  lastSeen  = s.lastSeenAt;
      totalDuration += s.totalDuration || 0;
      if (s.converted) converted = true;
      if ((FUNNEL_RANK[s.funnelStage] ?? 0) > (FUNNEL_RANK[topFunnel] ?? 0)) topFunnel = s.funnelStage;
      for (const e of (s.events || [])) {
        if (e.type === 'page_view' && e.data?.path) pagesSet.add(e.data.path);
      }
      for (const t of (s.toolNamesViewed || [])) {
        if (t) toolsSet.add(t);
      }
    }

    // Most recent session for device / browser / referrer
    const recent = [...matched].sort((a: any, b: any) =>
      new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime()
    )[0];

    return c.json({
      success: true,
      data: {
        sessionCount:  matched.length,
        firstSeen,
        lastSeen,
        totalDuration,
        pagesVisited:  [...pagesSet],
        toolsViewed:   [...toolsSet],
        funnelStage:   topFunnel,
        converted,
        device:        recent.device      || 'desktop',
        browser:       recent.browser     || '',
        os:            recent.os          || '',
        referrer:      recent.referrer    || '',
        utmSource:     recent.utmSource   || null,
        utmMedium:     recent.utmMedium   || null,
        utmCampaign:   recent.utmCampaign || null,
      },
    });
  } catch (error) {
    console.log('[admin/leads/behavior] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== LEMON SQUEEZY LIVE REVENUE ENDPOINT ==========

// Helper: fetch all pages from a Lemon Squeezy list endpoint
async function lsFetchAll(apiKey: string, path: string, extraParams: Record<string, string> = {}): Promise<any[]> {
  const results: any[] = [];
  let pageNumber = 1;
  const pageSize  = 100;
  while (true) {
    const params = new URLSearchParams({
      'page[size]':   String(pageSize),
      'page[number]': String(pageNumber),
      ...extraParams,
    });
    const res = await fetch(`https://api.lemonsqueezy.com/v1${path}?${params}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/vnd.api+json',
      },
    });
    if (!res.ok) {
      console.log(`[ls] ${path} page ${pageNumber} error ${res.status}: ${await res.text()}`);
      break;
    }
    const json = await res.json();
    const data = json.data ?? [];
    results.push(...data);
    if (data.length < pageSize) break;
    pageNumber++;
  }
  return results;
}

// GET /admin/ls-revenue — live revenue data pulled directly from Lemon Squeezy API
app.get('/make-server-e07959ec/admin/ls-revenue', requireAuth, async (c) => {
  try {
    const apiKey = Deno.env.get('LEMON_SQUEEZY_API_KEY');
    if (!apiKey) {
      return c.json({ success: false, error: 'LEMON_SQUEEZY_API_KEY is not configured' }, 500);
    }

    const orders = await lsFetchAll(apiKey, '/orders');
    console.log(`[ls-revenue] Fetched ${orders.length} orders from Lemon Squeezy`);

    const now            = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
    const todayStr       = now.toISOString().split('T')[0];

    const paidOrders     = orders.filter((o: any) => ['paid', 'partial_refund'].includes(o.attributes?.status));
    const refundedOrders = orders.filter((o: any) => ['refunded', 'partial_refund'].includes(o.attributes?.status));

    const toUSD = (cents: number) => parseFloat((cents / 100).toFixed(2));
    const sumCents = (arr: any[]) => arr.reduce((s: number, o: any) => s + (o.attributes?.total_usd ?? o.attributes?.total ?? 0), 0);

    const totalRevenue  = sumCents(paidOrders);
    const totalRefunded = sumCents(refundedOrders);
    const revenue30d    = sumCents(paidOrders.filter((o: any) => new Date(o.attributes?.created_at || 0) >= thirtyDaysAgo));
    const revenue7d     = sumCents(paidOrders.filter((o: any) => new Date(o.attributes?.created_at || 0) >= sevenDaysAgo));
    const revenueToday  = sumCents(paidOrders.filter((o: any) => (o.attributes?.created_at || '').startsWith(todayStr)));

    // By status
    const statusMap: Record<string, { count: number; total: number }> = {};
    for (const o of orders as any[]) {
      const st = o.attributes?.status || 'unknown';
      if (!statusMap[st]) statusMap[st] = { count: 0, total: 0 };
      statusMap[st].count++;
      statusMap[st].total += o.attributes?.total_usd ?? o.attributes?.total ?? 0;
    }
    const byStatus = Object.entries(statusMap)
      .map(([status, v]) => ({ status, count: v.count, total: toUSD(v.total) }))
      .sort((a, b) => b.total - a.total);

    // By product
    const productMap: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const o of paidOrders as any[]) {
      const name = o.attributes?.first_order_item?.product_name || 'Unknown';
      if (!productMap[name]) productMap[name] = { name, revenue: 0, sales: 0 };
      productMap[name].revenue += o.attributes?.total_usd ?? o.attributes?.total ?? 0;
      productMap[name].sales++;
    }
    const byProduct = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(p => ({ ...p, revenue: toUSD(p.revenue) }));

    // By variant / tier
    const variantMap: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const o of paidOrders as any[]) {
      const name = o.attributes?.first_order_item?.variant_name || 'Unknown';
      if (!variantMap[name]) variantMap[name] = { name, revenue: 0, sales: 0 };
      variantMap[name].revenue += o.attributes?.total_usd ?? o.attributes?.total ?? 0;
      variantMap[name].sales++;
    }
    const byVariant = Object.values(variantMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(v => ({ ...v, revenue: toUSD(v.revenue) }));

    // Daily series — last 30 days
    const seriesMap: Record<string, { revenue: number; sales: number; refunds: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      seriesMap[d.toISOString().split('T')[0]] = { revenue: 0, sales: 0, refunds: 0 };
    }
    for (const o of orders as any[]) {
      const dateStr = (o.attributes?.created_at || '').split('T')[0];
      if (!seriesMap[dateStr]) continue;
      const cents = o.attributes?.total_usd ?? o.attributes?.total ?? 0;
      if (['paid', 'partial_refund'].includes(o.attributes?.status)) {
        seriesMap[dateStr].revenue += cents;
        seriesMap[dateStr].sales++;
      }
      if (['refunded', 'partial_refund'].includes(o.attributes?.status)) {
        seriesMap[dateStr].refunds++;
      }
    }
    const series = Object.entries(seriesMap).map(([date, v]) => ({
      date,
      revenue: toUSD(v.revenue),
      sales:   v.sales,
      refunds: v.refunds,
    }));

    // Recent orders
    const recentOrders = [...orders as any[]]
      .sort((a, b) => new Date(b.attributes?.created_at || 0).getTime() - new Date(a.attributes?.created_at || 0).getTime())
      .slice(0, 20)
      .map((o: any) => ({
        id:          o.id,
        orderNumber: o.attributes?.order_number,
        status:      o.attributes?.status,
        email:       o.attributes?.user_email || '',
        productName: o.attributes?.first_order_item?.product_name || '',
        variantName: o.attributes?.first_order_item?.variant_name || '',
        total:       toUSD(o.attributes?.total_usd ?? o.attributes?.total ?? 0),
        currency:    o.attributes?.currency || 'USD',
        createdAt:   o.attributes?.created_at || '',
        refundedAt:  o.attributes?.refunded_at || null,
        lsUrl:       `https://app.lemonsqueezy.com/orders/${o.id}`,
      }));

    return c.json({
      success: true,
      data: {
        summary: {
          totalOrders:    orders.length,
          paidOrders:     paidOrders.length,
          refundedOrders: refundedOrders.length,
          totalRevenue:   toUSD(totalRevenue),
          totalRefunded:  toUSD(totalRefunded),
          netRevenue:     toUSD(totalRevenue - totalRefunded),
          revenue30d:     toUSD(revenue30d),
          revenue7d:      toUSD(revenue7d),
          revenueToday:   toUSD(revenueToday),
        },
        byStatus,
        byProduct,
        byVariant,
        series,
        recentOrders,
      },
    });
  } catch (error) {
    console.log('[admin/ls-revenue] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== BEHAVIOR TRACKING ENDPOINTS ==========

// POST /track/event — public, no auth. Called by frontend to record user behavior.
app.post('/make-server-e07959ec/track/event', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, events, meta } = body;
    if (!sessionId || !Array.isArray(events)) {
      return c.json({ success: false, error: 'sessionId and events[] required' }, 400);
    }

    let session: any = await kv.get(`session:${sessionId}`);
    if (!session) {
      session = {
        sessionId,
        startedAt:   new Date().toISOString(),
        events:      [],
        device:      meta?.device      || 'desktop',
        browser:     meta?.browser     || 'Other',
        os:          meta?.os          || 'Other',
        referrer:    meta?.referrer    || '',
        screenWidth: meta?.screenWidth || null,
        language:    meta?.language    || null,
        utmSource:   meta?.utmSource   || null,
        utmMedium:   meta?.utmMedium   || null,
        utmCampaign: meta?.utmCampaign || null,
      };
    }

    if (meta?.userId    && !session.userId)    session.userId    = meta.userId;
    if (meta?.userEmail && !session.userEmail) session.userEmail = meta.userEmail;

    const all: any[] = [...(session.events || []), ...events];
    session.events     = all.slice(-500);
    session.lastSeenAt = new Date().toISOString();

    const evs: any[]  = session.events;
    const pageViews   = evs.filter((e: any) => e.type === 'page_view');
    const pageExits   = evs.filter((e: any) => e.type === 'page_exit');
    const toolViews   = evs.filter((e: any) => e.type === 'tool_view');
    const buyClicks   = evs.filter((e: any) => e.type === 'buy_click');
    const videoPlays  = evs.filter((e: any) => e.type === 'video_play');
    const purchases   = evs.filter((e: any) => e.type === 'purchase_complete');

    session.pageCount       = pageViews.length;
    session.totalDuration   = pageExits.reduce((s: number, e: any) => s + (e.data?.duration || 0), 0);
    session.toolsViewed     = [...new Set(toolViews.map((e: any) => e.data?.toolSlug).filter(Boolean))];
    session.toolNamesViewed = [...new Set(toolViews.map((e: any) => e.data?.toolName).filter(Boolean))];
    session.buyClickCount   = buyClicks.length;
    session.videoPlayCount  = videoPlays.length;
    session.converted       = purchases.length > 0;
    session.isBounce        = session.pageCount <= 1 && session.totalDuration < 30;
    session.lastPath        = pageViews.at(-1)?.data?.path || '';

    if (purchases.length > 0)      session.funnelStage = 'purchase';
    else if (buyClicks.length > 0) session.funnelStage = 'buy_click';
    else if (toolViews.length > 0) session.funnelStage = 'tool_view';
    else                           session.funnelStage = 'visit';

    await kv.set(`session:${sessionId}`, session);
    return c.json({ success: true });
  } catch (error) {
    console.log('[track/event] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/behavior — admin auth. Paginated sessions + funnel analytics.
app.get('/make-server-e07959ec/admin/behavior', requireAuth, async (c) => {
  try {
    const { from, to, device, stage, converted, tool, page = '1', limit = '25' } = c.req.query();

    const allSessions: any[] = await kv.getByPrefix('session:');
    let sessions = [...allSessions];

    if (from) { const d = new Date(from); sessions = sessions.filter((s: any) => new Date(s.startedAt) >= d); }
    if (to)   { const d = new Date(to); d.setHours(23,59,59,999); sessions = sessions.filter((s: any) => new Date(s.startedAt) <= d); }
    if (device && device !== 'all')    sessions = sessions.filter((s: any) => (s.device || 'desktop') === device);
    if (stage  && stage  !== 'all')    sessions = sessions.filter((s: any) => s.funnelStage === stage);
    if (converted === 'true')          sessions = sessions.filter((s: any) => s.converted);
    if (converted === 'false')         sessions = sessions.filter((s: any) => !s.converted);
    if (tool) sessions = sessions.filter((s: any) => (s.toolsViewed || []).includes(tool));

    sessions.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const fVisits    = sessions.filter((s: any) => (s.pageCount || 0) > 0).length;
    const fToolViews = sessions.filter((s: any) => (s.toolsViewed?.length || 0) > 0).length;
    const fBuyClicks = sessions.filter((s: any) => (s.buyClickCount || 0) > 0).length;
    const fPurchases = sessions.filter((s: any) => s.converted).length;
    const pct = (n: number) => fVisits > 0 ? Math.round((n / fVisits) * 1000) / 10 : 0;

    const funnel = [
      { stage: 'visit',     label: 'Page Visits', count: fVisits,    pct: 100,             dropOff: 0 },
      { stage: 'tool_view', label: 'Tool Views',  count: fToolViews, pct: pct(fToolViews), dropOff: fVisits    - fToolViews },
      { stage: 'buy_click', label: 'Buy Clicks',  count: fBuyClicks, pct: pct(fBuyClicks), dropOff: fToolViews - fBuyClicks },
      { stage: 'purchase',  label: 'Purchases',   count: fPurchases, pct: pct(fPurchases), dropOff: fBuyClicks - fPurchases },
    ];

    const pageMap: Record<string, { count: number; totalDuration: number }> = {};
    for (const s of sessions) {
      for (const e of (s.events || []) as any[]) {
        if (e.type === 'page_view' && e.data?.path) {
          const p = e.data.path;
          if (!pageMap[p]) pageMap[p] = { count: 0, totalDuration: 0 };
          pageMap[p].count++;
        }
        if (e.type === 'page_exit' && e.data?.path) {
          const p = e.data.path;
          if (!pageMap[p]) pageMap[p] = { count: 0, totalDuration: 0 };
          pageMap[p].totalDuration += e.data.duration || 0;
        }
      }
    }
    const topPages = Object.entries(pageMap)
      .sort(([, a], [, b]) => b.count - a.count).slice(0, 12)
      .map(([path, v]) => ({ path, count: v.count, avgDuration: v.count > 0 ? Math.round(v.totalDuration / v.count) : 0 }));

    const toolMap: Record<string, { slug: string; name: string; views: number; buyClicks: number; videoPlays: number }> = {};
    for (const s of sessions) {
      for (const e of (s.events || []) as any[]) {
        const sl = e.data?.toolSlug;
        if (!sl) continue;
        if (!toolMap[sl]) toolMap[sl] = { slug: sl, name: e.data?.toolName || sl, views: 0, buyClicks: 0, videoPlays: 0 };
        if (e.type === 'tool_view')  toolMap[sl].views++;
        if (e.type === 'buy_click')  toolMap[sl].buyClicks++;
        if (e.type === 'video_play') toolMap[sl].videoPlays++;
      }
    }
    const toolFunnel = Object.values(toolMap)
      .sort((a, b) => b.views - a.views)
      .map(t => ({ ...t, convRate: t.views > 0 ? Math.round((t.buyClicks / t.views) * 100) : 0 }));

    const deviceMap: Record<string, number> = {};
    for (const s of sessions) { const d = s.device || 'desktop'; deviceMap[d] = (deviceMap[d] || 0) + 1; }

    const now = new Date();
    const seriesMap: Record<string, { sessions: number; toolViews: number; buyClicks: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      seriesMap[d.toISOString().split('T')[0]] = { sessions: 0, toolViews: 0, buyClicks: 0 };
    }
    for (const s of sessions) {
      const ds = (s.startedAt || '').split('T')[0];
      if (!seriesMap[ds]) continue;
      seriesMap[ds].sessions++;
      if ((s.toolsViewed?.length || 0) > 0) seriesMap[ds].toolViews++;
      if ((s.buyClickCount || 0) > 0)       seriesMap[ds].buyClicks++;
    }
    const dailySeries = Object.entries(seriesMap).map(([date, v]) => ({ date, ...v }));

    const totalDur = sessions.reduce((s: number, sess: any) => s + (sess.totalDuration || 0), 0);
    const bounces  = sessions.filter((s: any) => s.isBounce).length;
    const summary  = {
      totalSessions: sessions.length,
      bounceRate:    sessions.length > 0 ? Math.round((bounces / sessions.length) * 100) : 0,
      avgPageViews:  sessions.length > 0 ? +(sessions.reduce((s: number, sess: any) => s + (sess.pageCount || 0), 0) / sessions.length).toFixed(1) : 0,
      avgDuration:   sessions.length > 0 ? Math.round(totalDur / sessions.length) : 0,
      convRate:      sessions.length > 0 ? Math.round((fBuyClicks / sessions.length) * 100) : 0,
    };

    const pageNum  = Math.max(1, parseInt(page,  10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const total    = sessions.length;
    const paged    = sessions
      .slice((pageNum - 1) * limitNum, pageNum * limitNum)
      .map((s: any) => ({
        sessionId:       s.sessionId,
        userId:          s.userId          || null,
        userEmail:       s.userEmail       || null,
        startedAt:       s.startedAt,
        lastSeenAt:      s.lastSeenAt      || s.startedAt,
        device:          s.device          || 'desktop',
        browser:         s.browser         || 'Other',
        os:              s.os              || 'Other',
        referrer:        s.referrer        || '',
        utmSource:       s.utmSource       || null,
        utmMedium:       s.utmMedium       || null,
        utmCampaign:     s.utmCampaign     || null,
        pageCount:       s.pageCount       || 0,
        totalDuration:   s.totalDuration   || 0,
        toolsViewed:     s.toolsViewed     || [],
        toolNamesViewed: s.toolNamesViewed || [],
        buyClickCount:   s.buyClickCount   || 0,
        videoPlayCount:  s.videoPlayCount  || 0,
        converted:       s.converted       || false,
        isBounce:        s.isBounce        || false,
        lastPath:        s.lastPath        || '',
        funnelStage:     s.funnelStage     || 'visit',
        eventCount:      (s.events || []).length,
      }));

    return c.json({
      success: true,
      data: { total, page: pageNum, limit: limitNum, sessions: paged, funnel, topPages, toolFunnel, dailySeries, deviceBreakdown: Object.entries(deviceMap).map(([device, count]) => ({ device, count })), summary },
    });
  } catch (error) {
    console.log('[admin/behavior] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/behavior/session/:sid — full session detail with all events
app.get('/make-server-e07959ec/admin/behavior/session/:sid', requireAuth, async (c) => {
  try {
    const { sid } = c.req.param();
    const session = await kv.get(`session:${sid}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    return c.json({ success: true, data: session });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/behavior/heatmap?path=<path> — aggregate click coords + scroll depth for a page
app.get('/make-server-e07959ec/admin/behavior/heatmap', requireAuth, async (c) => {
  try {
    const { path: pagePath } = c.req.query();
    const allSessions: any[] = await kv.getByPrefix('session:');

    const clicks: Array<{ x: number; y: number }> = [];
    const pathSet = new Set<string>();

    // Scroll depth: sessions that visited this page and how far they scrolled
    const scrollTotals: Record<string, number> = { '25': 0, '50': 0, '75': 0, '100': 0 };
    let scrollVisitors = 0;

    for (const s of allSessions) {
      const evs: any[] = s.events || [];
      let visitedPage = false;

      for (const e of evs) {
        const ePath: string | undefined = e.data?.path;

        // Collect all visited paths for the dropdown (page_view, scroll_depth, click_map)
        if (ePath && (e.type === 'page_view' || e.type === 'scroll_depth' || e.type === 'click_map')) {
          pathSet.add(ePath);
        }

        // Click heatmap — sampled batches
        if (e.type === 'click_map' && ePath) {
          if (pagePath && ePath === pagePath && Array.isArray(e.data.clicks)) {
            for (const pt of e.data.clicks) {
              if (typeof pt.x === 'number' && typeof pt.y === 'number') clicks.push(pt);
            }
          }
        }

        // Scroll depth for selected page
        if (e.type === 'page_view' && ePath === pagePath) visitedPage = true;
        if (pagePath && e.type === 'scroll_depth' && ePath === pagePath) {
          const pct = String(e.data.percent);
          if (scrollTotals[pct] !== undefined) scrollTotals[pct]++;
        }
      }
      if (visitedPage && pagePath) scrollVisitors++;
    }

    const scrollDepth = Object.entries(scrollTotals).map(([percent, count]) => ({
      percent: parseInt(percent),
      count,
      pct: scrollVisitors > 0 ? Math.round((count / scrollVisitors) * 100) : 0,
    }));

    return c.json({
      success: true,
      data: {
        clicks,
        totalClicks: clicks.length,
        scrollDepth,
        scrollVisitors,
        availablePaths: [...pathSet].sort(),
      },
    });
  } catch (error) {
    console.log('[admin/behavior/heatmap] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== ADMIN MESSAGES ENDPOINTS ==========

// GET /admin/messages — all stored contact + support messages
app.get('/make-server-e07959ec/admin/messages', requireAuth, async (c) => {
  try {
    const all: any[] = await kv.getByPrefix('msg:');
    const sorted = all.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const unread = sorted.filter((m: any) => !m.read).length;
    return c.json({ success: true, data: sorted, unread, count: sorted.length });
  } catch (error) {
    console.log('[admin/messages] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// PUT /admin/messages/mark-read — mark one or all messages as read
app.put('/make-server-e07959ec/admin/messages/mark-read', requireAuth, async (c) => {
  try {
    const { kvKey, markAll } = await c.req.json();
    if (markAll) {
      const all: any[] = await kv.getByPrefix('msg:');
      await Promise.all(
        all.filter((m: any) => !m.read && m.kvKey)
           .map((m: any) => kv.set(m.kvKey, { ...m, read: true }))
      );
      console.log(`[admin/messages] Marked all ${all.length} messages as read`);
    } else if (kvKey) {
      const msg = await kv.get(kvKey);
      if (msg) {
        await kv.set(kvKey, { ...msg, read: true });
        console.log(`[admin/messages] Marked ${kvKey} as read`);
      }
    }
    return c.json({ success: true });
  } catch (error) {
    console.log('[admin/messages/mark-read] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE /admin/messages/:kvKey — delete a single message
app.delete('/make-server-e07959ec/admin/messages/delete', requireAuth, async (c) => {
  try {
    const { kvKey } = await c.req.json();
    if (kvKey) {
      await kv.del(kvKey);
      console.log(`[admin/messages] Deleted message: ${kvKey}`);
    }
    return c.json({ success: true });
  } catch (error) {
    console.log('[admin/messages/delete] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== ADMIN DASHBOARD ENDPOINT ==========

// GET /admin/dashboard — aggregated stats for the admin dashboard
app.get('/make-server-e07959ec/admin/dashboard', requireAuth, async (c) => {
  try {
    // Fetch all data sources in parallel
    const [
      toolsRes,
      projectsRes,
      purchasesRes,
      kvLeads,
      messages,
    ] = await Promise.all([
      supabase.from('tools').select('id, name, category, slug'),
      supabase.from('projects').select('id, title, category, created_at'),
      supabase
        .from('user_purchases')
        .select('id, amount, currency, status, product_name, variant_name, purchased_at, lemon_squeezy_order_id')
        .order('purchased_at', { ascending: false }),
      kv.getByPrefix('lead:free:log:'),
      kv.getByPrefix('msg:'),
    ]);

    const tools     = toolsRes.data     || [];
    const projects  = projectsRes.data  || [];
    const purchases = purchasesRes.data || [];

    if (purchasesRes.error) {
      console.log('[admin/dashboard] Warning fetching purchases:', purchasesRes.error.message);
    }

    // Fetch registered users
    let signupUsers: any[] = [];
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    signupUsers = usersData?.users || [];

    // ── Revenue calculations ──────────────────────────────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

    const activePurchases   = purchases.filter((p: any) => p.status !== 'refunded');
    const refundedPurchases = purchases.filter((p: any) => p.status === 'refunded');

    const totalRevenue  = activePurchases.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const revenue30d    = activePurchases
      .filter((p: any) => new Date(p.purchased_at || 0) >= thirtyDaysAgo)
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const revenue7d     = activePurchases
      .filter((p: any) => new Date(p.purchased_at || 0) >= sevenDaysAgo)
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const totalRefunded = refundedPurchases.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

    // ── Revenue by product ────────────────────────────────────────────────────
    const revenueByProduct: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const p of activePurchases as any[]) {
      const key = p.product_name || 'Unknown';
      if (!revenueByProduct[key]) revenueByProduct[key] = { name: key, revenue: 0, sales: 0 };
      revenueByProduct[key].revenue += parseFloat(p.amount) || 0;
      revenueByProduct[key].sales++;
    }
    const revenueByProductArr = Object.values(revenueByProduct)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map(r => ({ ...r, revenue: parseFloat(r.revenue.toFixed(2)) }));

    // ── Revenue by tier ───────────────────────────────────────────────────────
    const revenueByTier: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const p of activePurchases as any[]) {
      const key = p.variant_name || 'Unknown';
      if (!revenueByTier[key]) revenueByTier[key] = { name: key, revenue: 0, sales: 0 };
      revenueByTier[key].revenue += parseFloat(p.amount) || 0;
      revenueByTier[key].sales++;
    }
    const revenueByTierArr = Object.values(revenueByTier)
      .sort((a, b) => b.revenue - a.revenue)
      .map(r => ({ ...r, revenue: parseFloat(r.revenue.toFixed(2)) }));

    // ── Time series: last 30 days ─────────────────────────────────────────────
    const days = 30;
    const series: { date: string; downloads: number; signups: number; messages: number; revenue: number; sales: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const downloads    = (kvLeads   as any[]).filter(l => (l.downloadedAt || '').startsWith(dateStr)).length;
      const signups      = signupUsers.filter((u: any)  => (u.created_at   || '').startsWith(dateStr)).length;
      const msgs         = (messages  as any[]).filter(m => (m.createdAt   || '').startsWith(dateStr)).length;
      const dayPurchases = activePurchases.filter((p: any) => (p.purchased_at || '').startsWith(dateStr));
      const revenue      = parseFloat(dayPurchases.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0).toFixed(2));
      const sales        = dayPurchases.length;

      series.push({ date: dateStr, downloads, signups, messages: msgs, revenue, sales });
    }

    // ── Top tools by download count ──────────────────────────────────────────
    const toolCountMap: Record<string, { name: string; category: string; slug: string; count: number }> = {};
    for (const lead of kvLeads as any[]) {
      const key = lead.toolSlug || lead.toolName || 'Unknown';
      if (!toolCountMap[key]) toolCountMap[key] = { name: lead.toolName || key, category: '', slug: key, count: 0 };
      toolCountMap[key].count++;
    }
    for (const t of tools as any[]) {
      const key = t.slug || t.name;
      if (toolCountMap[key]) toolCountMap[key].category = t.category || '';
    }
    const topTools = Object.values(toolCountMap).sort((a, b) => b.count - a.count).slice(0, 8);

    // ── Lead sources for pie chart ──
    const leadSources = [
      { name: 'Free Downloads', value: kvLeads.length },
      { name: 'Sign-ups',       value: signupUsers.length },
    ];

    // ── Downloads by tool ──
    const downloadsByTool = Object.values(toolCountMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(t => ({ name: t.name.length > 14 ? t.name.substring(0, 14) + '…' : t.name, count: t.count }));

    // ── 30-day lead stats ──
    const newLeads30d    = (kvLeads as any[]).filter(l => new Date(l.downloadedAt || 0) >= thirtyDaysAgo).length;
    const newSignups30d  = signupUsers.filter((u: any) => new Date(u.created_at || 0) >= thirtyDaysAgo).length;
    const unreadMessages = (messages as any[]).filter(m => !m.read).length;

    // ── Recent activity (downloads + signups + purchases) ────────────────────
    const recentLeads = [...kvLeads as any[]]
      .sort((a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime())
      .slice(0, 8)
      .map(l => ({ ...l, activityType: 'download' }));

    const recentSignups = [...signupUsers]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5)
      .map((u: any) => ({
        email: u.email,
        displayName: u.user_metadata?.full_name || '',
        createdAt: u.created_at,
        activityType: 'signup',
      }));

    const recentPurchaseActivity = [...activePurchases]
      .slice(0, 8)
      .map((p: any) => ({
        email: '',
        productName: p.product_name || '',
        variantName: p.variant_name || '',
        amount: parseFloat(p.amount) || 0,
        currency: p.currency || 'USD',
        createdAt: p.purchased_at,
        activityType: 'purchase',
      }));

    const recentMessages = [...messages as any[]]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);

    const activity = [...recentLeads, ...recentSignups, ...recentPurchaseActivity]
      .sort((a, b) => {
        const ta = new Date(a.downloadedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.downloadedAt || b.createdAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 15);

    return c.json({
      success: true,
      data: {
        stats: {
          totalLeads:    kvLeads.length + signupUsers.length,
          freeDownloads: kvLeads.length,
          signups:       signupUsers.length,
          totalTools:    tools.length,
          totalProjects: projects.length,
          totalMessages: messages.length,
          unreadMessages,
          newLeads30d:   newLeads30d + newSignups30d,
          totalRevenue:  parseFloat(totalRevenue.toFixed(2)),
          revenue30d:    parseFloat(revenue30d.toFixed(2)),
          revenue7d:     parseFloat(revenue7d.toFixed(2)),
          totalSales:    activePurchases.length,
          totalRefunded: parseFloat(totalRefunded.toFixed(2)),
          refundCount:   refundedPurchases.length,
        },
        series,
        topTools,
        downloadsByTool,
        leadSources,
        revenueByProduct: revenueByProductArr,
        revenueByTier:    revenueByTierArr,
        recentMessages,
        recentPurchases:  activePurchases.slice(0, 10),
        activity,
      },
    });
  } catch (error) {
    console.log('[admin/dashboard] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== DATA INITIALIZATION ENDPOINT ==========

// Public init endpoint for seeding sample data (no auth required)
app.post("/make-server-e07959ec/init", async (c) => {
  try {
    const body = await c.req.json();
    const { projects = [], tools = [], team = [] } = body;

    const counts = { projects: 0, tools: 0, team: 0, versions: 0, settings: 0 };
    const errors: string[] = [];

    console.log(`🌱 Init: seeding ${projects.length} projects, ${tools.length} tools, ${team.length} team members`);

    // ── 1. Clear existing data (FK order: versions before tools) ──────────────
    const { error: delVersionsErr } = await supabase.from('tool_versions').delete().not('id', 'is', null);
    if (delVersionsErr) console.log('Warn clearing tool_versions:', delVersionsErr.message);

    const { error: delToolsErr } = await supabase.from('tools').delete().not('id', 'is', null);
    if (delToolsErr) console.log('Warn clearing tools:', delToolsErr.message);

    const { error: delProjectsErr } = await supabase.from('projects').delete().not('id', 'is', null);
    if (delProjectsErr) console.log('Warn clearing projects:', delProjectsErr.message);

    const { error: delTeamErr } = await supabase.from('team_members').delete().not('id', 'is', null);
    if (delTeamErr) console.log('Warn clearing team_members:', delTeamErr.message);

    // ── 2. Insert projects ────────────────────────────────────────────────────
    for (const project of projects) {
      const { id: _id, ...rest } = project;
      const dbRow = toDbRow(rest);
      const { error } = await supabase.from('projects').insert(dbRow);
      if (error) {
        console.log(`Error inserting project "${project.title}": ${error.message}`);
        errors.push(`Project "${project.title}": ${error.message}`);
      } else {
        counts.projects++;
      }
    }

    // ── 3. Insert tools (with versions) ──────────────────────────────────────
    for (const tool of tools) {
      const { versions, id: _id, howItWorks: _hiw, systemRequirements: _sr, tagline: _tl, demoUrl: toolDemoUrl, ...toolRest } = tool;

      // Fold demoUrl into faqs as a hidden 🎬 entry so it survives the DB
      const toolFaqs = [
        ...(toolDemoUrl ? [{ question: '🎬', answer: toolDemoUrl }] : []),
        ...(toolRest.faqs ?? []),
      ];
      const toolDbRow = toDbRow({ ...toolRest, faqs: toolFaqs });

      const { data: toolData, error: toolError } = await supabase
        .from('tools')
        .insert(toolDbRow)
        .select()
        .single();

      if (toolError) {
        console.log(`Error inserting tool "${tool.name}": ${toolError.message}`);
        errors.push(`Tool "${tool.name}": ${toolError.message}`);
        continue;
      }

      counts.tools++;

      // Insert versions for this tool
      if (versions && Array.isArray(versions) && versions.length > 0) {
        const versionsDbRows = versions.map((v: any) => {
          // Strip frontend-only / non-standard columns that may not exist in
          // the tool_versions table (demoUrl, whatsIncluded) before toDbRow.
          const {
            id: _vId,
            demoUrl: _demoUrl,
            whatsIncluded: _whatsIncluded,
            pricingModel: _pm,
            lifetimePrice: _lp,
            monthlyPrice: _mp,
            yearlyPrice: _yp,
            ...vRest
          } = v;

          // Fold pricing info as the first feature line (pipe-delimited, unambiguous):
          //   Free version    → "Free"
          //   Subscription    → "subscription|<monthly>|<yearly>"
          //   Lifetime        → "lifetime|<price>"
          const priceSentinel =
            v.versionType === 'Free'
              ? 'Free'
              : v.pricingModel === 'subscription'
              ? `subscription|${v.monthlyPrice ?? ''}|${v.yearlyPrice ?? ''}`
              : `lifetime|${v.lifetimePrice ?? ''}`;

          // demoUrl now lives at the tool level — only fold price into features
          const enrichedFeatures = [
            ...(priceSentinel ? [`💰 ${priceSentinel}`] : []),
            ...(v.features ?? []),
          ];

          return {
            ...toDbRow(vRest),
            features: enrichedFeatures,
            tool_id: toolData.id,
          };
        });

        const { error: vError } = await supabase.from('tool_versions').insert(versionsDbRows);
        if (vError) {
          console.log(`Error inserting versions for tool "${tool.name}": ${vError.message}`);
          errors.push(`Versions for "${tool.name}": ${vError.message}`);
        } else {
          counts.versions += versions.length;
        }
      }
    }

    // ── 4. Insert team members ────────────────────────────────────────────────
    for (const member of team) {
      const { id: _id, ...rest } = member;
      const dbRow = toDbRow(rest);
      const { error } = await supabase.from('team_members').insert(dbRow);
      if (error) {
        console.log(`Error inserting team member "${member.name}": ${error.message}`);
        errors.push(`Team "${member.name}": ${error.message}`);
      } else {
        counts.team++;
      }
    }

    // ── 5. Seed default site settings ────────────────────────────────────────
    const defaultSettings = [
      {
        key: 'showreelUrl',
        value: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        updated_at: new Date().toISOString(),
      },
      {
        key: 'projectCategories',
        value: ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Product', 'Brand', 'Social', 'Campaign', 'Other'],
        updated_at: new Date().toISOString(),
      },
      {
        key: 'toolCategories',
        value: ['Automation', 'Animation', 'Workflow', 'Effects', 'Plugins'],
        updated_at: new Date().toISOString(),
      },
      {
        key: 'toolStatuses',
        value: [
          { label: 'New',     color: 'green'  },
          { label: 'Popular', color: 'purple' },
          { label: 'Pro',     color: 'amber'  },
          { label: 'Free',    color: 'cyan'   },
        ],
        updated_at: new Date().toISOString(),
      },
      {
        key: 'socialLinks',
        value: {
          linkedin: 'https://linkedin.com/company/fastoosh',
          instagram: 'https://instagram.com/fastoosh',
          twitter: '',
          dribbble: '',
          behance: '',
          tiktok: '',
        },
        updated_at: new Date().toISOString(),
      },
    ];

    for (const setting of defaultSettings) {
      const { error } = await supabase
        .from('site_settings')
        .upsert(setting, { onConflict: 'key' });
      if (error) {
        console.log(`Error seeding setting "${setting.key}": ${error.message}`);
      } else {
        counts.settings++;
      }
    }

    console.log(`✅ Init complete:`, counts);

    return c.json({
      success: true,
      counts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.log(`Error in /init: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== SEO ENDPOINTS ==========

// Convert pageKey (e.g. "tool--my-slug") → KV key (e.g. "seo:tool:my-slug")
const toSeoKvKey = (pageKey: string) => `seo:${pageKey.replace(/--/g, ':')}`;

// GET /seo/:pageKey — public
app.get('/make-server-e07959ec/seo/:pageKey', async (c) => {
  try {
    const pageKey = c.req.param('pageKey');
    const data = await kv.get(toSeoKvKey(pageKey));
    return c.json({ success: true, data: data || null });
  } catch (error) {
    console.log(`[seo] GET error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// PUT /seo/:pageKey — admin only
app.put('/make-server-e07959ec/seo/:pageKey', requireAuth, async (c) => {
  try {
    const pageKey = c.req.param('pageKey');
    const body = await c.req.json();
    const seoData = {
      title:              body.title              || '',
      description:        body.description        || '',
      keywords:           body.keywords           || '',
      ogTitle:            body.ogTitle            || '',
      ogDescription:      body.ogDescription      || '',
      ogImage:            body.ogImage            || '',
      twitterCard:        body.twitterCard        || 'summary_large_image',
      twitterTitle:       body.twitterTitle       || '',
      twitterDescription: body.twitterDescription || '',
      canonicalUrl:       body.canonicalUrl       || '',
      noIndex:            body.noIndex            || false,
      updatedAt:          new Date().toISOString(),
    };
    await kv.set(toSeoKvKey(pageKey), seoData);
    console.log(`[seo] Saved SEO for "${pageKey}"`);
    return c.json({ success: true, data: seoData });
  } catch (error) {
    console.log(`[seo] PUT error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /admin/generate-seo-content — admin only, Gemini AI
app.post('/make-server-e07959ec/admin/generate-seo-content', requireAuth, async (c) => {
  try {
    const { pageName, pageType, pageContext, existingSeo, instruction = '', improveExisting = false } = await c.req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!pageName) return c.json({ success: false, error: 'pageName is required' }, 400);

    const gen: Record<string, boolean> = {};
    if (improveExisting || !existingSeo?.title?.trim())              gen.title              = true;
    if (improveExisting || !existingSeo?.description?.trim())        gen.description        = true;
    if (improveExisting || !existingSeo?.keywords?.trim())           gen.keywords           = true;
    if (improveExisting || !existingSeo?.ogTitle?.trim())            gen.ogTitle            = true;
    if (improveExisting || !existingSeo?.ogDescription?.trim())      gen.ogDescription      = true;
    if (improveExisting || !existingSeo?.twitterTitle?.trim())       gen.twitterTitle       = true;
    if (improveExisting || !existingSeo?.twitterDescription?.trim()) gen.twitterDescription = true;

    if (!Object.values(gen).some(Boolean)) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const contextLine     = pageContext?.trim()  ? `\nPage context: "${pageContext.trim()}"` : '';
    const existingCtx = improveExisting && existingSeo ? [
      existingSeo.title?.trim()       ? `Current title: "${existingSeo.title.trim()}"` : '',
      existingSeo.description?.trim() ? `Current description: "${existingSeo.description.trim()}"` : '',
    ].filter(Boolean).join('\n') : '';

    let schemaLines = '';
    if (gen.title)              schemaLines += `  "title": "<SEO title max 60 chars, includes Fastoosh brand>",\n`;
    if (gen.description)        schemaLines += `  "description": "<Meta description 120-160 chars, compelling>",\n`;
    if (gen.keywords)           schemaLines += `  "keywords": "<comma-separated keywords, 6-10 terms>",\n`;
    if (gen.ogTitle)            schemaLines += `  "ogTitle": "<OG title for social sharing, max 60 chars>",\n`;
    if (gen.ogDescription)      schemaLines += `  "ogDescription": "<OG description for social, max 200 chars>",\n`;
    if (gen.twitterTitle)       schemaLines += `  "twitterTitle": "<Twitter title, max 70 chars>",\n`;
    if (gen.twitterDescription) schemaLines += `  "twitterDescription": "<Twitter description, max 200 chars>",\n`;

    const modeInstruction = improveExisting
      ? 'REWRITE and IMPROVE the existing SEO metadata. Make it more compelling and search-optimized.'
      : 'Generate professional SEO metadata for this page.';

    const prompt = `You are an SEO expert for Fastoosh, a premium motion design studio creating After Effects plugins and tools for professional motion designers.

${modeInstruction} Return ONLY valid JSON — no markdown fences, no extra text.

Page: "${pageName}"
Page Type: "${pageType || 'static'}"${contextLine}${instructionLine}${existingCtx ? '\n' + existingCtx : ''}

Rules:
- title: Include "Fastoosh" brand name, max 60 chars, page-specific
- description: 120-160 chars, value proposition + primary keywords
- keywords: 6-10 relevant terms, comma-separated
- ogTitle: Optimized for social, max 60 chars
- ogDescription: Engaging for social, max 200 chars
- twitterTitle: max 70 chars
- twitterDescription: max 200 chars
- Target: motion designers, VFX artists, After Effects users
- Be specific to "${pageName}" — no generic filler
${improveExisting ? '- REWRITE mode: elevate existing copy, do not repeat verbatim\n' : ''}
Return exactly this JSON:
{
${schemaLines}}`;

    console.log(`[seo] Gemini call for "${pageName}" [${improveExisting ? 'REWRITE' : 'FILL'}] fields: ${Object.keys(gen).join(', ')}`);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('[seo] JSON repair failed. Raw (first 300):', rawText.substring(0, 300));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ SEO generated for "${pageName}"`);
    return c.json({ success: true, data: generated });
  } catch (error) {
    console.log('[seo] generate-seo-content error:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== HOME CONTENT ==========

// GET /home-content — public
app.get('/make-server-e07959ec/home-content', async (c) => {
  try {
    const raw = await kv.get('home_content');
    // kv may return a JSON string (stored via JSON.stringify) or an already-parsed object
    let parsed: any = null;
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
      } else {
        parsed = raw; // already an object returned by kv
      }
    }
    return c.json({ success: true, data: parsed });
  } catch (error) {
    console.log('[home-content GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// PUT /home-content — admin only
app.put('/make-server-e07959ec/home-content', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    await kv.set('home_content', JSON.stringify(body));
    console.log('✅ Home content saved');
    return c.json({ success: true });
  } catch (error) {
    console.log('[home-content PUT] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /admin/generate-home-content — admin only, AI generation
app.post('/make-server-e07959ec/admin/generate-home-content', requireAuth, async (c) => {
  try {
    const { section = 'all', existingContent = {}, instruction = '', improveExisting = false } = await c.req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const instructionLine = instruction?.trim() ? `\nExtra instruction: "${instruction.trim()}"` : '';
    const modeInstruction = improveExisting ? 'REWRITE/IMPROVE the existing content.' : 'Generate fresh content for the following section(s).';

    const sectionGuides: Record<string, string> = {
      hero: `Return JSON with: heroLine1 (main heading — no gradient), heroLine2 (second line with gradient color — catchy), heroSubtitle (1-2 sentence value prop), heroCta1Text (primary CTA ~3 words), heroCta2Text (secondary CTA ~3 words).`,
      testimonial: `Return JSON with: testimonialQuote (compelling 1-2 sentence client quote), testimonialAuthor (realistic full name), testimonialRole (job title + company e.g. "Head of Marketing at TechCorp").`,
      featured: `Return JSON with: featuredHeading (e.g. "Featured work"), featuredSubtitle (1 sentence about curated selection).`,
      capabilities: `Return JSON with: capabilitiesHeading (e.g. "Why work with us"), capabilities (array of 3 objects, each: { icon: one of [sparkles|zap|target|star|shield|trending-up|award|heart|layers|globe], title: 2-3 words, description: 1-2 sentences }).`,
      process: `Return JSON with: processHeading (e.g. "Our process"), processSubtitle (1 sentence), processSteps (array of 4 objects: { number: "01"|"02"|"03"|"04", title: string, description: 1 sentence }).`,
      turnaround: `Return JSON with: turnaroundRows (array of 4 objects: { label: string e.g. "Short-form video", time: string e.g. "1-2 weeks" }), turnaroundNote (short e.g. "Rush options available").`,
      deliverables: `Return JSON with: deliverablesTitle (e.g. "What you get"), deliverables (array of 5-7 concise deliverable strings).`,
      cta: `Return JSON with: ctaHeading (e.g. "Ready to create something"), ctaHeadingGradient (1 dramatic word/phrase e.g. "extraordinary?"), ctaSubtitle (1-2 warm sentences), ctaBadges (array of 3 short trust signals e.g. ["✓ Reply in 24-48h","✓ NDA-friendly","✓ Remote worldwide"]).`,
    };

    const sectionsToGenerate = section === 'all' ? Object.keys(sectionGuides) : [section];
    const guideText = sectionsToGenerate.map(s => sectionGuides[s] || '').filter(Boolean).join('\n\n');
    const existingCtx = improveExisting && Object.keys(existingContent).length > 0
      ? `\nExisting content:\n${JSON.stringify(existingContent, null, 2)}`
      : '';

    const prompt = `You are a premium copywriter for Fastoosh, a high-end motion design studio that creates animations, After Effects tools, and visual storytelling for ambitious brands worldwide.

${modeInstruction}

Tone: Premium, confident, creative, modern. Not salesy. Short sentences. No clichés.${instructionLine}${existingCtx}

Generate all sections below and merge into ONE flat JSON object:

${guideText}

RULES: Return ONLY valid JSON, no markdown, no explanation. All strings concise and professional.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 3000 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      generated = JSON.parse(repairJson(rawText));
    } catch (parseErr) {
      console.log('[home-content AI] JSON parse failed. Raw:', rawText.substring(0, 500));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Home content generated (section: ${section})`);
    return c.json({ success: true, data: generated });
  } catch (error) {
    console.log('[home-content AI] error:', error);
    return c.json({ success: false, error: `Generation failed: ${String(error)}` }, 500);
  }
});

// POST /admin/generate-seo-jsonld — admin only, generates JSON-LD structured data
app.post('/make-server-e07959ec/admin/generate-seo-jsonld', requireAuth, async (c) => {
  try {
    const { pageName, pageType, pageContext, siteUrl, existingJsonLd, instruction = '', improveExisting = false } = await c.req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!pageName) return c.json({ success: false, error: 'pageName is required' }, 400);

    if (!improveExisting && existingJsonLd?.trim()) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const contextLine     = pageContext?.trim()  ? `\nPage context: "${pageContext.trim()}"` : '';
    const siteUrlLine     = siteUrl?.trim()       ? `\nSite URL: "${siteUrl.trim()}"` : '';
    const modeInstruction = improveExisting
      ? 'REWRITE and IMPROVE the existing JSON-LD.'
      : 'Generate JSON-LD structured data for this page.';

    // Build schema guidance based on page type
    let schemaGuidance = '';
    if (pageType === 'tool') {
      schemaGuidance = `Use "@type": "SoftwareApplication" with applicationCategory "MultimediaApplication", operatingSystem, offers (with price if known), description, name, and url. Include "softwareVersion" if relevant.`;
    } else if (pageType === 'project') {
      schemaGuidance = `Use "@type": "CreativeWork" with name, description, creator (Fastoosh), dateCreated, and genre (e.g. "Motion Design").`;
    } else if (pageName.toLowerCase() === 'home') {
      schemaGuidance = `Use "@type": "Organization" with name "Fastoosh", description, url, logo, sameAs (social links array placeholder), and contactPoint.`;
    } else {
      schemaGuidance = `Use "@type": "WebPage" with name, description, url, and publisher (Fastoosh Organization).`;
    }

    const existingCtx = improveExisting && existingJsonLd?.trim()
      ? `\nExisting JSON-LD:\n${existingJsonLd.trim()}`
      : '';

    const prompt = `You are an SEO expert generating JSON-LD structured data for Fastoosh, a premium motion design studio.

${modeInstruction} Return ONLY the raw JSON-LD object — no markdown fences, no extra text, no @context wrapper (include @context inside the object).

Page: "${pageName}"
Page Type: "${pageType || 'static'}"${siteUrlLine}${contextLine}${instructionLine}${existingCtx}

Schema guidance: ${schemaGuidance}

Rules:
- Include "@context": "https://schema.org"
- Fill in realistic values based on the page context
- Use the siteUrl to construct page URLs if provided
- For Fastoosh as publisher/creator: use name "Fastoosh", url from siteUrl if available
- Keep it concise but complete — no placeholder <values>, use real data from context or sensible defaults
- Return valid JSON only`;

    console.log(`[seo-jsonld] Gemini call for "${pageName}" [${pageType}] ${improveExisting ? 'REWRITE' : 'GENERATE'}`);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.5, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('[seo-jsonld] JSON repair failed. Raw (first 300):', rawText.substring(0, 300));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ JSON-LD generated for "${pageName}"`);
    return c.json({ success: true, data: { structuredData: JSON.stringify(generated, null, 2) } });
  } catch (error) {
    console.log('[seo-jsonld] error:', error);
    return c.json({ success: false, error: `JSON-LD generation failed: ${String(error)}` }, 500);
  }
});

// ========== TOOL REVIEWS ==========

// GET /reviews?toolId=xxx — public: list all reviews for a tool
app.get('/make-server-e07959ec/reviews', async (c) => {
  const toolId = c.req.query('toolId');
  if (!toolId) return c.json({ success: false, error: 'toolId query param required' }, 400);
  try {
    const reviews: any[] = await kv.getByPrefix(`review:${toolId}:`);
    const cleaned = reviews
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ success: true, data: cleaned });
  } catch (error) {
    console.log('[reviews GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /tools-ratings — public: aggregate avg rating + count per toolId
app.get('/make-server-e07959ec/tools-ratings', async (c) => {
  try {
    const allReviews: any[] = await kv.getByPrefix('review:');
    const ratings: Record<string, { avg: number; count: number }> = {};
    for (const review of allReviews.filter(Boolean)) {
      if (!review?.toolId || !review?.rating) continue;
      if (!ratings[review.toolId]) ratings[review.toolId] = { avg: 0, count: 0 };
      ratings[review.toolId].count++;
      ratings[review.toolId].avg += review.rating;
    }
    for (const toolId in ratings) {
      ratings[toolId].avg = Math.round((ratings[toolId].avg / ratings[toolId].count) * 10) / 10;
    }
    return c.json({ success: true, data: ratings });
  } catch (error) {
    console.log('[tools-ratings] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /user/reviews — authenticated: all purchased tools + user's review for each
app.get('/make-server-e07959ec/user/reviews', requireUserAuth, async (c) => {
  const user = c.get('user');
  try {
    const { data: purchases, error: pErr } = await supabase
      .from('user_purchases')
      .select('tool_version_id, tool_versions!inner(tool_id, tools!inner(id, name, slug, image_url))')
      .eq('user_id', user.id);
    if (pErr) {
      console.log('[user/reviews] purchases error:', pErr.message);
      return c.json({ success: false, error: pErr.message }, 500);
    }
    // De-dup by tool_id
    const toolMap: Record<string, { name: string; slug: string; imageUrl: string }> = {};
    for (const p of (purchases || [])) {
      const tv = (p as any).tool_versions;
      if (tv?.tool_id && tv?.tools) {
        toolMap[tv.tool_id] = {
          name: tv.tools.name || '',
          slug: tv.tools.slug || '',
          imageUrl: tv.tools.image_url || '',
        };
      }
    }
    const toolIds = Object.keys(toolMap);
    const reviewResults = await Promise.all(
      toolIds.map(toolId => kv.get(`review:${toolId}:${user.id}`))
    );
    const result = reviewResults.map((review, i) => ({
      toolId: toolIds[i],
      toolName: toolMap[toolIds[i]].name,
      toolSlug: toolMap[toolIds[i]].slug,
      toolImageUrl: toolMap[toolIds[i]].imageUrl,
      review: review || null,
    }));
    return c.json({ success: true, data: result });
  } catch (error) {
    console.log('[user/reviews] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /reviews — authenticated: create or update own review
app.post('/make-server-e07959ec/reviews', requireUserAuth, async (c) => {
  const user = c.get('user');
  try {
    const { toolId, rating, comment } = await c.req.json();
    if (!toolId) return c.json({ success: false, error: 'toolId is required' }, 400);
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5)
      return c.json({ success: false, error: 'rating must be 1–5' }, 400);

    // Verify user has purchased this tool
    const { data: toolVersions, error: tvErr } = await supabase
      .from('tool_versions').select('id').eq('tool_id', toolId);
    if (tvErr) return c.json({ success: false, error: tvErr.message }, 500);
    const versionIds = (toolVersions || []).map((v: any) => v.id);
    if (versionIds.length === 0) return c.json({ success: false, error: 'Tool not found' }, 404);

    // Primary check: match by tool_version_id (set when checkout had custom_data.tool_version_id)
    let hasPurchase = false;
    const { data: byVersion, error: pErr } = await supabase
      .from('user_purchases').select('id')
      .eq('user_id', user.id).in('tool_version_id', versionIds);
    if (pErr) return c.json({ success: false, error: pErr.message }, 500);
    hasPurchase = !!(byVersion && byVersion.length > 0);

    // Fallback: match by product_name — handles purchases where tool_version_id was NULL
    // (e.g. webhook received before the version ID was wired into the checkout link)
    if (!hasPurchase) {
      const { data: toolRow } = await supabase
        .from('tools').select('name').eq('id', toolId).maybeSingle();
      if (toolRow?.name) {
        const { data: byName } = await supabase
          .from('user_purchases').select('id')
          .eq('user_id', user.id)
          .ilike('product_name', toolRow.name);
        hasPurchase = !!(byName && byName.length > 0);
        if (hasPurchase)
          console.log(`[reviews POST] ✅ Purchase verified by product_name fallback: "${toolRow.name}"`);
      }
    }

    if (!hasPurchase)
      return c.json({ success: false, error: 'You must purchase this tool to leave a review' }, 403);

    const reviewKey = `review:${toolId}:${user.id}`;
    const existing: any = await kv.get(reviewKey);
    const now = new Date().toISOString();
    const review = {
      id: existing?.id || crypto.randomUUID(),
      toolId,
      userId: user.id,
      userName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
      rating: ratingNum,
      comment: (comment || '').trim(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await kv.set(reviewKey, review);
    console.log(`[reviews POST] ✅ Saved: tool=${toolId} user=${user.id} rating=${ratingNum}`);
    return c.json({ success: true, data: review });
  } catch (error) {
    console.log('[reviews POST] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── ADMIN REVIEW ENDPOINTS (requireAuth = X-Admin-Token) ──────────────────────

// GET /admin/reviews — list every review stored in KV (real + fake)
app.get('/make-server-e07959ec/admin/reviews', requireAuth, async (c) => {
  try {
    const all = await kv.getByPrefix('review:');
    const reviews = (all || []).filter(Boolean);
    console.log(`[admin/reviews GET] returning ${reviews.length} reviews`);
    return c.json({ success: true, data: reviews });
  } catch (error) {
    console.log('[admin/reviews GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /admin/reviews — create or update a fake review (no purchase check)
app.post('/make-server-e07959ec/admin/reviews', requireAuth, async (c) => {
  try {
    const { toolId, userId: existingUserId, userName, rating, comment, createdAt } = await c.req.json();
    if (!toolId) return c.json({ success: false, error: 'toolId is required' }, 400);
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5)
      return c.json({ success: false, error: 'rating must be 1–5' }, 400);

    const { data: toolRow } = await supabase.from('tools').select('id').eq('id', toolId).maybeSingle();
    if (!toolRow) return c.json({ success: false, error: 'Tool not found' }, 404);

    const now = new Date().toISOString();
    const userId = existingUserId || `admin_${crypto.randomUUID()}`;
    const reviewKey = `review:${toolId}:${userId}`;
    const existing: any = await kv.get(reviewKey);

    const review = {
      id: existing?.id || crypto.randomUUID(),
      toolId,
      userId,
      userName: (userName || 'Anonymous').trim(),
      rating: ratingNum,
      comment: (comment || '').trim(),
      createdAt: createdAt ? new Date(createdAt).toISOString() : (existing?.createdAt || now),
      updatedAt: now,
      isFake: true,
    };
    await kv.set(reviewKey, review);
    console.log(`[admin/reviews POST] ✅ Saved fake review: tool=${toolId} user=${userId} rating=${ratingNum}`);
    return c.json({ success: true, data: review });
  } catch (error) {
    console.log('[admin/reviews POST] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE /admin/reviews — delete any review by toolId + userId
app.delete('/make-server-e07959ec/admin/reviews', requireAuth, async (c) => {
  try {
    const { toolId, userId } = await c.req.json();
    if (!toolId || !userId) return c.json({ success: false, error: 'toolId and userId are required' }, 400);
    const reviewKey = `review:${toolId}:${userId}`;
    const existing = await kv.get(reviewKey);
    if (!existing) return c.json({ success: false, error: 'Review not found' }, 404);
    await kv.del(reviewKey);
    console.log(`[admin/reviews DELETE] ✅ Deleted: tool=${toolId} user=${userId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log('[admin/reviews DELETE] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── END ADMIN REVIEW ENDPOINTS ─────────────────────────────────────────────────

// DELETE /reviews/:toolId — authenticated: delete own review
app.delete('/make-server-e07959ec/reviews/:toolId', requireUserAuth, async (c) => {
  const user = c.get('user');
  const toolId = c.req.param('toolId');
  try {
    const reviewKey = `review:${toolId}:${user.id}`;
    const existing = await kv.get(reviewKey);
    if (!existing) return c.json({ success: false, error: 'Review not found' }, 404);
    await kv.del(reviewKey);
    console.log(`[reviews DELETE] ✅ Deleted: tool=${toolId} user=${user.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log('[reviews DELETE] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);