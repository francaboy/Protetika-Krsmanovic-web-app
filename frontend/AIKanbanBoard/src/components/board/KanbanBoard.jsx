import { useState, useMemo, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import Column from "./Column";
import TaskCard from "./TaskCard";
import { taskApi } from "../../lib/api";
import { getSocket } from "../../lib/socket";

// Stabilan proračun pozicije sa potpunom zaštitom za nultu i negativnu osu
const positionForIndex = (siblings, index) => {
  const prev = index > 0 ? Number(siblings[index - 1]?.position) : null;
  const next = index < siblings.length ? Number(siblings[index]?.position) : null;

  if (prev == null && next == null) return 1000;
  if (prev == null) {
    if (next == null) return 1000;
    if (next > 0) return next / 2;
    return next - 1000; // Garantuje da je uvijek manje od trenutnog minimuma
  }
  if (next == null) return prev + 1000;

  const diff = next - prev;
  if (Math.abs(diff) < 0.005) {
    return prev + 0.01;
  }

  return (prev + next) / 2;
};

const KanbanBoard = ({
  columns = [],
  tasks = [],
  actions,
  onTaskClick,
  onAddTask,
  onAiGenerate,
}) => {
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Sinhronizacija arhiviranja u realnom vremenu
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskArchived = ({ id }) => {
      if (!id) return;
      if (actions?.setTasks) {
        actions.setTasks((prev) => prev.filter((t) => t.id !== id));
      }
    };

    socket.on("task:archived", handleTaskArchived);

    return () => {
      socket.off("task:archived", handleTaskArchived);
    };
  }, [actions]);

  // Prikazujemo samo aktivne pacijente
  const visibleTasks = useMemo(() => {
    return (tasks || []).filter((t) => !t.is_archived);
  }, [tasks]);

  // Mapiranje i stabilno sortiranje pacijenata po fazama
  const tasksByColumn = useMemo(() => {
    const map = {};
    for (const col of columns) {
      map[col.id] = [];
    }
    for (const t of visibleTasks) {
      if (map[t.column_id]) {
        map[t.column_id].push(t);
      }
    }
    for (const id in map) {
      map[id].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
    }
    return map;
  }, [columns, visibleTasks]);

  const handleArchiveTask = useCallback(
    async (task) => {
      try {
        if (taskApi.archive) {
          await taskApi.archive(task.board_id, task.id);
        } else {
          await taskApi.update(task.board_id, task.id, { is_archived: true });
        }

        if (actions?.setTasks) {
          actions.setTasks((prev) => prev.filter((t) => t.id !== task.id));
        }
        toast.success("Pacijent je prebačen u arhivu");
      } catch (err) {
        toast.error(err.message || "Greška pri arhiviranju pacijenta");
      }
    },
    [actions]
  );

  const onDragStart = ({ active }) => {
    const found = visibleTasks.find((t) => t.id === active.id);
    setActiveTask(found || null);
  };

  const onDragEnd = ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id;
    const activeTaskObj = visibleTasks.find((t) => t.id === activeId);
    if (!activeTaskObj) return;

    const overData = over.data.current;
    let targetColumnId;

    if (overData?.type === "column") {
      targetColumnId = over.id;
    } else if (overData?.type === "task") {
      targetColumnId = overData.task.column_id;
    } else {
      targetColumnId = activeTaskObj.column_id;
    }

    const siblings = (tasksByColumn[targetColumnId] || []).filter((t) => t.id !== activeId);
    const isColumnChange = activeTaskObj.column_id !== targetColumnId;

    let index;
    if (isColumnChange) {
      // Kada se prebacuje u novu fazu/kolonu, UVIJEK ide na 1. mjesto na vrh
      index = 0;
    } else if (overData?.type === "task") {
      const overIndex = siblings.findIndex((t) => t.id === over.id);
      index = overIndex === -1 ? 0 : overIndex;
    } else {
      index = 0;
    }

    const newPosition = positionForIndex(siblings, index);

    // Ako nema stvarne promjene pozicije ni kolone, prekidamo
    if (
      !isColumnChange &&
      Math.abs(Number(activeTaskObj.position) - Number(newPosition)) < 0.001
    ) {
      return;
    }

    actions?.moveTask(activeId, targetColumnId, newPosition);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex h-full w-full items-start justify-start gap-5 overflow-x-auto overflow-y-hidden px-4 md:px-6 pb-6 no-scrollbar select-none">
        {columns.map((col, i) => (
          <Column
            key={col.id}
            column={col}
            index={i}
            tasks={tasksByColumn[col.id] || []}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
            onAiGenerate={onAiGenerate}
            onArchiveTask={handleArchiveTask}
            onRename={actions?.renameColumn}
            onDelete={actions?.deleteColumn}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeTask ? (
          <div className="w-[310px] rotate-1 cursor-grabbing shadow-2xl opacity-95">
            <TaskCard task={activeTask} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;