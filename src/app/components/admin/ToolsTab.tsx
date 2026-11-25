// ToolsTab — split out of pages/Admin.tsx.
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, X } from 'lucide-react';
import { ToolFormNew } from './ToolFormNew';
import { DraggableToolCard } from './DraggableToolCard';
import { STATUS_COLOR_OPTIONS, type Tool, type Settings } from './adminShared';

export interface ToolsTabProps {
  tools: Tool[];
  settings: Settings;
  setFormDirty: (dirty: boolean) => void;
  leaveForm: (action: () => void) => void;
  newToolCat: string;
  setNewToolCat: (v: string) => void;
  newToolStatusLabel: string;
  setNewToolStatusLabel: (v: string) => void;
  newToolStatusColor: string;
  setNewToolStatusColor: (v: string) => void;
  catSaving: boolean;
  editingTool: Tool | null;
  setEditingTool: (t: Tool | null) => void;
  saveTool: (tool: Tool) => Promise<{ success: boolean; message: string }>;
  deleteTool: (id: string) => void | Promise<void>;
  moveTool: (dragIndex: number, hoverIndex: number) => void;
  stepTool: (index: number, dir: -1 | 1) => void;
  reorderTools: (idsOverride?: string[]) => void | Promise<void>;
  addToolCategory: () => void | Promise<void>;
  removeToolCategory: (index: number) => void | Promise<void>;
  addToolStatus: () => void | Promise<void>;
  removeToolStatus: (index: number) => void | Promise<void>;
}

export function ToolsTab({ tools, settings, setFormDirty, leaveForm, newToolCat, setNewToolCat, newToolStatusLabel, setNewToolStatusLabel, newToolStatusColor, setNewToolStatusColor, catSaving, editingTool, setEditingTool, saveTool, deleteTool, moveTool, stepTool, reorderTools, addToolCategory, removeToolCategory, addToolStatus, removeToolStatus }: ToolsTabProps) {
  return (
    <>
    <div className="flex flex-col lg:flex-row gap-0 lg:h-[calc(100vh-4rem)] -m-3 sm:-m-5 lg:-m-8">
    
      {/* ── Left: list ── */}
      <div className={`${editingTool ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-shrink-0 flex-col lg:border-r border-white/8 lg:overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-5 py-3 lg:py-4 border-b border-white/8 sticky top-14 lg:top-0 bg-black/90 backdrop-blur-md z-10">
          <h2 className="text-base font-bold text-white">Tools</h2>
          <Button
            onClick={() => leaveForm(() => setEditingTool({
              id: `tool-${Date.now()}`,
              name: '',
              description: '',
              category: 'New',
              imageUrl: '',
              featured: false,
              slug: '',
              faqs: [],
              versions: [],
            }))}
            className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white h-8 px-3 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Tool
          </Button>
        </div>
    
        {/* Tool list */}
        <div className="flex-1 px-3 pt-4 pb-3 lg:p-3 space-y-1">
          {tools.length > 0 && (
            <p className="text-xs text-white/30 px-2 pb-2">Drag to reorder</p>
          )}
          <DndProvider backend={HTML5Backend}>
            <div className="space-y-2 lg:space-y-1">
              {tools.map((tool, index) => (
                <DraggableToolCard
                  key={tool.id}
                  tool={tool}
                  index={index}
                  moveTool={moveTool}
                  onEdit={() => leaveForm(() => { setEditingTool(tool); window.scrollTo({ top: 0 }); })}
                  onDelete={() => deleteTool(tool.id)}
                  onDragEnd={() => reorderTools()}
                  onMoveUp={index > 0 ? () => stepTool(index, -1) : undefined}
                  onMoveDown={index < tools.length - 1 ? () => stepTool(index, 1) : undefined}
                  isExpanded={editingTool?.id === tool.id}
                  expandedContent={null}
                  compact
                />
              ))}
            </div>
          </DndProvider>
          {tools.length === 0 && (
            <p className="text-sm text-white/30 text-center py-8">No tools yet</p>
          )}
        </div>
    
        {/* Categories & statuses at bottom */}
        <div className="border-t border-white/8 p-4 space-y-5">
          {/* Categories */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Categories</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(settings.toolCategories || []).map((cat, index) => (
                <span key={cat} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-purple-900/40 border border-purple-500/40 rounded-full text-xs text-white">
                  {cat}
                  <button type="button" onClick={() => removeToolCategory(index)} disabled={catSaving} className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-white/40 hover:text-red-400 transition-colors">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input placeholder="New category" value={newToolCat} onChange={(e) => setNewToolCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToolCategory(); } }} className="bg-black/50 border-white/20 text-white text-xs h-7" disabled={catSaving} />
              <Button type="button" onClick={addToolCategory} disabled={catSaving || !newToolCat.trim()} className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white h-7 px-2 text-xs">
                {catSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-3 h-3" />}
              </Button>
            </div>
          </div>
    
          {/* Statuses */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Statuses</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(settings.toolStatuses || []).map((status, index) => {
                const colorOption = STATUS_COLOR_OPTIONS.find(c => c.name === status.color);
                return (
                  <span key={status.label} className={`flex items-center gap-1 pl-2 pr-1 py-0.5 bg-gradient-to-r ${colorOption?.classes || 'from-purple-500 to-violet-500'} rounded-full text-xs text-white font-medium`}>
                    {status.label}
                    <button type="button" onClick={() => removeToolStatus(index)} disabled={catSaving} className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-black/20 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-1.5 items-center flex-wrap">
              <Input placeholder="New status" value={newToolStatusLabel} onChange={(e) => setNewToolStatusLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToolStatus(); } }} className="bg-black/50 border-white/20 text-white text-xs h-7 flex-1 min-w-0" disabled={catSaving} />
              <div className="flex gap-1">
                {STATUS_COLOR_OPTIONS.map((color) => (
                  <button key={color.name} type="button" onClick={() => setNewToolStatusColor(color.name)} title={color.label} className={`w-5 h-5 rounded-full bg-gradient-to-br ${color.classes} transition-all ${newToolStatusColor === color.name ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : 'opacity-60 hover:opacity-100'}`} />
                ))}
              </div>
              <Button type="button" onClick={addToolStatus} disabled={catSaving || !newToolStatusLabel.trim()} className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white h-7 px-2 text-xs">
                {catSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    
      {/* ── Right: form (full screen on mobile, with a back bar) ── */}
      <div className={`${editingTool ? 'block' : 'hidden lg:block'} flex-1 min-w-0 lg:overflow-y-auto`}>
        {editingTool ? (
          <div className="p-3 sm:p-5 lg:p-6">
            <button
              type="button"
              onClick={() => leaveForm(() => { setEditingTool(null); window.scrollTo({ top: 0 }); })}
              className="lg:hidden mb-3 -ml-1 flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8"
            >
              <span aria-hidden="true">←</span> All tools
            </button>
            <ToolFormNew
              key={editingTool.id}
              tool={editingTool}
              onSave={saveTool}
              onCancel={() => leaveForm(() => setEditingTool(null))}
              onDirtyChange={setFormDirty}
              statuses={(settings.toolStatuses || []).map(s => s.label)}
              toolCategories={settings.toolCategories || []}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm font-medium">Select a tool to edit</p>
            <p className="text-white/20 text-xs mt-1">or click Add Tool to create a new one</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
