import { useState, useEffect } from 'react';
import React from 'react';
import { useNavigate } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { GlassCard } from '../components/shared/GlassCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { AdminSelect } from '../components/admin/AdminSelect';
import { Plus, Pencil, Trash2, Save, X, LogOut, Upload, Sparkles } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { ToolFormNew } from '../components/admin/ToolFormNew';
import { LeadsTab } from '../components/admin/LeadsTab';
import { SeoTab } from '../components/admin/SeoTab';
import { HomeTab } from '../components/admin/HomeTab';
import { AdminReviewsTab } from '../components/admin/AdminReviewsTab';
import { DashboardTab } from '../components/admin/DashboardTab';
import { invalidateSiteSettingsCache } from '../components/shared/SeoHead';
import { StyleTab } from '../components/admin/StyleTab';

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
  projectCategories?: string[];
  toolCategories?: string[];
  toolStatuses?: { label: string; color: string }[];
  socialLinks?: {
    linkedin?: string;
    instagram?: string;
    twitter?: string;
    dribbble?: string;
    behance?: string;
    tiktok?: string;
  };
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
  const [authChecking, setAuthChecking] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

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
      
      console.log('Checking auth with token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      if (!token) {
        console.log('No token found, redirecting to login');
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
          console.warn('Token rejected by server:', body.error || res.status, '— clearing token');
          localStorage.removeItem('admin_token');
          navigate('/admin/login');
        } else if (attempt < 1) {
          console.warn('Server error during auth check, retrying in 2 s…', res.status);
          setTimeout(() => checkAuth(attempt + 1), 2000);
        } else {
          console.error('Auth check: server error after retry', res.status);
          setNetworkError(true);
          setAuthChecking(false);
        }
        return;
      }

      console.log('Token validated ✅, user is authenticated');
      setNetworkError(false);
      setAuthChecking(false);
      loadData();
    } catch (error) {
      // Network-level failure (edge function cold-start, brief redeployment, etc.)
      // Do NOT clear the token — the session may still be valid once the server recovers.
      console.warn(`Auth check network error (attempt ${attempt}):`, error);
      if (attempt < 1) {
        console.log('Retrying auth check in 2 s…');
        setTimeout(() => checkAuth(attempt + 1), 2000);
      } else {
        console.error('Auth check failed after retry — showing network error screen');
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, toolsRes, teamRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/projects`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${API_BASE}/tools`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${API_BASE}/team`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${API_BASE}/settings`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
      ]);

      const projectsData = await projectsRes.json();
      const toolsData = await toolsRes.json();
      const teamData = await teamRes.json();
      const settingsData = await settingsRes.json();

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
    }
    setLoading(false);
  };

  const getAuthHeaders = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      console.error('No authentication token found');
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
      console.log('Saving project:', project);

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

      console.log('Save response status:', response.status);
      const result = await response.json();
      console.log('Save result:', JSON.stringify(result, null, 2));
      
      if (response.status === 401) {
        console.error('Authentication failed - token may have expired');
        localStorage.removeItem('admin_token');
        navigate('/admin/login');
        return { success: false, message: 'Session expired. Please log in again.' };
      }
      
      if (result.success) {
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
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  // ========== TOOL HANDLERS ==========

  const saveTool = async (tool: Tool): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('Attempting to save tool:', tool);
      
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

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        return { success: false, message: `Error saving tool: HTTP ${response.status} - ${errorText}` };
      }
      
      const result = await response.json();
      console.log('Response data:', result);
      
      if (result.success) {
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
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting tool:', error);
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
      <div className="min-h-screen bg-black/80 p-6"
        style={{ '--fastoosh-card-bg': 'rgba(255,255,255,0.03)', '--fastoosh-card-dark': 'rgba(0,0,0,0.95)' } as React.CSSProperties}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-gray-400">Manage your Fastoosh content</p>
          </div>
          <Button onClick={handleSignOut} variant="outline" className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard">
            <DashboardTab />
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

              {editingProject && (
                <ProjectForm
                  project={editingProject}
                  onSave={saveProject}
                  onCancel={() => setEditingProject(null)}
                  categories={settings.projectCategories || ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Other']}
                />
              )}

              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex justify-between items-center p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div>
                      <h3 className="text-white font-semibold">{project.title}</h3>
                      <p className="text-gray-400 text-sm">
                        {project.category} • {project.year}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingProject(project)}
                        className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent group cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteProject(project.id)}
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

              {editingTool && (
                <ToolFormNew
                  tool={editingTool}
                  onSave={saveTool}
                  onCancel={() => setEditingTool(null)}
                  statuses={(settings.toolStatuses || []).map(s => s.label)}
                />
              )}

              <div className="space-y-4">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex justify-between items-center p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div>
                      <h3 className="text-white font-semibold">{tool.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {tool.category} • {tool.versions?.length || 0} version(s)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTool(tool)}
                        className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent group cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTool(tool.id)}
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

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-2">Project Categories</h3>
                  {settings.projectCategories && settings.projectCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.projectCategories.map((cat) => (
                        <span key={cat} className="px-2 py-1 bg-purple-900/30 border border-purple-500/30 rounded-full text-xs text-purple-300">
                          {cat}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No categories defined yet. Click "Edit Settings" to add them.</p>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-2">Tool Categories</h3>
                  {settings.toolCategories && settings.toolCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.toolCategories.map((cat) => (
                        <span key={cat} className="px-2 py-1 bg-purple-900/30 border border-purple-500/30 rounded-full text-xs text-purple-300">
                          {cat}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No categories defined yet. Click "Edit Settings" to add them.</p>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-white font-semibold mb-2">Tool Statuses</h3>
                  {settings.toolStatuses && settings.toolStatuses.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.toolStatuses.map((status) => {
                        const gradientMap: Record<string, string> = {
                          purple: 'from-purple-500 to-violet-500',
                          green:  'from-green-500 to-emerald-500',
                          amber:  'from-yellow-500 to-orange-500',
                          cyan:   'from-cyan-500 to-blue-400',
                          pink:   'from-pink-500 to-fuchsia-500',
                          red:    'from-red-500 to-rose-400',
                        };
                        const gradient = gradientMap[status.color] || 'from-purple-500 to-violet-500';
                        return (
                          <span
                            key={status.label}
                            className={`px-2 py-1 bg-gradient-to-r ${gradient} rounded-full text-xs text-white font-medium`}
                          >
                            {status.label}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No statuses defined yet. Click "Edit Settings" to add them.</p>
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
                  <h3 className="text-white font-semibold mb-1">Calendly Booking URL</h3>
                  <p className="text-gray-400 text-sm">{settings.calendlyUrl || 'Not set'}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Used on the "Work with us" page for the discovery call booking widget.</p>
                </div>
                
              </div>
            </GlassCard>
          </TabsContent>

          {/* LEADS TAB */}
          <TabsContent value="leads">
            <LeadsTab />
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

        </Tabs>
      </div>
    </div>
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
  const [screenshotsInputMode, setScreenshotsInputMode] = useState<'url' | 'upload'>('url');
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
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number | null>(null);

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
      
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
    console.log('ProjectForm - Save button clicked');
    console.log('ProjectForm - Form data:', formData);
    
    if (validateForm()) {
      console.log('ProjectForm - Validation passed, calling onSave');
      setSaving(true);
      setFormMessage(null);
      const result = await onSave(formData);
      setSaving(false);
      setFormMessage({ type: result.success ? 'success' : 'error', text: result.message });
      if (result.success) {
        setTimeout(() => onCancel(), 1500);
      }
    } else {
      console.log('ProjectForm - Validation failed. Errors:', errors);
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
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Short Description *
          </label>
          <div className="relative">
            <Textarea
              placeholder="Brief description shown on project cards"
              value={formData.description || ''}
              onChange={(e) => {
                if (e.target.value.length <= 250) {
                  setFormData({ ...formData, description: e.target.value });
                  setErrors(prev => ({ ...prev, description: '' }));
                }
              }}
              className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${errors.description ? 'border-red-500' : ''} ${hlClass('description')}`}
              rows={3}
            />
            <span className={`absolute bottom-2 right-3 text-xs tabular-nums pointer-events-none transition-colors ${(formData.description?.length ?? 0) >= 230 ? 'text-amber-400' : 'text-white/25'}`}>
              {formData.description?.length ?? 0}/250
            </span>
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
              <Button
                type="button"
                onClick={() => {
                  if (!formData.videoUrl) {
                    setFormMessage({ type: 'error', text: 'Please enter a video URL before capturing thumbnails.' });
                    return;
                  }
                  setFormMessage(null);
                  setShowVideoCapture(true);
                  // Don't reset captured frames - keep them so user can add more
                  // setCapturedFrames([]);
                }}
                className="cursor-pointer bg-gradient-to-r from-purple-600 to-blue-600 text-white whitespace-nowrap"
              >
                Capture Thumbnails
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Enter a YouTube or Vimeo URL above, then click "Capture Thumbnails" to watch and capture frames
            </p>
          </div>
        </div>
        
        {/* Video Thumbnail Capture Tool */}
        {showVideoCapture && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-black/95 border border-white/20 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Capture Video Thumbnails</h3>
                  <p className="text-sm text-gray-400 mt-1">Play the video and click "Capture Frame" at your desired moments</p>
                </div>
                <button
                  onClick={() => {
                    setShowVideoCapture(false);
                  }}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Video Player Section */}
                <div>
                  <div className="bg-black rounded-lg overflow-hidden mb-4" style={{ height: '400px' }}>
                    {(() => {
                      const url = formData.videoUrl;
                      
                      // Check if it's a direct video file URL (.mp4, .webm, etc.)
                      if (url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov') || url.endsWith('.avi') || url.includes('.mp4?') || url.includes('.webm?'))) {
                        return (
                          <video
                            id="captureVideo"
                            src={url}
                            controls
                            crossOrigin="anonymous"
                            className="w-full h-full"
                          />
                        );
                      }
                      
                      // Check if it's YouTube
                      if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
                        const videoId = url.includes('youtu.be') 
                          ? url.split('youtu.be/')[1]?.split('?')[0]
                          : url.split('v=')[1]?.split('&')[0];
                        
                        if (videoId) {
                          return (
                            <iframe
                              id="videoFrame"
                              src={`https://www.youtube.com/embed/${videoId}`}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          );
                        }
                      }
                      
                      // Check if it's Vimeo
                      if (url && url.includes('vimeo.com')) {
                        const videoId = url.split('vimeo.com/')[1]?.split('?')[0]?.split('/').pop();
                        
                        if (videoId) {
                          return (
                            <iframe
                              id="videoFrame"
                              src={`https://player.vimeo.com/video/${videoId}`}
                              className="w-full h-full"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                            />
                          );
                        }
                      }
                      
                      // Default: show placeholder
                      return (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <div className="text-center">
                            <p>Video preview</p>
                            <p className="text-sm mt-2">Enter a video URL above</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Capture Button */}
                  <Button
                    type="button"
                    disabled={capturedFrames.length >= 10}
                    onClick={async () => {
                      const url = formData.videoUrl;
                      
                      // Check if it's YouTube - fetch auto-generated thumbnails
                      if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
                        const videoId = url.includes('youtu.be') 
                          ? url.split('youtu.be/')[1]?.split('?')[0]
                          : url.split('v=')[1]?.split('&')[0];
                        
                        if (videoId) {
                          // YouTube provides multiple auto-generated thumbnails
                          const thumbnails = [
                            `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                            `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
                            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                            `https://img.youtube.com/vi/${videoId}/0.jpg`,
                            `https://img.youtube.com/vi/${videoId}/1.jpg`,
                            `https://img.youtube.com/vi/${videoId}/2.jpg`,
                            `https://img.youtube.com/vi/${videoId}/3.jpg`,
                          ];
                          
                          // Load all thumbnails
                          setCapturedFrames(thumbnails);
                          return;
                        }
                      }
                      
                      // Check if it's Vimeo - use Vimeo API
                      if (url && url.includes('vimeo.com')) {
                        const videoId = url.split('vimeo.com/')[1]?.split('?')[0]?.split('/').pop();
                        
                        if (videoId) {
                          try {
                            const response = await fetch(`https://vimeo.com/api/v2/video/${videoId}.json`);
                            const data = await response.json();
                            
                            if (data && data[0]) {
                              const thumbnails = [
                                data[0].thumbnail_large,
                                data[0].thumbnail_medium,
                                data[0].thumbnail_small,
                              ].filter(Boolean);
                              
                              setCapturedFrames(thumbnails);
                              return;
                            }
                          } catch (error) {
                            alert('Failed to load Vimeo thumbnails. The video might be private.');
                            return;
                          }
                        }
                      }
                      
                      // Try to capture from video element (for direct video URLs)
                      const video = document.getElementById('captureVideo') as HTMLVideoElement;
                      if (!video) {
                        alert('Video not loaded. Please enter a direct video file URL (.mp4, .webm, .mov, .avi)');
                        return;
                      }
                      
                      // Create canvas
                      const canvas = document.createElement('canvas');
                      canvas.width = video.videoWidth || 1280;
                      canvas.height = video.videoHeight || 720;
                      
                      const ctx = canvas.getContext('2d');
                      if (!ctx) {
                        alert('Failed to create canvas context');
                        return;
                      }
                      
                      // Draw current frame
                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                      
                      // Convert to data URL
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                      
                      // Add to captured frames
                      setCapturedFrames(prev => [...prev, dataUrl]);
                    }}
                    className="w-full cursor-pointer bg-gradient-to-r from-purple-600 to-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formData.videoUrl && (formData.videoUrl.includes('youtube.com') || formData.videoUrl.includes('youtu.be'))
                      ? '📥 Load YouTube Thumbnails'
                      : formData.videoUrl && formData.videoUrl.includes('vimeo.com')
                      ? '📥 Load Vimeo Thumbnails'
                      : `📸 Capture Current Frame (${capturedFrames.length}/10)`}
                  </Button>
                  
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    {formData.videoUrl && (formData.videoUrl.includes('youtube.com') || formData.videoUrl.includes('youtu.be'))
                      ? 'Click to load YouTube\'s auto-generated thumbnail options'
                      : formData.videoUrl && formData.videoUrl.includes('vimeo.com')
                      ? 'Click to load Vimeo\'s generated thumbnails'
                      : 'Play the video and pause at desired moments to capture frames'}
                  </p>
                </div>
                
                {/* Captured Thumbnails Section */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-white font-semibold">Captured Thumbnails ({capturedFrames.length})</h4>
                    {capturedFrames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Clear all captured thumbnails?')) {
                            setCapturedFrames([]);
                            setSelectedThumbnailIndex(null);
                          }
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  {capturedFrames.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <p>No frames captured yet</p>
                      <p className="text-sm mt-2">Load thumbnails or capture frames from your video</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                      {capturedFrames.map((frame, index) => {
                        const isSelected = selectedThumbnailIndex === index;
                        console.log(`Frame ${index}: isSelected=${isSelected}, selectedThumbnailIndex=${selectedThumbnailIndex}`);
                        return (
                          <div
                            key={index}
                            className={`relative group border-2 rounded-lg overflow-hidden transition-all ${
                              isSelected 
                                ? 'border-purple-500 shadow-lg shadow-purple-500/50' 
                                : 'border-white/10 hover:border-purple-500'
                            }`}
                          >
                            <img
                              src={frame}
                              alt={`Captured frame ${index + 1}`}
                              className="w-full cursor-pointer"
                              onClick={() => {
                                console.log('Thumbnail clicked! Index:', index, 'Frame URL:', frame);
                                console.log('Current formData.imageUrl:', formData.imageUrl);
                                console.log('Current selectedThumbnailIndex:', selectedThumbnailIndex);
                                
                                setFormData({ ...formData, imageUrl: frame });
                                setErrors(prev => ({ ...prev, imageUrl: '' }));
                                setSelectedThumbnailIndex(index);
                                
                                console.log('After update - selectedThumbnailIndex should be:', index);
                              }}
                            />
                            {/* Selected Badge */}
                            {isSelected && (
                              <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                                ✓ Selected
                              </div>
                            )}
                            {/* Delete button - always visible on mobile, hover on desktop */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCapturedFrames(prev => prev.filter((_, i) => i !== index));
                                // Reset selected index if we delete the selected thumbnail
                                if (selectedThumbnailIndex === index) {
                                  setSelectedThumbnailIndex(null);
                                } else if (selectedThumbnailIndex !== null && selectedThumbnailIndex > index) {
                                  // Adjust selected index if we delete a thumbnail before the selected one
                                  setSelectedThumbnailIndex(selectedThumbnailIndex - 1);
                                }
                              }}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            {/* Overlay with "Click to Select" text */}
                            {!isSelected && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 pointer-events-none">
                                <span className="text-white text-sm font-semibold">Click to Select</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tags
          </label>
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Client Name (Optional)
              </label>
              <Input
                placeholder="e.g., TechCorp Financial"
                value={formData.client || ''}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Goal (Optional)
              </label>
              <Textarea
                placeholder="Describe the project goal and objectives"
                value={formData.goal || ''}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('goal')}`}
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Approach (Optional)
              </label>
              <Textarea
                placeholder="Explain the creative approach and process"
                value={formData.approach || ''}
                onChange={(e) => setFormData({ ...formData, approach: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('approach')}`}
                rows={3}
              />
            </div>
          
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deliverables (Optional)
              </label>
              <Textarea
                placeholder="Enter each deliverable on a new line&#10;e.g.:&#10;90-second explainer video&#10;Social media cutdowns&#10;Brand guidelines"
                value={(formData.deliverables || []).join('\n')}
                onChange={(e) => setFormData({ ...formData, deliverables: e.target.value.split('\n') })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('deliverables')}`}
                rows={4}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Outcome (Optional)
              </label>
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
                Screenshots / Additional Images (Optional)
              </label>
              
              {/* Toggle between URL and Upload */}
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setScreenshotsInputMode('url')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    screenshotsInputMode === 'url'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}
                >
                  Paste URLs
                </button>
                <button
                  type="button"
                  onClick={() => setScreenshotsInputMode('upload')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    screenshotsInputMode === 'upload'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}
                >
                  Upload Files
                </button>
              </div>
              
              {screenshotsInputMode === 'url' ? (
                <Textarea
                  placeholder="Enter image URLs (one per line)&#10;e.g.:&#10;https://images.unsplash.com/photo-xxx&#10;https://images.unsplash.com/photo-yyy"
                  value={(formData.screenshots || []).join('\n')}
                  onChange={(e) => setFormData({ ...formData, screenshots: e.target.value.split('\n') })}
                  className="bg-black/50 border-white/20 text-white"
                  rows={4}
                />
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => document.getElementById('screenshotsUpload')?.click()}
                      disabled={uploadingScreenshots}
                      className="cursor-pointer bg-white/10 hover:bg-white/20 text-white"
                    >
                      {uploadingScreenshots ? (
                        <>Uploading...</>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Select Multiple Screenshots
                        </>
                      )}
                    </Button>
                  </div>
                  <input
                    type="file"
                    id="screenshotsUpload"
                    accept="image/*"
                    multiple
                    onChange={handleScreenshotsUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    You can select multiple images at once
                  </p>
                  {errors.screenshotsUpload && (
                    <p className="text-red-400 text-sm mt-1">{errors.screenshotsUpload}</p>
                  )}
                </div>
              )}
              
              {/* Show current screenshots with remove button */}
              {formData.screenshots && formData.screenshots.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-400">Current Screenshots ({formData.screenshots.length}):</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {formData.screenshots.map((url, index) => (
                      <div key={index} className="flex items-center gap-2 bg-black/30 p-2 rounded">
                        <img 
                          src={url} 
                          alt={`Screenshot ${index + 1}`} 
                          className="w-16 h-16 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className="text-xs text-gray-400 flex-1 truncate">{url}</span>
                        <Button
                          type="button"
                          onClick={() => removeScreenshot(index)}
                          variant="destructive"
                          size="sm"
                          className="cursor-pointer text-white"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
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
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Role *
          </label>
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
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bio *
          </label>
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
  const [newCategory, setNewCategory] = useState('');
  const [newToolCategory, setNewToolCategory] = useState('');
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('purple');

  const STATUS_COLOR_OPTIONS = [
    { name: 'purple', label: 'Purple', classes: 'from-purple-500 to-violet-500' },
    { name: 'green',  label: 'Green',  classes: 'from-green-500 to-emerald-500' },
    { name: 'amber',  label: 'Amber',  classes: 'from-yellow-500 to-orange-500' },
    { name: 'cyan',   label: 'Cyan',   classes: 'from-cyan-500 to-blue-400' },
    { name: 'pink',   label: 'Pink',   classes: 'from-pink-500 to-fuchsia-500' },
    { name: 'red',    label: 'Red',    classes: 'from-red-500 to-rose-400' },
  ];

  const addStatus = () => {
    const trimmed = newStatusLabel.trim();
    if (!trimmed) return;
    const existing = formData.toolStatuses || [];
    if (existing.some(s => s.label === trimmed)) return;
    setFormData({ ...formData, toolStatuses: [...existing, { label: trimmed, color: newStatusColor }] });
    setNewStatusLabel('');
    setNewStatusColor('purple');
  };

  const removeStatus = (index: number) => {
    const existing = formData.toolStatuses || [];
    setFormData({ ...formData, toolStatuses: existing.filter((_, i) => i !== index) });
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    const existing = formData.projectCategories || [];
    if (existing.includes(trimmed)) return;
    setFormData({ ...formData, projectCategories: [...existing, trimmed] });
    setNewCategory('');
  };

  const addToolCategory = () => {
    const trimmed = newToolCategory.trim();
    if (!trimmed) return;
    const existing = formData.toolCategories || [];
    if (existing.includes(trimmed)) return;
    setFormData({ ...formData, toolCategories: [...existing, trimmed] });
    setNewToolCategory('');
  };

  const removeToolCategory = (index: number) => {
    const existing = formData.toolCategories || [];
    setFormData({ ...formData, toolCategories: existing.filter((_, i) => i !== index) });
  };

  const removeCategory = (index: number) => {
    const existing = formData.projectCategories || [];
    setFormData({ ...formData, projectCategories: existing.filter((_, i) => i !== index) });
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
        
        {/* Project Categories Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Project Categories</h4>
          <p className="text-sm text-gray-400 mb-3">
            These appear in the category dropdown when adding or editing a project.
          </p>
          {/* Existing category tags */}
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {(formData.projectCategories || []).length === 0 && (
              <p className="text-gray-500 text-sm italic">No categories yet — add one below.</p>
            )}
            {(formData.projectCategories || []).map((cat, index) => (
              <span
                key={cat}
                className="flex items-center gap-1 pl-3 pr-1.5 py-1 bg-purple-900/40 border border-purple-500/40 rounded-full text-sm text-white"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => removeCategory(index)}
                  className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors"
                  title={`Remove "${cat}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          {/* Add new category */}
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Motion Design"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
              className="bg-black/50 border-white/20 text-white"
            />
            <Button
              type="button"
              onClick={addCategory}
              className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Tool Categories Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Tool Categories</h4>
          <p className="text-sm text-gray-400 mb-3">
            These appear in the category dropdown when adding or editing a tool.
          </p>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {(formData.toolCategories || []).length === 0 && (
              <p className="text-gray-500 text-sm italic">No categories yet — add one below.</p>
            )}
            {(formData.toolCategories || []).map((cat, index) => (
              <span
                key={cat}
                className="flex items-center gap-1 pl-3 pr-1.5 py-1 bg-purple-900/40 border border-purple-500/40 rounded-full text-sm text-white"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => removeToolCategory(index)}
                  className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-white/50 hover:text-red-400 hover:bg-white/10 transition-colors"
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
              value={newToolCategory}
              onChange={(e) => setNewToolCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToolCategory(); } }}
              className="bg-black/50 border-white/20 text-white"
            />
            <Button
              type="button"
              onClick={addToolCategory}
              className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Tool Statuses Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Tool Statuses</h4>
          <p className="text-sm text-gray-400 mb-3">
            These appear as badge pills on tool cards. Pick a label and a color for each status.
          </p>
          {/* Existing status tags */}
          <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
            {(formData.toolStatuses || []).length === 0 && (
              <p className="text-gray-500 text-sm italic">No statuses yet — add one below.</p>
            )}
            {(formData.toolStatuses || []).map((status, index) => {
              const colorOption = STATUS_COLOR_OPTIONS.find(c => c.name === status.color);
              return (
                <span
                  key={status.label}
                  className={`flex items-center gap-1 pl-3 pr-1.5 py-1 bg-gradient-to-r ${colorOption?.classes || 'from-purple-500 to-violet-500'} rounded-full text-sm text-white font-medium`}
                >
                  {status.label}
                  <button
                    type="button"
                    onClick={() => removeStatus(index)}
                    className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-black/20 transition-colors"
                    title={`Remove "${status.label}"`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
          {/* Add new status */}
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              placeholder="e.g. Hot Deal"
              value={newStatusLabel}
              onChange={(e) => setNewStatusLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStatus(); } }}
              className="bg-black/50 border-white/20 text-white flex-1 min-w-[140px]"
            />
            {/* Color swatches */}
            <div className="flex gap-1.5 items-center">
              {STATUS_COLOR_OPTIONS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setNewStatusColor(color.name)}
                  title={color.label}
                  className={`w-6 h-6 rounded-full bg-gradient-to-br ${color.classes} transition-all ${
                    newStatusColor === color.name
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
            <Button
              type="button"
              onClick={addStatus}
              className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
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