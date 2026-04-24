import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { Identifier, XYCoord } from 'dnd-core';
import { Button } from '../ui/button';
import { Pencil, Trash2, GripVertical, ChevronUp } from 'lucide-react';

interface DraggableToolCardProps {
  tool: {
    id: string;
    name: string;
    category: string;
    imageUrl?: string;
    versions?: Array<{ id: string }>;
  };
  index: number;
  moveTool: (dragIndex: number, hoverIndex: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragEnd?: () => void;
  isExpanded?: boolean;
  expandedContent?: React.ReactNode;
  compact?: boolean;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

export function DraggableToolCard({
  tool,
  index,
  moveTool,
  onEdit,
  onDelete,
  onDragEnd,
  isExpanded = false,
  expandedContent,
  compact = false,
}: DraggableToolCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop<DragItem, void, { handlerId: Identifier | null }>({
    accept: 'tool',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      moveTool(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'tool',
    item: () => {
      return { id: tool.id, index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      // Call the onDragEnd callback when dragging finishes
      if (onDragEnd) {
        onDragEnd();
      }
    },
  });

  const opacity = isDragging ? 0.4 : 1;
  preview(drop(ref));

  if (compact) {
    return (
      <div
        ref={ref}
        data-handler-id={handlerId}
        onClick={onEdit}
        className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition-all cursor-pointer ${
          isExpanded
            ? 'bg-purple-900/30 border-purple-500/50'
            : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15'
        }`}
        style={{ opacity }}
      >
        <div
          ref={drag}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {tool.imageUrl ? (
          <div className="w-7 h-7 rounded overflow-hidden bg-white/5 flex-shrink-0">
            <img src={tool.imageUrl} alt={tool.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded bg-white/5 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${isExpanded ? 'text-purple-300' : 'text-white/80'}`}>{tool.name}</p>
          <p className="text-white/30 text-[10px] truncate">{tool.category}</p>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      className="bg-white/5 rounded-lg border border-white/10 transition-all"
      style={{ opacity }}
    >
      {/* Collapsed Card */}
      <div className={`flex items-center gap-4 p-4 transition-opacity ${isExpanded ? 'opacity-60' : ''}`}>
        {/* Drag Handle */}
        <div
          ref={drag}
          className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Thumbnail */}
        {tool.imageUrl ? (
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
            <img
              src={tool.imageUrl}
              alt={tool.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white/30 text-xs">No image</span>
          </div>
        )}

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{tool.name}</h3>
          <p className="text-gray-400 text-sm">
            {tool.category} • {tool.versions?.length || 0} version(s)
          </p>
        </div>

        {/* Expansion Indicator */}
        {isExpanded && (
          <div className="flex items-center gap-2 text-purple-400 text-sm flex-shrink-0">
            <span className="hidden sm:inline">Editing</span>
            <ChevronUp className="w-4 h-4" />
          </div>
        )}

        {/* Actions */}
        {!isExpanded && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent group cursor-pointer"
            >
              <Pencil className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="cursor-pointer hover:bg-red-600/20 group text-white"
            >
              <Trash2 className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            </Button>
          </div>
        )}
      </div>

      {/* Expanded Form */}
      {isExpanded && expandedContent && (
        <div className="border-t border-white/10 p-6 bg-black/20">
          {expandedContent}
        </div>
      )}
    </div>
  );
}