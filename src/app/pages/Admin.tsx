import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { useNavigate } from 'react-router';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { GlassCard } from '../components/shared/GlassCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { AdminSelect } from '../components/admin/AdminSelect';
import { Plus, Pencil, Trash2, Save, X, LogOut, Upload, Sparkles } from 'lucide-react';
import { AIImproveModal, type AIImproveContext } from '../components/admin/AIImproveModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { ToolFormNew } from '../components/admin/ToolFormNew';
import { LeadsTab } from '../components/admin/LeadsTab';
import { SeoTab } from '../components/admin/SeoTab';
import { HomeTab } from '../components/admin/HomeTab';
import { AdminReviewsTab } from '../components/admin/AdminReviewsTab';
import { DashboardTab } from '../components/admin/DashboardTab';
import { invalidateSiteSettingsCache } from '../components/shared/SeoHead';
import { bustApiCache } from '../utils/api';
import { StyleTab } from '../components/admin/StyleTab';
import { TranslationTab } from '../components/admin/TranslationTab';
import { ReferrersTab } from '../components/admin/ReferrersTab';
import { ResetTab } from '../components/admin/ResetTab';
import { VimeoPicker } from '../components/admin/VimeoPicker';
import { GuideTab } from '../components/admin/GuideTab';
import { LegalTab } from '../components/admin/LegalTab';
import { BroadcastTab } from '../components/admin/BroadcastTab';
import { VideoThumbnailCapture } from '../components/admin/VideoThumbnailCapture';
import { ToolRequestsTab } from '../components/admin/ToolRequestsTab';
import { DraggableProjectCard } from '../components/admin/DraggableProjectCard';
import { DraggableToolCard } from '../components/admin/DraggableToolCard';

import { ScrollingGradientBackground } from '../components/shared/ScrollingGradientBackground';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// Helper function to create URL-friendly slug
const createSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Module-level constant shared by SettingsForm and inline category/status panels
const STATUS_COLOR_OPTIONS = [
  { name: 'purple', label: 'Purple', classes: 'from-purple-500 to-violet-500' },
  { name: 'green',  label: 'Green',  classes: 'from-green-500 to-emerald-500' },
  { name: 'amber',  label: 'Amber',  classes: 'from-yellow-500 to-orange-500' },
  { name: 'cyan',   label: 'Cyan',   classes: 'from-cyan-500 to-blue-400' },
  { name: 'pink',   label: 'Pink',   classes: 'from-pink-500 to-fuchsia-500' },
  { name: 'red',    label: 'Red',    classes: 'from-red-500 to-rose-400' },
];

