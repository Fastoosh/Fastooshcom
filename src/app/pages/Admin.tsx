import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { useNavigate, useSearchParams, useBlocker } from 'react-router';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { GlassCard } from '../components/shared/GlassCard';
import { Button } from '../components/ui/button';
import { X, LogOut, Menu, Search } from 'lucide-react';
import { ActivityTab } from '../components/admin/ActivityTab';
import { UseCasesTab } from '../components/admin/UseCasesTab';
import { PageTextTab } from '../components/admin/PageTextTab';
import { RepublishButton } from '../components/admin/RepublishButton';
import { AdminSearch, type AdminSearchResult } from '../components/admin/AdminSearch';
import { publicAnonKey } from '/utils/supabase/info';
import { LeadsTab } from '../components/admin/LeadsTab';
import { LicensesTab } from '../components/admin/LicensesTab';
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
import { GuideTab } from '../components/admin/GuideTab';
import { LegalTab } from '../components/admin/LegalTab';
import { BroadcastTab } from '../components/admin/BroadcastTab';
import { ToolRequestsTab } from '../components/admin/ToolRequestsTab';
import { ScrollingGradientBackground } from '../components/shared/ScrollingGradientBackground';
import { API_BASE, createSlug, type Project, type Tool, type TeamMember, type Settings, ADMIN_NAV, ADMIN_TAB_VALUES, fetchWithRetry } from '../components/admin/adminShared';
import { SettingsTab } from '../components/admin/SettingsTab';
import { TeamTab } from '../components/admin/TeamTab';
import { ToolsTab } from '../components/admin/ToolsTab';
import { ProjectsTab } from '../components/admin/ProjectsTab';

