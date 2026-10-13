import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate, matchPath } from "react-router-dom";
import toast from "react-hot-toast";
import { BoardsProvider, useBoards } from "../../context/BoardsContext";
import { ContextMenuProvider } from "../../context/ContextMenuContext";
import { boardApi, taskApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import Sidebar from "./Sidebar";
import CreateBoardModal from "../board/CreateBoardModal";
import CommandMenu from "../CommandMenu";
import TaskModal from "../board/TaskModal";
import ConfirmDialog from "../ui/ConfirmDialog";

const LayoutContext = createContext(null);
export const useLayout = () => useContext(LayoutContext);

const LayoutInner = () => {
  const { boards } = useBoards();
  const location = useLocation();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeTaskForEdit, setActiveTaskForEdit] = useState(null);

  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deletingTask, setDeletingTask] = useState(false);

  const [targetColumns, setTargetColumns] = useState([]);
  const [targetMembers, setTargetMembers] = useState([]);
  const [targetBoardId, setTargetBoardId] = useState(null);

  // State za otvaranje mobilnog sidebara
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar-collapsed") === "true"
  );

  // Dinamičko prepoznavanje trenutno otvorene table iz URL-a
  const currentRouteBoardId = useMemo(() => {
    const match =
      matchPath({ path: "/rad/:boardId" }, location.pathname) ||
      matchPath({ path: "/board/:boardId" }, location.pathname);
    return match?.params?.boardId || null;
  }, [location.pathname]);

  // Aktivna tabla: primarno iz URL-a, zatim targetBoardId, pa tek onda prva dostupna
  const activeBoardId = currentRouteBoardId || targetBoardId || boards[0]?.id;

  const openCreateBoard = useCallback(() => setCreateOpen(true), []);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);

  const openCreateTask = useCallback(async () => {
    if (activeBoardId) {
      setTargetBoardId(activeBoardId);
      try {
        const detail = await boardApi.get(activeBoardId);
        if (detail) {
          setTargetColumns(detail.columns || []);
          setTargetMembers(detail.members || []);
        }
      } catch (err) {
        console.error("Greška pri učitavanju detalja za novi zadatak:", err);
      }
    }
    setActiveTaskForEdit(null);
    setTaskModalOpen(true);
  }, [activeBoardId]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  // Tastaturna prečica Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Automatsko otvaranje rada ako je URL stigao sa ?task=ID (i čišćenje search params-a)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");
    if (!taskId || !activeBoardId) return;

    let isMounted = true;
    (async () => {
      try {
        const detail = await boardApi.get(activeBoardId);
        const found = (detail?.tasks || []).find((t) => String(t.id) === String(taskId));
        if (found && isMounted) {
          setTargetBoardId(activeBoardId);
          setTargetColumns(detail.columns || []);
          setTargetMembers(detail.members || []);
          setActiveTaskForEdit(found);
          setTaskModalOpen(true);

          params.delete("task");
          const nextSearch = params.toString();
          navigate(
            { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
            { replace: true }
          );
        }
      } catch (err) {
        console.error("Greška pri otvaranju zadatka sa linka:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [location.search, location.pathname, activeBoardId, navigate]);

  // Listeneri za akcije desnog klika
  useEffect(() => {
    const handleEditTaskEvent = async (e) => {
      const { task } = e.detail || {};
      if (!task) return;
      const bId = task.board_id || activeBoardId;
      if (bId) {
        setTargetBoardId(bId);
        try {
          const detail = await boardApi.get(bId);
          if (detail) {
            setTargetColumns(detail.columns || []);
            setTargetMembers(detail.members || []);
          }
        } catch (err) {
          console.error("Greška pri učitavanju podataka zadatka:", err);
        }
      }
      setActiveTaskForEdit(task);
      setTaskModalOpen(true);
    };

    const handlePriorityUpdate = async (e) => {
      const { taskId, priority } = e.detail || {};
      const bId = e.detail?.boardId || activeBoardId;
      if (!bId || !taskId) return;
      try {
        await taskApi.update(bId, taskId, { priority: priority || "urgent" });
        toast.success(
          priority === "urgent"
            ? "Prioritet pacijenta je postavljen na Hitno"
            : "Prioritet je ažuriran"
        );
      } catch (err) {
        toast.error(err.message || "Greška pri promjeni prioriteta");
      }
    };

    const handleMoveStageEvent = async (e) => {
      const { taskId, stageKey } = e.detail || {};
      const bId = e.detail?.boardId || activeBoardId;
      if (!bId || !taskId) return;

      try {
        const detail = await boardApi.get(bId);
        const cols = detail.columns || [];

        let targetCol = null;
        if (stageKey === "priprema") {
          targetCol = cols[0] || cols.find((c) => c.title.toLowerCase().includes("priprem"));
        } else if (stageKey === "print") {
          targetCol =
            cols[1] ||
            cols.find(
              (c) => c.title.toLowerCase().includes("print") || c.title.toLowerCase().includes("3d")
            );
        } else if (stageKey === "izrada") {
          targetCol =
            cols[2] ||
            cols.find(
              (c) => c.title.toLowerCase().includes("lab") || c.title.toLowerCase().includes("izrad")
            );
        } else if (stageKey === "zavrseno") {
          targetCol =
            cols[cols.length - 1] ||
            cols.find(
              (c) => c.title.toLowerCase().includes("zavr") || c.title.toLowerCase().includes("gotov")
            );
        }

        if (!targetCol) {
          toast.error("Nije pronađena odgovarajuća faza");
          return;
        }

        const targetTasks = (detail.tasks || []).filter((t) => t.column_id === targetCol.id);
        let topPosition = 1000;
        if (targetTasks.length > 0) {
          const minPos = Math.min(...targetTasks.map((t) => t.position || 1000));
          topPosition = minPos > 0 ? minPos / 2 : 500;
        }

        await taskApi.move(bId, taskId, { column_id: targetCol.id, position: topPosition });
        toast.success(`Pacijent je premješten u fazu "${targetCol.title}"`);
      } catch (err) {
        toast.error(err.message || "Greška pri prebacivanju faze");
      }
    };

    const handleArchiveEvent = async (e) => {
      const { task } = e.detail || {};
      const bId = task?.board_id || activeBoardId;
      if (!bId || !task?.id) return;
      try {
        if (taskApi.archive) {
          await taskApi.archive(bId, task.id);
        } else {
          await taskApi.update(bId, task.id, { is_archived: true });
        }
        toast.success("Pacijent je uspješno arhiviran");
      } catch (err) {
        toast.error(err.message || "Greška pri arhiviranju pacijenta");
      }
    };

    const handleDeleteEvent = (e) => {
      const { task } = e.detail || {};
      if (task) setTaskToDelete(task);
    };

    window.addEventListener("app:task:edit", handleEditTaskEvent);
    window.addEventListener("app:task:update-priority", handlePriorityUpdate);
    window.addEventListener("app:task:move-stage", handleMoveStageEvent);
    window.addEventListener("app:task:archive", handleArchiveEvent);
    window.addEventListener("app:task:delete", handleDeleteEvent);

    return () => {
      window.removeEventListener("app:task:edit", handleEditTaskEvent);
      window.removeEventListener("app:task:update-priority", handlePriorityUpdate);
      window.removeEventListener("app:task:move-stage", handleMoveStageEvent);
      window.removeEventListener("app:task:archive", handleArchiveEvent);
      window.removeEventListener("app:task:delete", handleDeleteEvent);
    };
  }, [activeBoardId]);

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    const bId = taskToDelete.board_id || activeBoardId;
    setDeletingTask(true);
    try {
      await taskApi.remove(bId, taskToDelete.id);
      toast.success("Pacijent je uspješno obrisan");
      setTaskToDelete(null);
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju pacijenta");
    } finally {
      setDeletingTask(false);
    }
  };

  return (
    <LayoutContext.Provider value={{ openCreateBoard, openCommand, openCreateTask, openMobileSidebar }}>
      <ContextMenuProvider
        onNewTask={openCreateTask}
        onNewBoard={openCreateBoard}
        onOpenCommand={openCommand}
      >
        <div className="h-screen overflow-hidden bg-bg">
          {/* Sidebar sada prima propsi za mobilni prikaz */}
          <Sidebar
            collapsed={collapsed}
            onToggle={toggleSidebar}
            onCreateBoard={openCreateBoard}
            onCommand={openCommand}
            mobileOpen={mobileSidebarOpen}
            setMobileOpen={setMobileSidebarOpen}
          />
          <main
            className={cn(
              "flex h-screen min-w-0 flex-col overflow-hidden transition-[padding] duration-300 ease-[var(--ease-spring)]",
              collapsed ? "md:pl-[92px]" : "md:pl-[280px]"
            )}
          >
            <Outlet />
          </main>
        </div>

        <CreateBoardModal open={createOpen} onClose={() => setCreateOpen(false)} />
        <CommandMenu
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onCreateBoard={() => {
            setCommandOpen(false);
            setCreateOpen(true);
          }}
        />

        {taskModalOpen && (
          <TaskModal
            open={taskModalOpen}
            onClose={() => {
              setTaskModalOpen(false);
              setActiveTaskForEdit(null);
            }}
            task={activeTaskForEdit}
            defaultColumnId={targetColumns[0]?.id}
            columns={targetColumns}
            members={targetMembers}
            actions={{
              createTask: async (data) => {
                const bId = activeTaskForEdit?.board_id || activeBoardId;
                if (bId) await taskApi.create(bId, data);
                setTaskModalOpen(false);
              },
              updateTask: async (taskId, data) => {
                const bId = activeTaskForEdit?.board_id || activeBoardId;
                if (bId) await taskApi.update(bId, taskId, data);
                setTaskModalOpen(false);
              },
              deleteTask: async (taskId) => {
                const bId = activeTaskForEdit?.board_id || activeBoardId;
                if (bId) await taskApi.remove(bId, taskId);
                setTaskModalOpen(false);
              },
            }}
          />
        )}

        <ConfirmDialog
          open={Boolean(taskToDelete)}
          onClose={() => setTaskToDelete(null)}
          onConfirm={confirmDeleteTask}
          title={
            <span className="block text-balance break-words leading-snug">
              Da li želite obrisati pacijenta{" "}
              <span className="font-bold text-ink underline decoration-priority-urgent/40 decoration-2">
                {taskToDelete?.title}
              </span>
              ?
            </span>
          }
          description="Pacijent i svi prateći podaci biće trajno uklonjeni. Ova radnja se ne može poništiti."
          confirmLabel="Obriši pacijenta"
          danger
          loading={deletingTask}
        />
      </ContextMenuProvider>
    </LayoutContext.Provider>
  );
};

const AppLayout = () => (
  <BoardsProvider>
    <LayoutInner />
  </BoardsProvider>
);

export default AppLayout;