interface Project {
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

interface Tool {
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
}

interface ToolVersion {
  id: string;
  versionType: 'Free' | 'Pro' | 'Studio';
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
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  imageUrl: string;
  socialLinks: Record<string, string>;
}

interface Settings {
  showreelUrl?: string;
  faviconUrl?: string;
  siteUrl?: string;
  defaultOgImage?: string;
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
}

export function Admin() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [settings, setSettings] = useState<Settings>({
    projectCategories: ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Other'],
    toolCategories: ['Automation', 'Animation', 'Workflow', 'Effects', 'Plugins'],
    toolStatuses: [
      { label: 'New',     color: 'green'  },
      { label: 'Popular', color: 'purple' },
      { label: 'Pro',     color: 'amber'  },
      { label: 'Free',    color: 'cyan'   },
    ],
    socialLinks: {
      linkedin: '',
      instagram: '',
      twitter: '',
      dribbble: '',
      behance: '',
      tiktok: '',
    },
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Inline category / status management (Projects & Tools tabs)
  const [newProjectCat, setNewProjectCat] = useState('');
  const [newToolCat, setNewToolCat] = useState('');
  const [newToolStatusLabel, setNewToolStatusLabel] = useState('');

  // Client logos management (Settings tab)
  const [newLogoName,    setNewLogoName]    = useState('');
  const [newLogoUrl,     setNewLogoUrl]     = useState('');
  const [logoSaving,     setLogoSaving]     = useState(false);
  const [logoUploading,  setLogoUploading]  = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setNewLogoUrl(data.data.url);
      } else {
        console.error('Logo upload failed:', data.error);
      }
    } catch (e) {
      console.error('Logo upload error:', e);
    } finally {
      setLogoUploading(false);
    }
  };
  const [newToolStatusColor, setNewToolStatusColor] = useState('purple');
  const [catSaving, setCatSaving] = useState(false);

  // Editing states
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editingTeamMember, setEditingTeamMember] = useState<TeamMember | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (attempt = 0) => {
    try {
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        navigate('/admin/login');
        return;
      }

      // Validate the token against the server — don't trust localStorage alone.
      // Authorization carries the anon key (required by Supabase gateway).
      // X-Admin-Token carries our UUID session (validated by requireAuth in KV).
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Only wipe the token on explicit auth rejections (401 / 403).
        // A 5xx means the server is temporarily broken — preserve the session.
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('admin_token');
          navigate('/admin/login');
        } else if (attempt < 1) {
          setTimeout(() => checkAuth(attempt + 1), 2000);
        } else {
          setNetworkError(true);
          setAuthChecking(false);
        }
        return;
      }

      setNetworkError(false);
      setAuthChecking(false);
      loadData();
    } catch (error) {
      // Network-level failure (edge function cold-start, brief redeployment, etc.)
      // Do NOT clear the token — the session may still be valid once the server recovers.
      if (attempt < 1) {
        setTimeout(() => checkAuth(attempt + 1), 2000);
      } else {
        setNetworkError(true);
        setAuthChecking(false);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        // Fire-and-forget: invalidate server-side KV session
        fetch(`${API_BASE}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Admin-Token': token,
          },
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('admin_token');
      navigate('/admin/login');
    }
  };

  const loadData = async (attempt = 0) => {
    setLoading(true);
    setLoadError(false);
    try {
      const headers = { Authorization: `Bearer ${publicAnonKey}` };
      const [projectsRes, toolsRes, teamRes, settingsRes] = await Promise.allSettled([
        fetchWithRetry(`${API_BASE}/projects`, { headers }, 2),
        fetchWithRetry(`${API_BASE}/tools`,    { headers }, 2),
        fetchWithRetry(`${API_BASE}/team`,     { headers }, 2),
        fetchWithRetry(`${API_BASE}/settings`, { headers }, 2),
      ]);

      const safeJson = async (r: PromiseSettledResult<Response>) => {
        if (r.status === 'rejected') return {};
        try { return await r.value.json(); } catch { return {}; }
      };

      const [projectsData, toolsData, teamData, settingsData] = await Promise.all([
        safeJson(projectsRes),
        safeJson(toolsRes),
        safeJson(teamRes),
        safeJson(settingsRes),
      ]);

      setProjects(projectsData.data || []);
      setTools(toolsData.data || []);
      setTeam(teamData.data || []);
      const serverSettings = settingsData.data || {};
      // NOTE: Admin never applies the site style to itself — only the public Layout does.
      // Applying it here would overwrite the admin panel's own fixed purple/dark theme.
      setSettings({
        projectCategories: ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Other'],
        toolCategories: ['Automation', 'Animation', 'Workflow', 'Effects', 'Plugins'],
        toolStatuses: [
          { label: 'New',     color: 'green'  },
          { label: 'Popular', color: 'purple' },
          { label: 'Pro',     color: 'amber'  },
          { label: 'Free',    color: 'cyan'   },
        ],
        ...serverSettings,
        // Merge socialLinks deeply so partial server data doesn't wipe defaults
        socialLinks: {
          linkedin: '',
          instagram: '',
          twitter: '',
          dribbble: '',
          behance: '',
          tiktok: '',
          ...(serverSettings.socialLinks || {}),
        },
      });
    } catch (error) {
      console.error('Error loading data:', error);
      if (attempt < 2) {
        setTimeout(() => loadData(attempt + 1), 3000);
        return;
      }
      setLoadError(true);
    }
    setLoading(false);
  };

  const getAuthHeaders = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      'X-Admin-Token': token,
    };
  };

  // ========== PROJECT HANDLERS ==========

  const saveProject = async (project: Project): Promise<{ success: boolean; message: string }> => {
    try {
      // Ensure slug is always set — auto-derive from title if missing
      const projectToSave = {
        ...project,
        slug: project.slug?.trim() || createSlug(project.title),
      };
      
      // Only treat the id as a real DB record when it is an actual UUID.
      // Any temporary stub id (e.g. "project-<ts>") must POST.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isEditing = !!project.id && UUID_RE.test(project.id);
      const url = isEditing ? `${API_BASE}/projects/${project.id}` : `${API_BASE}/projects`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify(projectToSave),
      });

      const result = await response.json();
      
      if (response.status === 401) {
        console.error('Authentication failed - token may have expired');
        localStorage.removeItem('admin_token');
        navigate('/admin/login');
        return { success: false, message: 'Session expired. Please log in again.' };
      }
      
      if (result.success) {
        bustApiCache('projects');
        if (isEditing) bustApiCache(`project:${project.id}`);
        await loadData();
        return { success: true, message: isEditing ? 'Project updated successfully!' : 'Project created successfully!' };
      } else {
        console.error('Error saving project:', result.error);
        return { success: false, message: `Failed to save project: ${result.error}` };
      }
    } catch (error) {
      console.error('Error saving project:', error);
      return { success: false, message: `Error saving project: ${error}` };
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
      });

      const result = await response.json();
      if (result.success) {
        bustApiCache('projects');
        bustApiCache(`project:${id}`);
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const moveProject = useCallback((dragIndex: number, hoverIndex: number) => {
    setProjects((prevProjects) => {
      const newProjects = [...prevProjects];
      const [removed] = newProjects.splice(dragIndex, 1);
      newProjects.splice(hoverIndex, 0, removed);
      return newProjects;
    });
  }, []);

  const reorderProjects = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const projectIds = projects.map(p => p.id);
      
      
      const response = await fetch(`${API_BASE}/projects/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ projectIds }),
      });

      if (!response.ok) {
        console.error('❌ Reorder response not OK:', response.status, response.statusText);
        const text = await response.text();
        console.error('Response body:', text);
        return;
      }

      const result = await response.json();
      if (result.success) {
        bustApiCache('projects');
      } else {
        console.error('❌ Error reordering projects:', result.error);
        alert(`Failed to save order: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error reordering projects:', error);
      alert(`Failed to save order: ${error}`);
    }
  };

  // ========== TOOL HANDLERS ==========

  const saveTool = async (tool: Tool): Promise<{ success: boolean; message: string }> => {
    try {
      
      // Ensure slug is set - auto-generate from name if empty
      const toolToSave = {
        ...tool,
        slug: tool.slug || createSlug(tool.name),
      };
      
      // Only treat the id as a real DB record when it is an actual UUID.
      // Any temporary stub id (e.g. "tool-<ts>") must POST.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isEditing = !!tool.id && UUID_RE.test(tool.id);
      const url = isEditing ? `${API_BASE}/tools/${tool.id}` : `${API_BASE}/tools`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify(toolToSave),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `Error saving tool: HTTP ${response.status} - ${errorText}` };
      }

      const result = await response.json();
      
      if (result.success) {
        bustApiCache('tools');
        if (isEditing) bustApiCache(`tool:${tool.id}`);
        await loadData();
        return { success: true, message: isEditing ? 'Tool updated successfully!' : 'Tool created successfully!' };
      } else {
        console.error('Error saving tool:', result.error);
        return { success: false, message: `Error saving tool: ${result.error || 'Unknown error'}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error saving tool:', error);
      return { success: false, message: `Error saving tool: ${errorMessage}` };
    }
  };

  const deleteTool = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tool?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/tools/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
      });

      const result = await response.json();
      if (result.success) {
        bustApiCache('tools');
        bustApiCache(`tool:${id}`);
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting tool:', error);
    }
  };

  const moveTool = useCallback((dragIndex: number, hoverIndex: number) => {
    setTools((prevTools) => {
      const newTools = [...prevTools];
      const [removed] = newTools.splice(dragIndex, 1);
      newTools.splice(hoverIndex, 0, removed);
      return newTools;
    });
  }, []);

  const reorderTools = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const toolIds = tools.map(t => t.id);
      
      
      const response = await fetch(`${API_BASE}/tools/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ toolIds }),
      });

      if (!response.ok) {
        console.error('❌ Reorder response not OK:', response.status, response.statusText);
        const text = await response.text();
        console.error('Response body:', text);
        return;
      }

      const result = await response.json();
      if (result.success) {
        bustApiCache('tools');
      } else {
        console.error('❌ Reorder failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error reordering tools:', error);
    }
  };

  // ========== TEAM HANDLERS ==========

  const saveTeamMember = async (member: TeamMember): Promise<{ success: boolean; message: string }> => {
    try {
      // Only treat the id as a real DB record when it is an actual UUID.
      // Any temporary stub id (e.g. "member-<ts>", "team-<ts>") must POST.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isEditing = !!member.id && UUID_RE.test(member.id);
      const url = isEditing ? `${API_BASE}/team/${member.id}` : `${API_BASE}/team`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify(member),
      });

      const result = await response.json();
      if (result.success) {
        bustApiCache('team');
        await loadData();
        return { success: true, message: isEditing ? 'Team member updated successfully!' : 'Team member added successfully!' };
      } else {
        console.error('Error saving team member:', result.error);
        return { success: false, message: `Failed to save team member: ${result.error}` };
      }
    } catch (error) {
      console.error('Error saving team member:', error);
      return { success: false, message: `Error saving team member: ${error}` };
    }
  };

  const deleteTeamMember = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/team/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
      });

      const result = await response.json();
      if (result.success) {
        bustApiCache('team');
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting team member:', error);
    }
  };

  // ========== SETTINGS HANDLERS ==========

  const saveSettings = async (settings: Settings) => {
    try {
      // Use PUT if settings has an ID (editing), otherwise POST (creating)
      const isEditing = settings.id;
      const url = isEditing ? `${API_BASE}/settings/${settings.id}` : `${API_BASE}/settings`;
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      const result = await response.json();
      if (result.success) {
        bustApiCache('settings');
        invalidateSiteSettingsCache();
        await loadData();
        setEditingSettings(false);
      } else {
        console.error('Error saving settings:', result.error);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // ========== INLINE CATEGORY / STATUS HANDLERS ==========

  const addProjectCategory = async () => {
    const trimmed = newProjectCat.trim();
    if (!trimmed) return;
    const existing = settings.projectCategories || [];
    if (existing.includes(trimmed)) return;
    setCatSaving(true);
    try { await saveSettings({ ...settings, projectCategories: [...existing, trimmed] }); } catch {}
    setNewProjectCat('');
    setCatSaving(false);
  };

  const removeProjectCategory = async (index: number) => {
    const existing = settings.projectCategories || [];
    setCatSaving(true);
    try { await saveSettings({ ...settings, projectCategories: existing.filter((_, i) => i !== index) }); } catch {}
    setCatSaving(false);
  };

  const addToolCategory = async () => {
    const trimmed = newToolCat.trim();
    if (!trimmed) return;
    const existing = settings.toolCategories || [];
    if (existing.includes(trimmed)) return;
    setCatSaving(true);
    try { await saveSettings({ ...settings, toolCategories: [...existing, trimmed] }); } catch {}
    setNewToolCat('');
    setCatSaving(false);
  };

  const removeToolCategory = async (index: number) => {
    const existing = settings.toolCategories || [];
    setCatSaving(true);
    try { await saveSettings({ ...settings, toolCategories: existing.filter((_, i) => i !== index) }); } catch {}
    setCatSaving(false);
  };

  const addToolStatus = async () => {
    const trimmed = newToolStatusLabel.trim();
    if (!trimmed) return;
    const existing = settings.toolStatuses || [];
    if (existing.some(s => s.label === trimmed)) return;
    setCatSaving(true);
    try { await saveSettings({ ...settings, toolStatuses: [...existing, { label: trimmed, color: newToolStatusColor }] }); } catch {}
    setNewToolStatusLabel('');
    setNewToolStatusColor('purple');
    setCatSaving(false);
  };

  const removeToolStatus = async (index: number) => {
    const existing = settings.toolStatuses || [];
    setCatSaving(true);
    try { await saveSettings({ ...settings, toolStatuses: existing.filter((_, i) => i !== index) }); } catch {}
    setCatSaving(false);
  };

  if (authChecking) {
    return (
      <>
        <ScrollingGradientBackground />
        <div className="min-h-screen bg-black/85 flex items-center justify-center p-6"
          style={{ '--fastoosh-card-bg': 'rgba(255,255,255,0.03)', '--fastoosh-card-dark': 'rgba(0,0,0,0.95)' } as React.CSSProperties}>
          <GlassCard className="p-8">
            <p className="text-white">Checking authentication...</p>
          </GlassCard>
        </div>
      </>
    );
  }

  if (networkError) {
    return (
      <>
        <ScrollingGradientBackground />
        <div className="min-h-screen bg-black/85 flex items-center justify-center p-6"
          style={{ '--fastoosh-card-bg': 'rgba(255,255,255,0.03)', '--fastoosh-card-dark': 'rgba(0,0,0,0.95)' } as React.CSSProperties}>
          <GlassCard className="p-8 text-center max-w-sm">
            <p className="text-red-400 font-semibold mb-2">Connection Error</p>
            <p className="text-white/60 text-sm mb-4">
              Could not reach the server. The service may be starting up — please try again in a moment.
            </p>
            <Button
              onClick={() => { setNetworkError(false); setAuthChecking(true); checkAuth(0); }}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Retry
            </Button>
          </GlassCard>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <ScrollingGradientBackground />
        <div className="min-h-screen bg-black/85 flex items-center justify-center p-6"
          style={{ '--fastoosh-card-bg': 'rgba(255,255,255,0.03)', '--fastoosh-card-dark': 'rgba(0,0,0,0.95)' } as React.CSSProperties}>
          <GlassCard className="p-8 text-center max-w-sm">
            <p className="text-red-400 font-semibold mb-2">Failed to Load Data</p>
            <p className="text-white/60 text-sm mb-4">
              Could not fetch content from the server after several attempts. The service may still be warming up — please try again.
            </p>
            <Button
              onClick={() => loadData(0)}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Retry
            </Button>
          </GlassCard>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <ScrollingGradientBackground />
        <div className="min-h-screen bg-black/85 flex items-center justify-center p-6"
          style={{ '--fastoosh-card-bg': 'rgba(255,255,255,0.03)', '--fastoosh-card-dark': 'rgba(0,0,0,0.95)' } as React.CSSProperties}>
          <GlassCard className="p-8">
            <p className="text-white">Loading admin panel...</p>
          </GlassCard>
        </div>
      </>
    );
  }

  return (
    <>
      <ScrollingGradientBackground />
      <div className="flex min-h-screen"
        style={{ '--fastoosh-card-bg': 'rgba(255,255,255,0.03)', '--fastoosh-card-dark': 'rgba(0,0,0,0.95)' } as React.CSSProperties}>

        {/* ── Fixed left sidebar ── */}
        <div className="w-52 flex-shrink-0 bg-black/60 border-r border-white/8 flex flex-col fixed top-0 left-0 h-screen overflow-y-auto z-10">
          <div className="p-4 space-y-1 flex-1">
            <div className="px-2 pb-4 mb-2 border-b border-white/10">
              <h1 className="text-base font-bold text-white">Admin Panel</h1>
              <p className="text-white/35 text-xs mt-0.5">Fastoosh</p>
            </div>

            {[
              { label: 'Content', items: [
                { value: 'dashboard', label: 'Dashboard' },
                { value: 'projects',  label: 'Projects' },
                { value: 'tools',     label: 'Tools' },
                { value: 'team',      label: 'Team' },
                { value: 'home',      label: 'Home' },
                { value: 'reviews',   label: 'Reviews' },
              ]},
              { label: 'Audience', items: [
                { value: 'leads',     label: 'Leads' },
                { value: 'broadcast', label: '📣 Broadcast' },
                { value: 'messages',  label: '🔧 Tool Requests' },
                { value: 'traffic',   label: '🌐 Traffic' },
              ]},
              { label: 'Site', items: [
                { value: 'seo',          label: 'SEO' },
                { value: 'style',        label: 'Style' },
                { value: 'translations', label: '🌍 Translations' },
                { value: 'guide',        label: '📖 Guide' },
                { value: 'settings',     label: 'Settings' },
                { value: 'legal',        label: '⚖️ Legal' },
              ]},
              { label: 'Danger', items: [
                { value: 'reset', label: '⚠️ Reset', danger: true },
              ]},
            ].map((group: any) => (
              <div key={group.label} className="pb-2">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">{group.label}</p>
                {group.items.map((item: any) => (
                  <button
                    key={item.value}
                    onClick={() => setActiveTab(item.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      activeTab === item.value
                        ? item.danger
                          ? 'bg-red-500/15 text-red-300 font-semibold'
                          : 'bg-purple-500/20 text-purple-200 font-semibold'
                        : item.danger
                          ? 'text-red-400/60 hover:bg-red-500/10 hover:text-red-300'
                          : 'text-white/50 hover:bg-white/6 hover:text-white/80'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Sign out at bottom */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/35 hover:text-red-400 hover:bg-red-500/8 transition-all flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Main content area (offset by sidebar width) ── */}
        <div className="ml-52 flex-1 min-w-0 bg-black/80 min-h-screen">
          <div className="p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">


          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard">
            <DashboardTab onNavigate={setActiveTab} />
          </TabsContent>

          {/* TRAFFIC TAB */}
          <TabsContent value="traffic">
            <ReferrersTab />
          </TabsContent>

          {/* LEGAL TAB */}
          <TabsContent value="legal">
            <LegalTab />
          </TabsContent>

          {/* RESET TAB */}
          <TabsContent value="reset">
            <ResetTab />
          </TabsContent>

          {/* GUIDE TAB */}
          <TabsContent value="guide">
            <GuideTab />
          </TabsContent>

          {/* PROJECTS TAB */}
          <TabsContent value="projects">
            <GlassCard className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Projects</h2>
                <Button
                  onClick={() =>
                    setEditingProject({
                      id: `project-${Date.now()}`,
                      title: '',
                      description: '',
                      category: 'Motion Design',
                      year: new Date().getFullYear(),
                      imageUrl: '',
                      videoUrl: '',
                      tags: [],
                      featured: false,
                      client: '',
                      goal: '',
                      approach: '',
                      deliverables: [],
                      outcome: '',
                      screenshots: [],
                    })
                  }
                  className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Project
                </Button>
              </div>

              {/* Show form at top only for new projects (temporary ID starting with 'project-') */}
              {editingProject && editingProject.id.startsWith('project-') && (
                <ProjectForm
                  project={editingProject}
                  onSave={saveProject}
                  onCancel={() => setEditingProject(null)}
                  categories={settings.projectCategories || ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Other']}
                />
              )}

              {projects.length > 0 && (
                <p className="text-sm text-white/50 mb-4">
                  💡 Drag and drop to reorder projects. Changes are saved automatically.
                </p>
              )}

              <DndProvider backend={HTML5Backend}>
                <div className="space-y-3">
                  {projects.map((project, index) => (
                    <DraggableProjectCard
                      key={project.id}
                      project={project}
                      index={index}
                      moveProject={moveProject}
                      onEdit={() => setEditingProject(project)}
                      onDelete={() => deleteProject(project.id)}
                      onDragEnd={reorderProjects}
                      isExpanded={editingProject?.id === project.id}
                      expandedContent={
                        editingProject?.id === project.id ? (
                          <ProjectForm
                            project={editingProject}
                            onSave={saveProject}
                            onCancel={() => setEditingProject(null)}
                            categories={settings.projectCategories || ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Other']}
                          />
                        ) : null
                      }
                    />
                  ))}
                </div>
              </DndProvider>
            </GlassCard>

            {/* PROJECT CATEGORIES */}
            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-1">Project Categories</h2>
              <p className="text-gray-400 text-sm mb-4">
                These appear in the category dropdown when adding or editing a project.
              </p>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
                {(settings.projectCategories || []).length === 0 && (
                  <p className="text-gray-500 text-sm italic">No categories yet — add one below.</p>
                )}
                {(settings.projectCategories || []).map((cat, index) => (
                  <span
                    key={cat}
                    className="flex items-center gap-1 pl-3 pr-1.5 py-1 bg-purple-900/40 border border-purple-500/40 rounded-full text-sm text-white"
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeProjectCategory(index)}
                      disabled={catSaving}
                      className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors disabled:opacity-40"
                      title={`Remove "${cat}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Motion Design"
                  value={newProjectCat}
                  onChange={(e) => setNewProjectCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProjectCategory(); } }}
                  className="bg-black/50 border-white/20 text-white"
                  disabled={catSaving}
                />
                <Button
                  type="button"
                  onClick={addProjectCategory}
                  disabled={catSaving || !newProjectCat.trim()}
                  className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {catSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Plus className="w-4 h-4 mr-1" />Add</>
                  )}
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* TOOLS TAB */}
          <TabsContent value="tools">
            <GlassCard className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Tools</h2>
                <Button
                  onClick={() =>
                    setEditingTool({
                      id: `tool-${Date.now()}`,
                      name: '',
                      description: '',
                      category: 'New',
                      imageUrl: '',
                      featured: false,
                      slug: '',
                      faqs: [],
                      versions: [],
                    })
                  }
                  className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tool
                </Button>
              </div>

              {/* Show form at top only for new tools (temporary ID starting with 'tool-') */}
              {editingTool && editingTool.id.startsWith('tool-') && (
                <ToolFormNew
                  tool={editingTool}
                  onSave={saveTool}
                  onCancel={() => setEditingTool(null)}
                  statuses={(settings.toolStatuses || []).map(s => s.label)}
                  toolCategories={settings.toolCategories || []}
                />
              )}

              {tools.length > 0 && (
                <p className="text-sm text-white/50 mb-4">
                  💡 Drag and drop to reorder tools. Changes are saved automatically.
                </p>
              )}

              <DndProvider backend={HTML5Backend}>
                <div className="space-y-3">
                  {tools.map((tool, index) => (
                    <DraggableToolCard
                      key={tool.id}
                      tool={tool}
                      index={index}
                      moveTool={moveTool}
                      onEdit={() => setEditingTool(tool)}
                      onDelete={() => deleteTool(tool.id)}
                      onDragEnd={reorderTools}
                      isExpanded={editingTool?.id === tool.id}
                      expandedContent={
                        editingTool?.id === tool.id ? (
                          <ToolFormNew
                            tool={editingTool}
                            onSave={saveTool}
                            onCancel={() => setEditingTool(null)}
                            statuses={(settings.toolStatuses || []).map(s => s.label)}
                            toolCategories={settings.toolCategories || []}
                          />
                        ) : null
                      }
                    />
                  ))}
                </div>
              </DndProvider>
            </GlassCard>

            {/* TOOL CATEGORIES */}
            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-1">Tool Categories</h2>
              <p className="text-gray-400 text-sm mb-4">
                These appear in the category dropdown when adding or editing a tool.
              </p>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
                {(settings.toolCategories || []).length === 0 && (
                  <p className="text-gray-500 text-sm italic">No categories yet — add one below.</p>
                )}
                {(settings.toolCategories || []).map((cat, index) => (
                  <span
                    key={cat}
                    className="flex items-center gap-1 pl-3 pr-1.5 py-1 bg-purple-900/40 border border-purple-500/40 rounded-full text-sm text-white"
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeToolCategory(index)}
                      disabled={catSaving}
                      className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors disabled:opacity-40"
                      title={`Remove "${cat}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Rendering"
                  value={newToolCat}
                  onChange={(e) => setNewToolCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToolCategory(); } }}
                  className="bg-black/50 border-white/20 text-white"
                  disabled={catSaving}
                />
                <Button
                  type="button"
                  onClick={addToolCategory}
                  disabled={catSaving || !newToolCat.trim()}
                  className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {catSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Plus className="w-4 h-4 mr-1" />Add</>
                  )}
                </Button>
              </div>
            </GlassCard>

            {/* TOOL STATUSES */}
            <GlassCard className="p-6">
              <h2 className="text-xl font-bold text-white mb-1">Tool Statuses</h2>
              <p className="text-gray-400 text-sm mb-4">
                These appear as badge pills on tool cards. Pick a label and a color for each status.
              </p>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
                {(settings.toolStatuses || []).length === 0 && (
                  <p className="text-gray-500 text-sm italic">No statuses yet — add one below.</p>
                )}
                {(settings.toolStatuses || []).map((status, index) => {
                  const colorOption = STATUS_COLOR_OPTIONS.find(c => c.name === status.color);
                  return (
                    <span
                      key={status.label}
                      className={`flex items-center gap-1 pl-3 pr-1.5 py-1 bg-gradient-to-r ${colorOption?.classes || 'from-purple-500 to-violet-500'} rounded-full text-sm text-white font-medium`}
                    >
                      {status.label}
                      <button
                        type="button"
                        onClick={() => removeToolStatus(index)}
                        disabled={catSaving}
                        className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-black/20 transition-colors disabled:opacity-40"
                        title={`Remove "${status.label}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  placeholder="e.g. Hot Deal"
                  value={newToolStatusLabel}
                  onChange={(e) => setNewToolStatusLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToolStatus(); } }}
                  className="bg-black/50 border-white/20 text-white flex-1 min-w-[140px]"
                  disabled={catSaving}
                />
                {/* Color swatches */}
                <div className="flex gap-1.5 items-center">
                  {STATUS_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setNewToolStatusColor(color.name)}
                      title={color.label}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${color.classes} transition-all ${
                        newToolStatusColor === color.name
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={addToolStatus}
                  disabled={catSaving || !newToolStatusLabel.trim()}
                  className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {catSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Plus className="w-4 h-4 mr-1" />Add</>
                  )}
                </Button>
              </div>
            </GlassCard>
          </TabsContent>

          {/* TEAM TAB */}
          <TabsContent value="team">
            <GlassCard className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Team Members</h2>
                <Button
                  onClick={() =>
                    setEditingTeamMember({
                      id: `member-${Date.now()}`,
                      name: '',
                      role: '',
                      bio: '',
                      imageUrl: '',
                      socialLinks: {},
                    })
                  }
                  className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Team Member
                </Button>
              </div>

              {editingTeamMember && (
                <TeamMemberForm
                  member={editingTeamMember}
                  onSave={saveTeamMember}
                  onCancel={() => setEditingTeamMember(null)}
                />
              )}

              <div className="space-y-4">
                {team.map((member) => (
                  <div
                    key={member.id}
                    className="flex justify-between items-center p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div>
                      <h3 className="text-white font-semibold">{member.name}</h3>
                      <p className="text-gray-400 text-sm">{member.role}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTeamMember(member)}
                        className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent group cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTeamMember(member.id)}
                        className="cursor-pointer hover:bg-red-600/20 group text-white"
                      >
                        <Trash2 className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <GlassCard className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Settings</h2>
                <Button
                  onClick={() => setEditingSettings(true)}
                  className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Edit Settings
                </Button>
              </div>

              {editingSettings && (
                <SettingsForm
                  settings={settings}
                  onSave={saveSettings}
                  onCancel={() => setEditingSettings(false)}
                />
              )}

              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-1">Site URL</h3>
                  <p className="text-gray-400 text-sm">{settings.siteUrl || 'Not set'}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Used to auto-generate canonical URLs in the SEO Manager.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-2">Default OG Image</h3>
                  {settings.defaultOgImage ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={settings.defaultOgImage}
                        alt="Default OG"
                        className="w-24 h-14 rounded object-cover border border-white/10"
                      />
                      <p className="text-gray-400 text-xs truncate max-w-xs">{settings.defaultOgImage}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Not set — used as fallback OG image for pages without a custom image.</p>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-2">Favicon</h3>
                  {settings.faviconUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={settings.faviconUrl}
                        alt="Site favicon"
                        className="w-10 h-10 rounded object-contain bg-white/10 p-1 border border-white/20"
                      />
                      <p className="text-gray-400 text-xs truncate max-w-xs">{settings.faviconUrl}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No favicon uploaded yet. Click "Edit Settings" to upload one.</p>
                  )}
                </div>

                <div
                  className="p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <h3 className="text-white font-semibold mb-2">Social Media Links</h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-400">
                      <span className="text-gray-500">LinkedIn:</span> {settings.socialLinks?.linkedin || 'Not set'}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">Instagram:</span> {settings.socialLinks?.instagram || 'Not set'}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">X (Twitter):</span> {settings.socialLinks?.twitter || 'Not set'}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">Dribbble:</span> {settings.socialLinks?.dribbble || 'Not set'}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">Behance:</span> {settings.socialLinks?.behance || 'Not set'}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">TikTok:</span> {settings.socialLinks?.tiktok || 'Not set'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-1">Contact Email</h3>
                  <p className="text-gray-400 text-sm">{settings.contactEmail || 'Not set'}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Displayed in the footer and used as the public contact address.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-1">Password Reset Reply-To</h3>
                  <p className="text-gray-400 text-sm">{settings.emailReplyTo || 'Not set'}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Replies to the branded password-reset email will be forwarded to this address.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-1">Calendly Booking URL</h3>
                  <p className="text-gray-400 text-sm">{settings.calendlyUrl || 'Not set'}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Used on the "Work with us" page for the discovery call booking widget.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-1">Gemini API Key</h3>
                  <p className="text-gray-400 text-sm font-mono">
                    {settings.geminiApiKey ? `${settings.geminiApiKey.slice(0, 8)}${'•'.repeat(20)}` : 'Not set'}
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">Used for all AI content generation features. Click "Edit Settings" to update.</p>
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-1">Gemini Model</h3>
                  <p className="text-gray-400 text-sm">{settings.geminiModel || 'gemini-2.5-flash (default)'}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Switch models when you hit quota limits. Click "Edit Settings" to change.</p>
                </div>

              </div>
            </GlassCard>

            {/* CLIENT LOGOS */}
            <GlassCard className="p-6 mt-6">
              <h2 className="text-xl font-bold text-white mb-1">Client Logos</h2>
              <p className="text-gray-400 text-sm mb-5">
                These scroll across the "Trusted by" banner on the About page. Add a name (required) and optionally paste an image URL for the logo. Hover over a logo in the ticker to pause the animation.
              </p>

              {/* Scroll speed */}
              <div className="flex items-center gap-3 mb-5 p-3 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex-1">
                  <p className="text-white text-sm font-semibold mb-0.5">Scroll speed</p>
                  <p className="text-white/40 text-xs">Seconds for one full loop. Lower = faster, higher = slower. Default: 28s.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    step={1}
                    value={settings.marqueeSpeed ?? 28}
                    onChange={e => {
                      const v = Math.max(5, Math.min(120, Number(e.target.value)));
                      setSettings(s => ({ ...s, marqueeSpeed: v }));
                    }}
                    onBlur={async () => {
                      try { await saveSettings({ ...settings }); } catch {}
                    }}
                    className="w-20 bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-white/40 text-sm">s</span>
                </div>
              </div>

              {/* Current logos */}
              <div className="space-y-2 mb-4">
                {(settings.clientLogos || []).length === 0 && (
                  <p className="text-gray-500 text-sm italic">No logos yet — add one below. The About page will show the built-in placeholder names until you save at least one entry.</p>
                )}
                {(settings.clientLogos || []).map((logo, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                    {logo.imageUrl ? (
                      <img
                        src={logo.imageUrl}
                        alt={logo.name}
                        className="h-8 w-16 object-contain rounded bg-white/5 border border-white/10 p-1 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-16 flex items-center justify-center rounded bg-white/5 border border-white/10 flex-shrink-0">
                        <span className="text-white/30 text-xs">No img</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{logo.name}</p>
                      {logo.imageUrl && (
                        <p className="text-white/30 text-xs truncate">{logo.imageUrl}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={logoSaving}
                      onClick={async () => {
                        const updated = (settings.clientLogos || []).filter((_, i) => i !== index);
                        setLogoSaving(true);
                        try { await saveSettings({ ...settings, clientLogos: updated }); } catch {}
                        setLogoSaving(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors disabled:opacity-40 flex-shrink-0"
                      title={`Remove "${logo.name}"`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new logo */}
              <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] space-y-3">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Add a logo</p>

                {/* Hidden file input */}
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoFileUpload(file);
                    e.target.value = ''; // reset so same file can be re-selected
                  }}
                />

                {/* Row 1: name + image input area */}
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Company name (e.g. Apple)"
                    value={newLogoName}
                    onChange={e => setNewLogoName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('logo-url-input')?.focus(); } }}
                    className="bg-black/50 border-white/20 text-white flex-1 min-w-[160px]"
                    disabled={logoSaving || logoUploading}
                  />

                  {/* URL input + clear button */}
                  <div className="relative flex-1 min-w-[180px]">
                    <Input
                      id="logo-url-input"
                      placeholder="Paste image URL…"
                      value={newLogoUrl}
                      onChange={e => setNewLogoUrl(e.target.value)}
                      className="bg-black/50 border-white/20 text-white pr-8 w-full"
                      disabled={logoSaving || logoUploading}
                    />
                    {newLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setNewLogoUrl('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                        title="Clear URL"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Upload button */}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={logoSaving || logoUploading}
                    onClick={() => logoFileInputRef.current?.click()}
                    className="cursor-pointer whitespace-nowrap border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                    title="Upload a logo image from your computer"
                  >
                    {logoUploading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Uploading…</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Upload</>
                    )}
                  </Button>

                  {/* Add logo button */}
                  <Button
                    type="button"
                    disabled={logoSaving || logoUploading || !newLogoName.trim()}
                    onClick={async () => {
                      if (!newLogoName.trim()) return;
                      const updated = [...(settings.clientLogos || []), { name: newLogoName.trim(), imageUrl: newLogoUrl.trim() || undefined }];
                      setLogoSaving(true);
                      try { await saveSettings({ ...settings, clientLogos: updated }); setNewLogoName(''); setNewLogoUrl(''); } catch {}
                      setLogoSaving(false);
                    }}
                    className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                  >
                    {logoSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Plus className="w-4 h-4 mr-1" />Add Logo</>
                    )}
                  </Button>
                </div>

                {/* Live image preview */}
                {newLogoUrl.trim() && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-white/30 text-xs">Preview:</span>
                    <div className="h-10 px-3 flex items-center rounded-lg bg-white/5 border border-white/10">
                      <img
                        src={newLogoUrl.trim()}
                        alt="preview"
                        className="h-7 w-auto max-w-[120px] object-contain"
                        onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                      />
                    </div>
                    <span className="text-white/20 text-xs truncate max-w-[200px]">{newLogoUrl.trim()}</span>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* LEADS TAB */}
          <TabsContent value="leads">
            <LeadsTab />
          </TabsContent>

          {/* BROADCAST TAB */}
          <TabsContent value="broadcast">
            <BroadcastTab />
          </TabsContent>

          {/* TOOL REQUESTS / MESSAGES TAB */}
          <TabsContent value="messages">
            <ToolRequestsTab />
          </TabsContent>

          {/* HOME TAB */}
          <TabsContent value="home">
            <GlassCard className="p-6 mb-6">
              <HomeTab />
            </GlassCard>
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews">
            <AdminReviewsTab />
          </TabsContent>

          {/* SEO TAB */}
          <TabsContent value="seo">
            <GlassCard className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">SEO Manager</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Manage meta tags, Open Graph, and Twitter cards for every page.
                  Use the ✨ AI button to auto-generate content.
                </p>
              </div>
              <SeoTab />
            </GlassCard>
          </TabsContent>

          {/* STYLE TAB */}
          <TabsContent value="style">
            <StyleTab />
          </TabsContent>

          {/* TRANSLATIONS TAB */}
          <TabsContent value="translations">
            <TranslationTab />
          </TabsContent>

        </Tabs>
          </div>{/* end p-8 */}
        </div>{/* end main content */}
      </div>{/* end flex wrapper */}
    </>
  );
}

// ========== SHARED HELPERS ==========

async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
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

// ========== PROJECT FORM ==========

/**
 * Fetches the thumbnail for a Vimeo URL via the public oEmbed endpoint (CORS-safe)
 * and renders it like any other image card in the gallery.
 */
function VimeoThumb({ url, vimeoId }: { url: string; vimeoId: string }) {
  const [thumb, setThumb] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=480`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d?.thumbnail_url) setThumb(d.thumbnail_url); })
      .catch(() => { /* private or unavailable — keep logo fallback */ });
    return () => { cancelled = true; };
  }, [url]);

  if (thumb) {
    return (
      <img
        src={thumb}
        alt={`Vimeo ${vimeoId}`}
        className="w-full h-full object-cover"
        onError={() => setThumb(null)}
      />
    );
  }

  /* Fallback: Vimeo logo + ID while loading or if thumbnail unavailable */
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#1ab7ea]/5">
      <svg className="w-7 h-7 text-[#1ab7ea]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
      </svg>
      <span className="text-[10px] text-[#1ab7ea]/70 font-mono">{vimeoId}</span>
    </div>
  );
}

function ProjectForm({
  project,
  onSave,
  onCancel,
  categories,
}: {
  project: Project;
  onSave: (project: Project) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
  categories: string[];
}) {
  const [formData, setFormData] = useState({
    ...project,
    title: project.title || '',
    description: project.description || '',
    category: project.category || '',
    imageUrl: project.imageUrl || '',
    videoUrl: project.videoUrl || '',
    tags: project.tags || [],
    screenshots: project.screenshots || [],
    year: project.year || new Date().getFullYear(),
    featured: project.featured || false,
  });
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [screenshotsInputMode, setScreenshotsInputMode] = useState<'url' | 'upload' | 'vimeo'>('url');
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showThumbnailSelector, setShowThumbnailSelector] = useState(false);
  // AI state
  const [generating, setGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [improveExisting, setImproveExisting] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [thumbnailOptions, setThumbnailOptions] = useState<string[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [showVideoCapture, setShowVideoCapture] = useState(false);
  const [showVimeoPicker, setShowVimeoPicker]   = useState(false);
  const [showScreenshotsVimeoPicker, setShowScreenshotsVimeoPicker] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number | null>(null);
  // Per-field AI improve modal
  const [aiModal, setAiModal] = useState<null | {
    fieldLabel: string; fieldKey: string; currentValue: string;
    context: AIImproveContext; onApply: (v: string) => void;
  }>(null);

  const openProjectAiModal = (
    fieldKey: string, fieldLabel: string, currentValue: string,
    onApply: (v: string) => void
  ) => {
    setAiModal({
      fieldKey, fieldLabel, currentValue,
      context: { entityType: 'project', title: formData.title, category: formData.category },
      onApply,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);
    setErrors(prev => ({ ...prev, imageUpload: '' }));
    
    try {
      const token = localStorage.getItem('admin_token');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: uploadFormData,
      });

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({ ...prev, imageUrl: result.data.url }));
        setErrors(prev => ({ ...prev, imageUpload: '', imageUrl: '' }));
        setUploadSuccess(true);
      } else {
        setErrors(prev => ({ ...prev, imageUpload: `Upload failed: ${result.error}` }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors(prev => ({ ...prev, imageUpload: 'Failed to upload image. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const handleScreenshotsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingScreenshots(true);
    setErrors(prev => ({ ...prev, screenshotsUpload: '' }));
    
    try {
      const token = localStorage.getItem('admin_token');
      const uploadedUrls: string[] = [];
      
      // Upload each file — route videos to /upload-video, images to /upload-image
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? `${API_BASE}/upload-video` : `${API_BASE}/upload-image`;
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Admin-Token': token || '',
          },
          body: uploadFormData,
        });

        const result = await response.json();
        if (result.success) {
          uploadedUrls.push(result.data.url);
        } else {
          throw new Error(`Failed to upload ${file.name}: ${result.error}`);
        }
      }
      
      // Add uploaded URLs to existing screenshots
      setFormData(prev => ({ 
        ...prev, 
        screenshots: [...(prev.screenshots || []), ...uploadedUrls] 
      }));
      setErrors(prev => ({ ...prev, screenshotsUpload: '' }));
    } catch (error) {
      console.error('Screenshots upload error:', error);
      setErrors(prev => ({ 
        ...prev, 
        screenshotsUpload: `Failed to upload screenshots: ${error}` 
      }));
    } finally {
      setUploadingScreenshots(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const removeScreenshot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      screenshots: (prev.screenshots || []).filter((_, i) => i !== index)
    }));
  };

  // AI helpers
  const applyHighlight = (fields: string[]) => {
    if (fields.length === 0) return;
    setHighlightedFields(new Set(fields));
    setTimeout(() => setHighlightedFields(new Set()), 3500);
  };
  const hlClass = (key: string) =>
    highlightedFields.has(key) ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)]' : '';

  const handleAutoFill = async () => {
    if (!formData.title?.trim()) {
      setFormMessage({ type: 'error', text: 'Enter a project title first so the AI knows what to generate.' });
      return;
    }
    setGenerating(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetchWithRetry(`${API_BASE}/admin/generate-project-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({
          project: {
            title: formData.title, category: formData.category,
            description: formData.description, goal: formData.goal,
            approach: formData.approach, outcome: formData.outcome,
            deliverables: formData.deliverables, tags: formData.tags,
            client: formData.client,
          },
          instruction: aiInstruction, improveExisting,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setFormMessage({ type: 'error', text: result.error || 'Failed to generate content.' });
        return;
      }
      if (result.nothingToGenerate) {
        setFormMessage({ type: 'success', text: '✨ All fields are already filled — nothing to generate.' });
        return;
      }
      const data = result.data;
      const updates: Partial<typeof formData> = {};
      const changed: string[] = [];
      if (data.description && (improveExisting || !formData.description?.trim())) {
        updates.description = String(data.description).slice(0, 250); changed.push('description');
      }
      if (data.goal && (improveExisting || !formData.goal?.trim())) {
        updates.goal = data.goal; changed.push('goal');
      }
      if (data.approach && (improveExisting || !formData.approach?.trim())) {
        updates.approach = data.approach; changed.push('approach');
      }
      if (data.outcome && (improveExisting || !formData.outcome?.trim())) {
        updates.outcome = data.outcome; changed.push('outcome');
      }
      const tagsEmpty = !formData.tags?.length || formData.tags.every(t => !t.trim());
      if (data.tags && (improveExisting || tagsEmpty)) {
        updates.tags = data.tags; changed.push('tags');
      }
      const delivEmpty = !formData.deliverables?.length || formData.deliverables.every(d => !d.trim());
      if (data.deliverables && (improveExisting || delivEmpty)) {
        updates.deliverables = data.deliverables; changed.push('deliverables');
      }
      setFormData(prev => ({ ...prev, ...updates }));
      applyHighlight(changed);
      setFormMessage({ type: 'success', text: `✨ ${improveExisting ? 'Content rewritten' : 'Content generated'}! Review each field and adjust as needed.` });
    } catch (err) {
      console.warn('Auto-fill failed:', err);
      setFormMessage({ type: 'error', text: 'Could not reach the server. Please wait a moment and try again.' });
    } finally {
      setGenerating(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title?.trim()) {
      newErrors.title = 'Project title is required';
    }
    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.category?.trim()) {
      newErrors.category = 'Category is required';
    }
    if (!formData.year || formData.year < 1900 || formData.year > 2100) {
      newErrors.year = 'Valid year is required';
    }
    if (!formData.imageUrl?.trim()) {
      newErrors.imageUrl = 'Image is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateForm()) {
      setSaving(true);
      setFormMessage(null);
      const result = await onSave(formData);
      setSaving(false);
      setFormMessage({ type: result.success ? 'success' : 'error', text: result.message });
      if (result.success) {
        setTimeout(() => onCancel(), 1500);
      }
    } else {
      setFormMessage({ type: 'error', text: 'Please fix the validation errors before saving.' });
    }
  };

  return (
    <div className="mb-6 p-6 bg-white/10 rounded-lg border border-white/20">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-white">
            {project.title ? 'Edit Project' : 'New Project'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAiOptions(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-purple-300 bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/20 transition-all duration-150 select-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              AI Options {showAiOptions ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={generating || !formData.title?.trim()}
              title={!formData.title?.trim() ? 'Enter a project title first' : improveExisting ? 'Rewrite all fields with Gemini AI' : 'Auto-fill empty fields using Gemini AI'}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 select-none disabled:opacity-40 disabled:cursor-not-allowed ${generating ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300 cursor-wait' : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 border border-purple-400/30 text-white shadow-lg shadow-purple-900/40 active:scale-95'}`}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-purple-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{improveExisting ? 'Rewriting…' : 'Generating…'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{improveExisting ? 'Rewrite with AI' : 'Auto-fill with AI'}</span>
                </>
              )}
            </button>
          </div>
        </div>
        {showAiOptions && (
          <div className="p-4 bg-purple-950/40 border border-purple-500/20 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-semibold text-purple-300 mb-1.5 uppercase tracking-wide">
                Instructions for AI <span className="text-purple-400/50 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                placeholder='e.g. "Focus on the technical complexity · Use a cinematic tone · Emphasize brand impact"'
                className="w-full px-3 py-2 bg-black/40 border border-purple-400/20 rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
              />
              <p className="text-xs text-white/30 mt-1">Gemini will use this to guide tone, focus, and style for all generated content.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setImproveExisting(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${improveExisting ? 'bg-purple-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${improveExisting ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <div>
                <span className="text-sm text-white font-medium">Rewrite existing content</span>
                <p className="text-xs text-white/40">When on, Gemini rewrites ALL fields — not just empty ones.</p>
              </div>
            </label>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Project Title *
          </label>
          <Input
            placeholder="Enter project title"
            value={formData.title || ''}
            onChange={(e) => {
              const newTitle = e.target.value;
              // Auto-update slug from title unless user has manually customised it
              const currentSlug = formData.slug || '';
              const prevAutoSlug = createSlug(formData.title || '');
              const slugWasAutoGenerated = !currentSlug || currentSlug === prevAutoSlug;
              setFormData({
                ...formData,
                title: newTitle,
                slug: slugWasAutoGenerated ? createSlug(newTitle) : currentSlug,
              });
              setErrors(prev => ({ ...prev, title: '' }));
            }}
            className={`bg-black/30 backdrop-blur-xl border-white/20 text-white ${errors.title ? 'border-red-500' : ''}`}
          />
          {errors.title && (
            <p className="text-red-400 text-sm mt-1">{errors.title}</p>
          )}
        </div>

        {/* Slug field — auto-filled from title, editable for custom overrides */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            URL Slug
            <span className="ml-2 text-xs text-white/40 font-normal">(auto-generated from title — edit to customise)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-sm shrink-0">/projects/</span>
            <Input
              placeholder="url-friendly-slug"
              value={formData.slug || createSlug(formData.title || '')}
              onChange={(e) => {
                const raw = e.target.value
                  .toLowerCase()
                  .replace(/[^\w\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/--+/g, '-');
                setFormData({ ...formData, slug: raw });
              }}
              className="bg-black/30 backdrop-blur-xl border-white/20 text-white font-mono text-sm"
            />
          </div>
          <p className="text-xs text-purple-400/70 mt-1">
            Final URL: /projects/{formData.slug || createSlug(formData.title || '')}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">Short Description *</label>
            <button type="button" onClick={() => openProjectAiModal('description', 'Description', formData.description || '', (v) => setFormData(prev => ({ ...prev, description: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <div className="relative">
            <Textarea
              placeholder="Brief description shown on project cards"
              value={formData.description || ''}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setErrors(prev => ({ ...prev, description: '' }));
              }}
              className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${errors.description ? 'border-red-500' : ''} ${hlClass('description')}`}
              rows={3}
            />
          </div>
          {errors.description && (
            <p className="text-red-400 text-sm mt-1">{errors.description}</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <AdminSelect
              value={formData.category || ''}
              onChange={(v) => {
                setFormData({ ...formData, category: v });
                setErrors(prev => ({ ...prev, category: '' }));
              }}
              options={categories.map((c) => ({ value: c, label: c }))}
              placeholder="Select category"
              className={errors.category ? 'ring-1 ring-red-500 rounded-lg' : ''}
            />
            {errors.category && (
              <p className="text-red-400 text-sm mt-1">{errors.category}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Year *
            </label>
            <Input
              type="number"
              placeholder="2024"
              value={formData.year}
              onChange={(e) => {
                setFormData({ ...formData, year: parseInt(e.target.value) });
                setErrors(prev => ({ ...prev, year: '' }));
              }}
              className={`bg-black/50 border-white/20 text-white ${errors.year ? 'border-red-500' : ''}`}
            />
            {errors.year && (
              <p className="text-red-400 text-sm mt-1">{errors.year}</p>
            )}
          </div>
        </div>
        
        {/* Image input with toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Project Image *
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setImageInputMode('url')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                imageInputMode === 'url'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              Paste URL
            </button>
            <button
              type="button"
              onClick={() => setImageInputMode('upload')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                imageInputMode === 'upload'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              Upload File
            </button>
          </div>
          
          {imageInputMode === 'url' ? (
            <div>
              <Input
                placeholder="Image URL"
                value={formData.imageUrl}
                onChange={(e) => {
                  setFormData({ ...formData, imageUrl: e.target.value });
                  setErrors(prev => ({ ...prev, imageUrl: '' }));
                }}
                className={`bg-black/50 border-white/20 text-white ${errors.imageUrl ? 'border-red-500' : ''}`}
              />
              {errors.imageUrl && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUrl}</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => document.getElementById('projectImageUpload')?.click()}
                  disabled={uploading}
                  className="cursor-pointer bg-white/10 hover:bg-white/20 text-white"
                >
                  {uploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Image to Upload
                    </>
                  )}
                </Button>
              </div>
              <input
                type="file"
                id="projectImageUpload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {uploadSuccess && !errors.imageUpload && (
                <p className="text-xs text-green-400 mt-2">✓ Image uploaded successfully</p>
              )}
              {errors.imageUpload && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUpload}</p>
              )}
              {errors.imageUrl && !errors.imageUpload && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUrl}</p>
              )}
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Video URL (Optional)
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/... or https://vimeo.com/..."
                value={formData.videoUrl || ''}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                className="bg-black/50 border-white/20 text-white flex-1"
              />
              {/* Browse Vimeo library */}
              <Button
                type="button"
                onClick={() => setShowVimeoPicker(true)}
                className="cursor-pointer bg-[#1ab7ea]/20 hover:bg-[#1ab7ea]/30 border border-[#1ab7ea]/40 text-[#1ab7ea] whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
                </svg>
                Browse Vimeo
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!formData.videoUrl) {
                    setFormMessage({ type: 'error', text: 'Please enter a video URL before capturing thumbnails.' });
                    return;
                  }
                  setFormMessage(null);
                  setShowVideoCapture(true);
                }}
                className="cursor-pointer bg-gradient-to-r from-purple-600 to-blue-600 text-white whitespace-nowrap"
              >
                Capture Thumbnails
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Paste a YouTube / Vimeo URL, or click <span className="text-[#1ab7ea]">Browse Vimeo</span> to pick directly from your library
            </p>
          </div>
        </div>
        
        {/* Vimeo Video Picker — main video URL field */}
        {showVimeoPicker && (
          <VimeoPicker
            onSelect={(url, title) => {
              setFormData({ ...formData, videoUrl: url });
              setShowVimeoPicker(false);
              setFormMessage({ type: 'success', text: `✅ Video selected: "${title}"` });
            }}
            onClose={() => setShowVimeoPicker(false)}
          />
        )}

        {/* Vimeo Video Picker — media gallery (keeps picker open for multi-pick) */}
        {showScreenshotsVimeoPicker && (
          <VimeoPicker
            selectedUrls={formData.screenshots || []}
            onSelect={(url, title) => {
              setFormData(prev => {
                const already = (prev.screenshots || []).includes(url);
                const next = already
                  ? (prev.screenshots || []).filter(u => u !== url)
                  : [...(prev.screenshots || []), url];
                setFormMessage({
                  type: 'success',
                  text: already ? `🗑 "${title}" removed from gallery` : `✅ "${title}" added to gallery`,
                });
                return { ...prev, screenshots: next };
              });
              // Keep picker open so user can add/remove multiple videos
            }}
            onClose={() => setShowScreenshotsVimeoPicker(false)}
          />
        )}

        {/* Video Thumbnail Capture Tool */}
        {showVideoCapture && (
          <VideoThumbnailCapture
            videoUrl={formData.videoUrl}
            initialFrames={capturedFrames}
            onApply={(frames, selectedIdx) => {
              setCapturedFrames(frames);
              setSelectedThumbnailIndex(selectedIdx);
              if (selectedIdx !== null && frames[selectedIdx]) {
                setFormData(prev => ({ ...prev, imageUrl: frames[selectedIdx] }));
                setErrors(prev => ({ ...prev, imageUrl: '' }));
                setFormMessage({ type: 'success', text: '✅ Thumbnail applied as project image.' });
              }
            }}
            onClose={() => setShowVideoCapture(false)}
          />
        )}
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">Tags</label>
            <button type="button" onClick={() => openProjectAiModal('tags', 'Tags', formData.tags.join(', '), (v) => setFormData(prev => ({ ...prev, tags: v.split(',').map(t => t.trim()).filter(Boolean) })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <Input
            placeholder="Motion Design, Brand, Product (comma-separated)"
            value={formData.tags.join(', ')}
            onChange={(e) =>
              setFormData({ ...formData, tags: e.target.value.split(',').map((t) => t.trim()) })
            }
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('tags')}`}
          />
        </div>
        
        {/* New Project Detail Fields */}
        <div className="border-t border-white/20 pt-4 mt-4">
          <h4 className="text-white font-semibold mb-4">Project Details (for detail page)</h4>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Client Name <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('client', 'Client Name', formData.client || '', (v) => setFormData(prev => ({ ...prev, client: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Input
                placeholder="e.g., TechCorp Financial"
                value={formData.client || ''}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Goal <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('goal', 'Goal', formData.goal || '', (v) => setFormData(prev => ({ ...prev, goal: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Describe the project goal and objectives"
                value={formData.goal || ''}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('goal')}`}
                rows={3}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Approach <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('approach', 'Approach', formData.approach || '', (v) => setFormData(prev => ({ ...prev, approach: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Explain the creative approach and process"
                value={formData.approach || ''}
                onChange={(e) => setFormData({ ...formData, approach: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('approach')}`}
                rows={3}
              />
            </div>
          
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Deliverables <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('deliverables', 'Deliverables', (formData.deliverables || []).join('\n'), (v) => setFormData(prev => ({ ...prev, deliverables: v.split('\n').filter(d => d.trim()) })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Enter each deliverable on a new line&#10;e.g.:&#10;90-second explainer video&#10;Social media cutdowns&#10;Brand guidelines"
                value={(formData.deliverables || []).join('\n')}
                onChange={(e) => setFormData({ ...formData, deliverables: e.target.value.split('\n') })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('deliverables')}`}
                rows={4}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Outcome <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('outcome', 'Outcome', formData.outcome || '', (v) => setFormData(prev => ({ ...prev, outcome: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Describe the results and impact"
                value={formData.outcome || ''}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('outcome')}`}
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Media Gallery — Images, GIFs &amp; Videos (Optional)
              </label>

              {/* Tab bar */}
              <div className="flex gap-2 mb-3">
                {(['url', 'upload', 'vimeo'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScreenshotsInputMode(mode)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      screenshotsInputMode === mode
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {mode === 'url' && 'Paste URLs'}
                    {mode === 'upload' && 'Upload Files'}
                    {mode === 'vimeo' && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
                        </svg>
                        Browse Vimeo
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Paste URLs panel */}
              {screenshotsInputMode === 'url' && (
                <Textarea
                  placeholder="Enter image or video URLs (one per line)&#10;e.g.:&#10;https://images.unsplash.com/photo-xxx&#10;https://vimeo.com/123456789"
                  value={(formData.screenshots || []).join('\n')}
                  onChange={(e) => setFormData({ ...formData, screenshots: e.target.value.split('\n') })}
                  className="bg-black/50 border-white/20 text-white"
                  rows={4}
                />
              )}

              {/* Upload panel — images AND videos */}
              {screenshotsInputMode === 'upload' && (
                <div>
                  <Button
                    type="button"
                    onClick={() => document.getElementById('screenshotsUpload')?.click()}
                    disabled={uploadingScreenshots}
                    className="cursor-pointer bg-white/10 hover:bg-white/20 text-white"
                  >
                    {uploadingScreenshots ? (
                      <>Uploading…</>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Select Images or Videos
                      </>
                    )}
                  </Button>
                  <input
                    type="file"
                    id="screenshotsUpload"
                    accept="image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo"
                    multiple
                    onChange={handleScreenshotsUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Supports PNG, JPEG, GIF, WebP and MP4, WebM, MOV, AVI · Multiple files at once
                  </p>
                  {errors.screenshotsUpload && (
                    <p className="text-red-400 text-sm mt-1">{errors.screenshotsUpload}</p>
                  )}
                </div>
              )}

              {/* Vimeo picker panel */}
              {screenshotsInputMode === 'vimeo' && (
                <div className="flex items-center gap-3 py-2">
                  <Button
                    type="button"
                    onClick={() => setShowScreenshotsVimeoPicker(true)}
                    className="cursor-pointer bg-[#1ab7ea]/20 hover:bg-[#1ab7ea]/30 border border-[#1ab7ea]/40 text-[#1ab7ea]"
                  >
                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
                    </svg>
                    Open Vimeo Library
                  </Button>
                  <p className="text-xs text-gray-400">
                    Pick one or more videos — each selection adds a Vimeo URL to the gallery
                  </p>
                </div>
              )}

              {/* ── Gallery preview ── */}
              {formData.screenshots && formData.screenshots.filter(u => u.trim()).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">
                    Gallery ({formData.screenshots.filter(u => u.trim()).length} item{formData.screenshots.filter(u => u.trim()).length !== 1 ? 's' : ''})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                    {formData.screenshots.map((url, index) => {
                      if (!url.trim()) return null;
                      const isVimeo = url.includes('vimeo.com');
                      const isDirectVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
                      const vimeoId = isVimeo ? url.split('vimeo.com/').pop()?.split('?')[0]?.split('/').pop() : null;
                      return (
                        <div key={index} className="relative group rounded-lg overflow-hidden border border-white/10 bg-black/30 aspect-video">
                          {isVimeo ? (
                            /* Vimeo card — real thumbnail fetched via oEmbed */
                            <VimeoThumb url={url} vimeoId={vimeoId!} />
                          ) : isDirectVideo ? (
                            /* Direct video */
                            <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                          ) : (
                            /* Image */
                            <img
                              src={url}
                              alt={`Media ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.opacity = '0.2'; }}
                            />
                          )}
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => removeScreenshot(index)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {/* Type badge */}
                          <div className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-gray-300 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                            {isVimeo ? 'Vimeo' : isDirectVideo ? 'Video' : 'Image'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            checked={formData.featured}
            onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
            className="w-4 h-4"
          />
          Featured Project
        </label>

        {/* Inline form message */}
        {formMessage && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            formMessage.type === 'success'
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}>
            <span>{formMessage.type === 'success' ? '✓' : '✗'}</span>
            <span>{formMessage.text}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent cursor-pointer">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Per-field AI Improve Modal */}
      {aiModal && (
        <AIImproveModal
          fieldLabel={aiModal.fieldLabel}
          fieldKey={aiModal.fieldKey}
          currentValue={aiModal.currentValue}
          context={aiModal.context}
          onApply={aiModal.onApply}
          onClose={() => setAiModal(null)}
        />
      )}
    </div>
  );
}

// ========== TOOL FORM MOVED TO /src/app/components/admin/ToolFormNew.tsx ==========

// ========== TEAM MEMBER FORM ==========

function TeamMemberForm({
  member,
  onSave,
  onCancel,
}: {
  member: TeamMember;
  onSave: (member: TeamMember) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    ...member,
    name: member.name || '',
    role: member.role || '',
    bio: member.bio || '',
    imageUrl: member.imageUrl || '',
  });
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // AI state
  const [generating, setGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [improveExisting, setImproveExisting] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [activeImprove, setActiveImprove] = useState<{ fieldKey: string; fieldLabel: string; currentValue: string; onApply: (v: string) => void } | null>(null);
  const openImprove = (fieldKey: string, fieldLabel: string, currentValue: string, onApply: (v: string) => void) =>
    setActiveImprove({ fieldKey, fieldLabel, currentValue, onApply });

  const applyHighlight = (fields: string[]) => {
    if (fields.length === 0) return;
    setHighlightedFields(new Set(fields));
    setTimeout(() => setHighlightedFields(new Set()), 3500);
  };
  const hlClass = (key: string) =>
    highlightedFields.has(key) ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)]' : '';

  const handleAutoFill = async () => {
    if (!formData.name?.trim() || !formData.role?.trim()) {
      setFormMessage({ type: 'error', text: 'Enter a name and role first so the AI can write the bio.' });
      return;
    }
    setGenerating(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetchWithRetry(`${API_BASE}/admin/generate-team-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({
          member: { name: formData.name, role: formData.role, bio: formData.bio },
          instruction: aiInstruction, improveExisting,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setFormMessage({ type: 'error', text: result.error || 'Failed to generate bio.' });
        return;
      }
      if (result.nothingToGenerate) {
        setFormMessage({ type: 'success', text: '✨ Bio is already filled — enable "Rewrite existing content" to regenerate it.' });
        return;
      }
      if (result.data?.bio) {
        setFormData(prev => ({ ...prev, bio: result.data.bio }));
        setErrors(prev => ({ ...prev, bio: '' }));
        applyHighlight(['bio']);
        setFormMessage({ type: 'success', text: `✨ Bio ${improveExisting ? 'rewritten' : 'generated'}! Review and adjust as needed.` });
      }
    } catch (err) {
      console.warn('Team bio generation failed:', err);
      setFormMessage({ type: 'error', text: 'Could not reach the server. Please wait a moment and try again.' });
    } finally {
      setGenerating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);
    setErrors(prev => ({ ...prev, imageUpload: '' }));
    
    try {
      const token = localStorage.getItem('admin_token');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: uploadFormData,
      });

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({ ...prev, imageUrl: result.data.url }));
        setErrors(prev => ({ ...prev, imageUpload: '', imageUrl: '' }));
        setUploadSuccess(true);
      } else {
        setErrors(prev => ({ ...prev, imageUpload: `Upload failed: ${result.error}` }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors(prev => ({ ...prev, imageUpload: 'Failed to upload image. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.role?.trim()) {
      newErrors.role = 'Role is required';
    }
    if (!formData.bio?.trim()) {
      newErrors.bio = 'Bio is required';
    }
    if (!formData.imageUrl?.trim()) {
      newErrors.imageUrl = 'Photo is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateForm()) {
      setSaving(true);
      setFormMessage(null);
      const result = await onSave(formData);
      setSaving(false);
      setFormMessage({ type: result.success ? 'success' : 'error', text: result.message });
      if (result.success) {
        setTimeout(() => onCancel(), 1500);
      }
    } else {
      setFormMessage({ type: 'error', text: 'Please fix the validation errors before saving.' });
    }
  };

  return (
    <div className="mb-6 p-6 bg-white/10 rounded-lg border border-white/20">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-white">
            {member.name ? 'Edit Team Member' : 'New Team Member'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAiOptions(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-purple-300 bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/20 transition-all duration-150 select-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              AI Options {showAiOptions ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={generating || !formData.name?.trim() || !formData.role?.trim()}
              title={!formData.name?.trim() || !formData.role?.trim() ? 'Enter name and role first' : improveExisting ? 'Rewrite bio with Gemini AI' : 'Generate bio with Gemini AI'}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 select-none disabled:opacity-40 disabled:cursor-not-allowed ${generating ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300 cursor-wait' : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 border border-purple-400/30 text-white shadow-lg shadow-purple-900/40 active:scale-95'}`}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-purple-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{improveExisting ? 'Rewriting…' : 'Generating…'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{improveExisting ? 'Rewrite Bio' : 'Generate Bio'}</span>
                </>
              )}
            </button>
          </div>
        </div>
        {showAiOptions && (
          <div className="p-4 bg-purple-950/40 border border-purple-500/20 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-semibold text-purple-300 mb-1.5 uppercase tracking-wide">
                Instructions for AI <span className="text-purple-400/50 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                placeholder='e.g. "Make it more personal · Emphasize technical skills · Keep it under 2 sentences"'
                className="w-full px-3 py-2 bg-black/40 border border-purple-400/20 rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setImproveExisting(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${improveExisting ? 'bg-purple-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${improveExisting ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <div>
                <span className="text-sm text-white font-medium">Rewrite existing bio</span>
                <p className="text-xs text-white/40">When on, Gemini rewrites the existing bio instead of skipping it.</p>
              </div>
            </label>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name *
          </label>
          <Input
            placeholder="e.g., Alex Rivera"
            value={formData.name || ''}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              setErrors(prev => ({ ...prev, name: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name}</p>
          )}
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-300">Role *</label>
            <button type="button" onClick={() => openImprove('teamRole', 'Team Member Role', formData.role || '', v => { setFormData(p => ({ ...p, role: v })); setErrors(prev => ({ ...prev, role: '' })); })} title="AI Improve" className="inline-flex items-center justify-center w-5 h-5 rounded text-purple-400/50 hover:text-purple-300 hover:bg-purple-500/15 transition-all">
              <Sparkles className="w-3 h-3" />
            </button>
          </div>
          <Input
            placeholder="e.g., Motion Design Director"
            value={formData.role || ''}
            onChange={(e) => {
              setFormData({ ...formData, role: e.target.value });
              setErrors(prev => ({ ...prev, role: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white ${errors.role ? 'border-red-500' : ''}`}
          />
          {errors.role && (
            <p className="text-red-400 text-sm mt-1">{errors.role}</p>
          )}
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-300">Bio *</label>
            <button type="button" onClick={() => openImprove('teamBio', 'Team Member Bio', formData.bio || '', v => { setFormData(p => ({ ...p, bio: v })); setErrors(prev => ({ ...prev, bio: '' })); applyHighlight(['bio']); })} title="AI Improve" className="inline-flex items-center justify-center w-5 h-5 rounded text-purple-400/50 hover:text-purple-300 hover:bg-purple-500/15 transition-all">
              <Sparkles className="w-3 h-3" />
            </button>
          </div>
          <Textarea
            placeholder="Brief bio about the team member"
            value={formData.bio || ''}
            onChange={(e) => {
              setFormData({ ...formData, bio: e.target.value });
              setErrors(prev => ({ ...prev, bio: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${errors.bio ? 'border-red-500' : ''} ${hlClass('bio')}`}
            rows={3}
          />
          {errors.bio && (
            <p className="text-red-400 text-sm mt-1">{errors.bio}</p>
          )}
        </div>
        
        {/* Image input with toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Team Member Photo *
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setImageInputMode('url')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                imageInputMode === 'url'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              Paste URL
            </button>
            <button
              type="button"
              onClick={() => setImageInputMode('upload')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                imageInputMode === 'upload'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              Upload File
            </button>
          </div>
          
          {imageInputMode === 'url' ? (
            <div>
              <Input
                placeholder="Image URL"
                value={formData.imageUrl}
                onChange={(e) => {
                  setFormData({ ...formData, imageUrl: e.target.value });
                  setErrors(prev => ({ ...prev, imageUrl: '' }));
                }}
                className={`bg-black/50 border-white/20 text-white ${errors.imageUrl ? 'border-red-500' : ''}`}
              />
              {errors.imageUrl && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUrl}</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => document.getElementById('teamImageUpload')?.click()}
                  disabled={uploading}
                  className="cursor-pointer bg-white/10 hover:bg-white/20 text-white"
                >
                  {uploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Image to Upload
                    </>
                  )}
                </Button>
              </div>
              <input
                type="file"
                id="teamImageUpload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {uploadSuccess && !errors.imageUpload && (
                <p className="text-xs text-green-400 mt-2">✓ Image uploaded successfully</p>
              )}
              {errors.imageUpload && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUpload}</p>
              )}
              {errors.imageUrl && !errors.imageUpload && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUrl}</p>
              )}
            </div>
          )}
        </div>
        
        {/* Social Media Links */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Social Media Links (optional)
          </label>
          
          <div>
            <Input
              placeholder="LinkedIn URL"
              value={formData.socialLinks?.linkedin || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, linkedin: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
          
          <div>
            <Input
              placeholder="Instagram URL"
              value={formData.socialLinks?.instagram || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, instagram: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
          
          <div>
            <Input
              placeholder="Behance URL"
              value={formData.socialLinks?.behance || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, behance: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
          
          <div>
            <Input
              placeholder="Dribbble URL"
              value={formData.socialLinks?.dribbble || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, dribbble: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
        </div>
        
        {/* Inline form message */}
        {formMessage && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            formMessage.type === 'success'
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}>
            <span>{formMessage.type === 'success' ? '✓' : '✗'}</span>
            <span>{formMessage.text}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent cursor-pointer">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
      {activeImprove && (
        <AIImproveModal
          fieldLabel={activeImprove.fieldLabel}
          fieldKey={activeImprove.fieldKey}
          currentValue={activeImprove.currentValue}
          context={{ entityType: 'team', name: formData.name || 'Team Member', role: formData.role || '' }}
          onApply={activeImprove.onApply}
          onClose={() => setActiveImprove(null)}
        />
      )}
    </div>
  );
}

// ========== SETTINGS FORM ==========

function SettingsForm({
  settings,
  onSave,
  onCancel,
}: {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    ...settings,
    heroVideoUrl: settings.heroVideoUrl || '',
    aboutText: settings.aboutText || '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [geminiTest, setGeminiTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'err'; message: string }>({ status: 'idle', message: '' });

  const handleTestGemini = async () => {
    const key = formData.geminiApiKey?.trim();
    const model = formData.geminiModel || 'gemini-2.5-flash';
    if (!key) {
      setGeminiTest({ status: 'err', message: 'Enter an API key first.' });
      return;
    }
    setGeminiTest({ status: 'testing', message: 'Testing…' });
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with just the word OK.' }] }] }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        setGeminiTest({ status: 'err', message: errMsg });
      } else {
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        setGeminiTest({ status: 'ok', message: `Working — model replied: "${reply.trim().slice(0, 60)}"` });
      }
    } catch (err: any) {
      setGeminiTest({ status: 'err', message: err.message || 'Network error' });
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFavicon(true);
    setErrors(prev => ({ ...prev, faviconUpload: '' }));

    try {
      const token = localStorage.getItem('admin_token');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(`${API_BASE}/upload-favicon`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: uploadFormData,
      });

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({ ...prev, faviconUrl: result.data.url }));
        setErrors(prev => ({ ...prev, faviconUpload: '' }));
      } else {
        setErrors(prev => ({ ...prev, faviconUpload: `Upload failed: ${result.error}` }));
      }
    } catch (error) {
      console.error('Favicon upload error:', error);
      setErrors(prev => ({ ...prev, faviconUpload: 'Failed to upload favicon. Please try again.' }));
    } finally {
      setUploadingFavicon(false);
    }
  };



  return (
    <div className="mb-6 p-6 bg-white/10 rounded-lg border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4">
        Edit Settings
      </h3>
      <div className="space-y-4">

        {/* Favicon Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Site Favicon
          </label>
          <div className="flex items-center gap-4">
            {formData.faviconUrl ? (
              <div className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-lg">
                <img
                  src={formData.faviconUrl}
                  alt="Current favicon"
                  className="w-10 h-10 rounded object-contain bg-white/10 p-1"
                />
                <div>
                  <p className="text-xs text-gray-400">Current favicon</p>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, faviconUrl: '' }))}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors mt-0.5"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-white/5 border border-dashed border-white/20">
                <span className="text-2xl">🌐</span>
              </div>
            )}
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors">
                {uploadingFavicon ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {formData.faviconUrl ? 'Replace Favicon' : 'Upload Favicon'}
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml"
                  className="hidden"
                  onChange={handleFaviconUpload}
                  disabled={uploadingFavicon}
                />
              </label>
              <p className="text-xs text-gray-500 mt-1.5">PNG, JPG, WEBP, ICO or SVG · max 1 MB</p>
              {errors.faviconUpload && (
                <p className="text-xs text-red-400 mt-1">{errors.faviconUpload}</p>
              )}
            </div>
          </div>
        </div>

        {/* SEO Global Settings */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Global SEO Defaults</h4>
          <p className="text-sm text-gray-400 mb-4">Used across all pages in the SEO Manager as automatic fallbacks.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Site URL</label>
              <Input
                placeholder="https://fastoosh.com"
                value={formData.siteUrl || ''}
                onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Used to auto-generate canonical URLs (e.g. https://fastoosh.com/tools).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Default OG Image URL</label>
              <Input
                placeholder="https://fastoosh.com/og-default.jpg"
                value={formData.defaultOgImage || ''}
                onChange={(e) => setFormData({ ...formData, defaultOgImage: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">1200×630px recommended. Used as fallback when no page-specific OG image is set.</p>
              {formData.defaultOgImage && (
                <img
                  src={formData.defaultOgImage}
                  alt="OG preview"
                  className="mt-2 rounded-lg max-h-24 border border-white/10 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Contact Email Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Contact Email</h4>
          <p className="text-sm text-gray-400 mb-3">
            Displayed in the footer "Get in touch" section and used as the public contact address sitewide.
          </p>
          <Input
            placeholder="hello@fastoosh.com"
            value={formData.contactEmail || ''}
            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            className="bg-black/50 border-white/20 text-white"
          />
        </div>

        {/* Password Reset Reply-To Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Password Reset Reply-To</h4>
          <p className="text-sm text-gray-400 mb-3">
            When a user receives the branded password-reset email and hits "Reply", their message
            will be directed to this address. Leave blank to omit a reply-to header.
          </p>
          <Input
            placeholder="support@fastoosh.com"
            type="email"
            value={formData.emailReplyTo || ''}
            onChange={(e) => setFormData({ ...formData, emailReplyTo: e.target.value })}
            className="bg-black/50 border-white/20 text-white"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Example: <span className="text-gray-400">support@fastoosh.com</span> or your personal inbox
          </p>
        </div>

        {/* Calendly URL Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Calendly Booking URL</h4>
          <p className="text-sm text-gray-400 mb-3">
            The scheduling link shown on the "Work with us" page. Copy it from your Calendly dashboard.
          </p>
          <Input
            placeholder="https://calendly.com/your-name/discovery-call"
            value={formData.calendlyUrl || ''}
            onChange={(e) => setFormData({ ...formData, calendlyUrl: e.target.value })}
            className="bg-black/50 border-white/20 text-white"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Example: <span className="text-gray-400">https://calendly.com/fastoosh/discovery-call</span>
          </p>
        </div>

        {/* Social Media Links Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-4">Social Media Links</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                LinkedIn URL
              </label>
              <Input
                placeholder="https://www.linkedin.com/company/fastoosh"
                value={formData.socialLinks?.linkedin || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, linkedin: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Instagram URL
              </label>
              <Input
                placeholder="https://www.instagram.com/fastoosh"
                value={formData.socialLinks?.instagram || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, instagram: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                X (Twitter) URL
              </label>
              <Input
                placeholder="https://x.com/fastoosh"
                value={formData.socialLinks?.twitter || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, twitter: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Dribbble URL
              </label>
              <Input
                placeholder="https://dribbble.com/fastoosh"
                value={formData.socialLinks?.dribbble || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, dribbble: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Behance URL
              </label>
              <Input
                placeholder="https://www.behance.net/fastoosh"
                value={formData.socialLinks?.behance || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, behance: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                TikTok URL
              </label>
              <Input
                placeholder="https://www.tiktok.com/@fastoosh"
                value={formData.socialLinks?.tiktok || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, tiktok: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
          </div>
        </div>
        
        {/* Gemini AI Settings */}
        <div className="pt-4 border-t border-white/10">
          <h4 className="text-white font-semibold mb-3">Gemini AI</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={formData.geminiApiKey || ''}
                  onChange={(e) => { setFormData({ ...formData, geminiApiKey: e.target.value }); setGeminiTest({ status: 'idle', message: '' }); }}
                  className="bg-black/50 border-white/20 text-white font-mono flex-1"
                />
                <Button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={geminiTest.status === 'testing'}
                  className="cursor-pointer bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs px-3 shrink-0"
                >
                  {geminiTest.status === 'testing' ? '…' : 'Test'}
                </Button>
              </div>
              {geminiTest.status !== 'idle' && (
                <p className={`text-xs mt-1 ${geminiTest.status === 'ok' ? 'text-emerald-400' : geminiTest.status === 'err' ? 'text-red-400' : 'text-white/40'}`}>
                  {geminiTest.status === 'ok' ? '✓ ' : geminiTest.status === 'err' ? '✗ ' : ''}{geminiTest.message}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-1">Overrides the GEMINI_API_KEY environment variable. Switch keys when you hit quota limits.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Model
              </label>
              <Input
                type="text"
                placeholder="gemini-2.5-flash"
                value={formData.geminiModel || ''}
                onChange={(e) => { setFormData({ ...formData, geminiModel: e.target.value }); setGeminiTest({ status: 'idle', message: '' }); }}
                className="bg-black/50 border-white/20 text-white font-mono"
              />
              <p className="text-gray-500 text-xs mt-1">Enter the exact model ID from your Gemini API page. Use the Test button above to verify it works.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-white/10">
          <Button onClick={() => onSave(formData)} className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" onClick={onCancel} className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent cursor-pointer">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}