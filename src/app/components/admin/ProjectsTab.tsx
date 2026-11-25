// ProjectsTab — split out of pages/Admin.tsx.
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, X } from 'lucide-react';
import { DraggableProjectCard } from './DraggableProjectCard';
import { type Project, type Settings } from './adminShared';
import { ProjectForm } from './ProjectForm';

export interface ProjectsTabProps {
  projects: Project[];
  settings: Settings;
  setFormDirty: (dirty: boolean) => void;
  leaveForm: (action: () => void) => void;
  newProjectCat: string;
  setNewProjectCat: (v: string) => void;
  catSaving: boolean;
  editingProject: Project | null;
  setEditingProject: (p: Project | null) => void;
  saveProject: (project: Project) => Promise<{ success: boolean; message: string }>;
  deleteProject: (id: string) => void | Promise<void>;
  moveProject: (dragIndex: number, hoverIndex: number) => void;
  stepProject: (index: number, dir: -1 | 1) => void;
  reorderProjects: (idsOverride?: string[]) => void | Promise<void>;
  addProjectCategory: () => void | Promise<void>;
  removeProjectCategory: (index: number) => void | Promise<void>;
}

export function ProjectsTab({ projects, settings, setFormDirty, leaveForm, newProjectCat, setNewProjectCat, catSaving, editingProject, setEditingProject, saveProject, deleteProject, moveProject, stepProject, reorderProjects, addProjectCategory, removeProjectCategory }: ProjectsTabProps) {
  return (
    <>
    <div className="flex flex-col lg:flex-row gap-0 lg:h-[calc(100vh-4rem)] -m-3 sm:-m-5 lg:-m-8">
    
      {/* ── Left: list ── */}
      <div className={`${editingProject ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-shrink-0 flex-col lg:border-r border-white/8 lg:overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-5 py-3 lg:py-4 border-b border-white/8 sticky top-14 lg:top-0 bg-black/90 backdrop-blur-md z-10">
          <h2 className="text-base font-bold text-white">Projects</h2>
          <Button
            onClick={() => leaveForm(() => setEditingProject({
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
            }))}
            className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white h-8 px-3 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Project
          </Button>
        </div>
    
        {/* Project list */}
        <div className="flex-1 px-3 pt-4 pb-3 lg:p-3 space-y-1">
          {projects.length > 0 && (
            <p className="text-xs text-white/30 px-2 pb-2"><span className="hidden lg:inline">Drag or use ▲▼ to reorder</span><span className="lg:hidden">Use ▲▼ to reorder</span></p>
          )}
          <DndProvider backend={HTML5Backend}>
            <div className="space-y-2 lg:space-y-1">
              {projects.map((project, index) => (
                <DraggableProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  moveProject={moveProject}
                  onEdit={() => leaveForm(() => { setEditingProject(project); window.scrollTo({ top: 0 }); })}
                  onDelete={() => deleteProject(project.id)}
                  onDragEnd={() => reorderProjects()}
                  onMoveUp={index > 0 ? () => stepProject(index, -1) : undefined}
                  onMoveDown={index < projects.length - 1 ? () => stepProject(index, 1) : undefined}
                  isExpanded={editingProject?.id === project.id}
                  expandedContent={null}
                  compact
                />
              ))}
            </div>
          </DndProvider>
          {projects.length === 0 && (
            <p className="text-sm text-white/30 text-center py-8">No projects yet</p>
          )}
        </div>
    
        {/* Categories at bottom */}
        <div className="border-t border-white/8 p-4 space-y-3">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {(settings.projectCategories || []).map((cat, index) => (
              <span key={cat} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-purple-900/40 border border-purple-500/40 rounded-full text-xs text-white">
                {cat}
                <button type="button" onClick={() => removeProjectCategory(index)} disabled={catSaving} className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-white/40 hover:text-red-400 transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input placeholder="New category" value={newProjectCat} onChange={(e) => setNewProjectCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProjectCategory(); } }} className="bg-black/50 border-white/20 text-white text-xs h-7" disabled={catSaving} />
            <Button type="button" onClick={addProjectCategory} disabled={catSaving || !newProjectCat.trim()} className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white h-7 px-2 text-xs">
              {catSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-3 h-3" />}
            </Button>
          </div>
        </div>
      </div>
    
      {/* ── Right: form (full screen on mobile, with a back bar) ── */}
      <div className={`${editingProject ? 'block' : 'hidden lg:block'} flex-1 min-w-0 lg:overflow-y-auto`}>
        {editingProject ? (
          <div className="p-3 sm:p-5 lg:p-6">
            <button
              type="button"
              onClick={() => leaveForm(() => { setEditingProject(null); window.scrollTo({ top: 0 }); })}
              className="lg:hidden mb-3 -ml-1 flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8"
            >
              <span aria-hidden="true">←</span> All projects
            </button>
            <ProjectForm
              key={editingProject.id}
              project={editingProject}
              onSave={saveProject}
              onCancel={() => leaveForm(() => setEditingProject(null))}
              onDirtyChange={setFormDirty}
              categories={settings.projectCategories || ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Other']}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">Select a project to edit</p>
            <p className="text-white/20 text-xs mt-1">or click Add Project to create a new one</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