// Admin panel shell: navigation, data loading and save handlers. Each tab's
// screen lives in components/admin (ProjectsTab, ToolsTab, SettingsTab…).
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
  // Current tab lives in the URL (?tab=leads) so refresh keeps it and the
  // browser back button moves between tabs.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam && ADMIN_TAB_VALUES.has(tabParam) ? tabParam : 'dashboard';
  const setActiveTab = useCallback((value: string) => {
    if (value === activeTab) return;
    setSearchParams({ tab: value });
  }, [activeTab, setSearchParams]);

  // Unsaved changes in the project / tool editor. Anything that would throw
  // the edits away asks first.
  const [formDirty, setFormDirty] = useState(false);
  const formDirtyRef = useRef(false);
  formDirtyRef.current = formDirty;
  const UNSAVED_MSG = 'You have unsaved changes. Leave without saving?';
  // For in-page actions (open another item, cancel, add new).
  const leaveForm = useCallback((action: () => void) => {
    if (formDirtyRef.current && !window.confirm(UNSAVED_MSG)) return;
    setFormDirty(false);
    action();
  }, []);
  // What a search result opens.
  const handleSearchPick = (r: AdminSearchResult) => {
    setNavOpen(false);
    window.scrollTo({ top: 0 });
    switch (r.kind) {
      case 'page':
        setActiveTab(r.value);
        break;
      case 'project':
        leaveForm(() => { setSearchParams({ tab: 'projects' }); setEditingProject(r.item); });
        break;
      case 'tool':
        leaveForm(() => { setSearchParams({ tab: 'tools' }); setEditingTool(r.item); });
        break;
      case 'team':
        leaveForm(() => { setSearchParams({ tab: 'team' }); setEditingTeamMember(r.item); });
        break;
      case 'lead':
        setSearchParams({ tab: 'leads', q: r.email });
        break;
      case 'license':
        setSearchParams({ tab: 'licenses', q: r.email || r.key });
        break;
    }
  };

  // For navigation (sidebar tab switch, browser back/forward, leaving /admin).
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    formDirtyRef.current &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(UNSAVED_MSG)) { setFormDirty(false); blocker.proceed(); }
    else blocker.reset();
  }, [blocker]);
  // Closing the browser tab / reloading.
  useEffect(() => {
    if (!formDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [formDirty]);
  // Phone/tablet: the sidebar becomes a slide-in drawer opened from a top bar.
  const [navOpen, setNavOpen] = useState(false);
  // Admin-wide search (Ctrl/Cmd+K)
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Close the drawer on Escape and lock page scroll while it is open.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

  // Inline category / status management (Projects & Tools tabs)
  const [newProjectCat, setNewProjectCat] = useState('');
  const [newToolCat, setNewToolCat] = useState('');
  const [newToolStatusLabel, setNewToolStatusLabel] = useState('');

  // Client logos management (Settings tab)
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
        // Admin token lets the server include secret settings (e.g. Gemini key)
        fetchWithRetry(`${API_BASE}/settings`, { headers: { ...headers, 'X-Admin-Token': localStorage.getItem('admin_token') ?? '' } }, 2),
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

  // Saves the current order. Pass an explicit id list when the order was just
  // changed in the same tick (state may not have updated yet).
  const stepProject = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= projects.length) return;
    const next = [...projects];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    setProjects(next);
    reorderProjects(next.map(p => p.id));
  };

  const reorderProjects = async (idsOverride?: string[]) => {
    try {
      const token = localStorage.getItem('admin_token');
      const projectIds = idsOverride ?? projects.map(p => p.id);
      
      
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

  const stepTool = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= tools.length) return;
    const next = [...tools];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    setTools(next);
    reorderTools(next.map(t => t.id));
  };

  const reorderTools = async (idsOverride?: string[]) => {
    try {
      const token = localStorage.getItem('admin_token');
      const toolIds = idsOverride ?? tools.map(t => t.id);
      
      
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

      // useCases / toolExtras are owned by Admin → Use cases and saved there.
      // This form holds the copy loaded when the admin opened, so sending it
      // would overwrite newer edits made in the Use cases tab.
      // Same for the page text (Admin → Page Text).
      const { useCases: _useCases, toolExtras: _toolExtras, workWithUsContent: _wwu, aboutContent: _about,
        projectsPageContent: _projectsPage, toolsPageContent: _toolsPage, ...rest } = settings as any;

      const response = await fetch(url, {
        method,
        headers: await getAuthHeaders(),
        body: JSON.stringify(rest),
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
      <AdminSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={handleSearchPick}
        pages={ADMIN_NAV.flatMap(g => g.items).map(i => ({ value: i.value, label: i.label }))}
        projects={projects}
        tools={tools}
        team={team}
      />
      <div className="flex min-h-screen"
        style={{ '--fastoosh-card-bg': 'rgba(255,255,255,0.03)', '--fastoosh-card-dark': 'rgba(0,0,0,0.95)' } as React.CSSProperties}>

        {/* ── Mobile top bar (below lg) — shows current section + menu button ── */}
        <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-3 bg-black/85 backdrop-blur-md border-b border-white/10">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="w-10 h-10 -ml-1 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10 active:bg-white/15"
            aria-label="Open admin menu"
            aria-expanded={navOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-white/35 leading-none">Admin</p>
            <p className="text-sm font-semibold text-white truncate">{ADMIN_NAV.flatMap(g => g.items).find(i => i.value === activeTab)?.label ?? 'Admin'}</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-10 h-10 -mr-1 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10 active:bg-white/15"
            aria-label="Search the admin"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer backdrop (mobile only) */}
        <div
          className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${navOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />

        {/* ── Sidebar: fixed column on desktop, slide-in drawer below lg ── */}
        <div className={`w-64 lg:w-52 flex-shrink-0 bg-[#0a0a0f] lg:bg-black/60 border-r border-white/8 flex flex-col fixed top-0 left-0 h-[100dvh] overflow-y-auto z-50 lg:z-10 transition-transform duration-200 ease-out ${navOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <div className="p-4 space-y-1 flex-1">
            <div className="px-2 pb-4 mb-2 border-b border-white/10 flex items-start justify-between">
              <div>
                <h1 className="text-base font-bold text-white">Admin Panel</h1>
                <p className="text-white/35 text-xs mt-0.5">Fastoosh</p>
              </div>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="lg:hidden w-9 h-9 -mr-2 -mt-1 flex items-center justify-center rounded-lg text-white/60 hover:bg-white/10"
                aria-label="Close admin menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setNavOpen(false); setSearchOpen(true); }}
              className="hidden lg:flex w-full items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8 text-sm"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Search</span>
              <kbd className="text-[10px] text-white/30 font-sans">Ctrl K</kbd>
            </button>

            {/* Rebuild the public site so admin edits reach Google & AI */}
            <RepublishButton onSetup={() => { setNavOpen(false); setActiveTab('settings'); }} />

            {ADMIN_NAV.map((group: any) => (
              <div key={group.label} className="pb-2">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">{group.label}</p>
                {group.items.map((item: any) => (
                  <button
                    key={item.value}
                    onClick={() => { setActiveTab(item.value); setNavOpen(false); window.scrollTo({ top: 0 }); }}
                    className={`w-full text-left px-3 py-2.5 lg:py-2 rounded-lg text-sm transition-all ${
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

        {/* ── Main content area (offset by sidebar on desktop, by top bar on mobile) ── */}
        <div className="lg:ml-52 flex-1 min-w-0 bg-black/80 min-h-screen pt-14 lg:pt-0 overflow-x-clip">
          <div className="admin-shell p-3 sm:p-5 lg:p-8">
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
          <TabsContent value="workwithus">
            <PageTextTab onOpenTranslations={page => {
              try { sessionStorage.setItem('translations_open', `pages:${page}`); } catch { /* ignore */ }
              setActiveTab('translations');
            }} />
          </TabsContent>

          <TabsContent value="usecases">
            <UseCasesTab />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityTab />
          </TabsContent>

          <TabsContent value="guide">
            <GuideTab />
          </TabsContent>

          {/* PROJECTS TAB — split pane */}
          <TabsContent value="projects">
            <ProjectsTab
              projects={projects}
              settings={settings}
              setFormDirty={setFormDirty}
              leaveForm={leaveForm}
              newProjectCat={newProjectCat}
              setNewProjectCat={setNewProjectCat}
              catSaving={catSaving}
              editingProject={editingProject}
              setEditingProject={setEditingProject}
              saveProject={saveProject}
              deleteProject={deleteProject}
              moveProject={moveProject}
              stepProject={stepProject}
              reorderProjects={reorderProjects}
              addProjectCategory={addProjectCategory}
              removeProjectCategory={removeProjectCategory}
            />
          </TabsContent>

          {/* TOOLS TAB — split pane */}
          <TabsContent value="tools">
            <ToolsTab
              tools={tools}
              settings={settings}
              setFormDirty={setFormDirty}
              leaveForm={leaveForm}
              newToolCat={newToolCat}
              setNewToolCat={setNewToolCat}
              newToolStatusLabel={newToolStatusLabel}
              setNewToolStatusLabel={setNewToolStatusLabel}
              newToolStatusColor={newToolStatusColor}
              setNewToolStatusColor={setNewToolStatusColor}
              catSaving={catSaving}
              editingTool={editingTool}
              setEditingTool={setEditingTool}
              saveTool={saveTool}
              deleteTool={deleteTool}
              moveTool={moveTool}
              stepTool={stepTool}
              reorderTools={reorderTools}
              addToolCategory={addToolCategory}
              removeToolCategory={removeToolCategory}
              addToolStatus={addToolStatus}
              removeToolStatus={removeToolStatus}
            />
          </TabsContent>

          {/* TEAM TAB */}
          <TabsContent value="team">
            <TeamTab
              team={team}
              editingTeamMember={editingTeamMember}
              setEditingTeamMember={setEditingTeamMember}
              saveTeamMember={saveTeamMember}
              deleteTeamMember={deleteTeamMember}
            />
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <SettingsTab
              settings={settings}
              setSettings={setSettings}
              editingSettings={editingSettings}
              setEditingSettings={setEditingSettings}
              saveSettings={saveSettings}
            />
          </TabsContent>

          {/* LEADS TAB */}
          <TabsContent value="leads">
            <LeadsTab />
          </TabsContent>

          {/* LICENSES TAB */}
          <TabsContent value="licenses">
            <LicensesTab />
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
