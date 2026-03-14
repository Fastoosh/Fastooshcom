import { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { Identifier, XYCoord } from 'dnd-core';
import { Button } from '../ui/button';
import { Pencil, Trash2, GripVertical } from 'lucide-react';

interface DraggableProjectCardProps {
  project: {
    id: string;
    title: string;
    category: string;
    year: number;
    imageUrl?: string;
  };
  index: number;
  moveProject: (dragIndex: number, hoverIndex: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragEnd?: () => void;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

export function DraggableProjectCard({
  project,
  index,
  moveProject,
  onEdit,
  onDelete,
  onDragEnd,
}: DraggableProjectCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ handlerId }, drop] = useDrop<DragItem, void, { handlerId: Identifier | null }>({
    accept: 'project',
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
      moveProject(dragIndex, hoverIndex);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'project',
    item: () => {
      return { id: project.id, index };
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

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10 transition-opacity"
      style={{ opacity }}
    >
      {/* Drag Handle */}
      <div
        ref={drag}
        className="cursor-grab active:cursor-grabbing text-white/40 hover:text-white/70 transition-colors flex-shrink-0"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Thumbnail */}
      {project.imageUrl ? (
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
          <img
            src={project.imageUrl}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-white/30 text-xs">No image</span>
        </div>
      )}

      {/* Project Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold truncate">{project.title}</h3>
        <p className="text-gray-400 text-sm">
          {project.category} • {project.year}
        </p>
      </div>

      {/* Actions */}
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
    </div>
  );
}