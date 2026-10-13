import { useState, useEffect, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  X,
  RefreshCw,
  Search,
  ArrowRightLeft,
  PlusCircle,
  Pencil,
  Archive,
  Trash2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { boardApi } from "../lib/api";
import { getSocket } from "../lib/socket";
import Avatar from "./ui/Avatar";
import ConfirmDialog from "./ui/ConfirmDialog";
import { relativeTime, cn } from "../lib/utils";

const getActionMeta = (message = "") => {
  const m = message.toLowerCase();
  if (
    m.includes("premješten") ||
    m.includes("fazu") ||
    m.includes("prebačen") ||
    m.includes("faza") ||
    m.includes("moved")
  ) {
    return { icon: ArrowRightLeft, color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" };
  }
  if (
    m.includes("kreiran") ||
    m.includes("dodat") ||
    m.includes("napravljen") ||
    m.includes("created")
  ) {
    return { icon: PlusCircle, color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" };
  }
  if (m.includes("arhiviran") || m.includes("arhiva") || m.includes("archived")) {
    return { icon: Archive, color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" };
  }
  if (m.includes("obrisan") || m.includes("uklonjen") || m.includes("deleted")) {
    return { icon: Trash2, color: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300" };
  }
  if (m.includes("završen") || m.includes("gotov") || m.includes("completed")) {
    return { icon: CheckCircle2, color: "text-brand-600 bg-brand-50 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300" };
  }
  return { icon: Pencil, color: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300" };
};

const ActivityFeed = ({ open, onClose, boardId }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchActivities = useCallback(() => {
    if (!boardId) return;
    setLoading(true);
    boardApi
      .activity(boardId, 100)
      .then((data) => setActivities(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => {
    if (open) fetchActivities();
  }, [open, fetchActivities]);

  // Real-time osluškivanje svih akcija nad pacijentima i fazama
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewActivity = (a) => {
      if (!a) return;
      // Prihvatamo aktivnost ako pripada ovom boardu ili ako je globalna
      if (!a.board_id || !boardId || String(a.board_id) === String(boardId)) {
        setActivities((prev) => {
          if (prev.some((item) => item.id === a.id)) return prev;
          return [a, ...prev].slice(0, 100);
        });
      }
    };

    const onCleared = ({ boardId: bId } = {}) => {
      if (!bId || String(bId) === String(boardId)) {
        setActivities([]);
      }
    };

    // Ako se desi bilo koja akcija nad pacijentom, osvježi feed
    const handleMutationSync = () => {
      if (open) {
        fetchActivities();
      }
    };

    socket.on("activity:new", onNewActivity);
    socket.on("activity:cleared", onCleared);
    socket.on("task:created", handleMutationSync);
    socket.on("task:updated", handleMutationSync);
    socket.on("task:moved", handleMutationSync);
    socket.on("task:deleted", handleMutationSync);
    socket.on("task:archived", handleMutationSync);
    socket.on("board:updated", handleMutationSync);

    return () => {
      socket.off("activity:new", onNewActivity);
      socket.off("activity:cleared", onCleared);
      socket.off("task:created", handleMutationSync);
      socket.off("task:updated", handleMutationSync);
      socket.off("task:moved", handleMutationSync);
      socket.off("task:deleted", handleMutationSync);
      socket.off("task:archived", handleMutationSync);
      socket.off("board:updated", handleMutationSync);
    };
  }, [boardId, open, fetchActivities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((a) => {
      const msg = (a.message || a.action || "").toLowerCase();
      const author = (a.user_name || a.userName || "").toLowerCase();
      return msg.includes(q) || author.includes(q);
    });
  }, [activities, search]);

  const handleClearActivities = async () => {
    if (!boardId) return;
    setClearing(true);
    try {
      await boardApi.clearActivity(boardId);
      setActivities([]);
      toast.success("Istorija aktivnosti je uspješno očišćena");
      setConfirmClearOpen(false);
    } catch (err) {
      toast.error(err.message || "Greška pri brisanju aktivnosti");
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            <motion.aside
              className="fixed right-0 top-0 z-50 flex h-full w-96 max-w-[92vw] flex-col border-l border-line bg-surface/98 shadow-[var(--shadow-lift)] backdrop-blur-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              {/* Zaglavlje */}
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-600 border border-brand-500/20">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold tracking-tight text-ink">
                      Dnevnik aktivnosti
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      <span>Uživo praćenje radova</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {activities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmClearOpen(true)}
                      title="Očisti sve aktivnosti"
                      className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-priority-urgent/10 hover:text-priority-urgent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={fetchActivities}
                    title="Osvježi aktivnosti"
                    className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-brand-600")} />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Pretraga */}
              <div className="border-b border-line/60 p-3 bg-surface-2/30">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pretraži aktivnosti ili radnike..."
                    className="h-8 w-full rounded-full border border-line bg-surface pl-8 pr-3 text-xs outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/15"
                  />
                </div>
              </div>

              {/* Lista aktivnosti */}
              <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                {loading && activities.length === 0 ? (
                  <div className="space-y-3">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="skeleton h-14 rounded-2xl animate-pulse bg-line/60" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                    <Clock className="h-8 w-8 text-faint" />
                    <p className="text-xs font-semibold text-ink">Nema zabilježenih aktivnosti</p>
                    <p className="max-w-[210px] text-[11px] text-muted">
                      Sve akcije, premještanja i izmjene na radovima automatski će se bilježiti ovdje.
                    </p>
                  </div>
                ) : (
                  <ul className="relative space-y-3 before:absolute before:bottom-3 before:left-4 before:top-3 before:w-px before:bg-line/70">
                    {filtered.map((a) => {
                      const messageText = a.message || a.action || "Izmjena na radu";
                      const { icon: ActionIcon, color } = getActionMeta(messageText);

                      return (
                        <li
                          key={a.id}
                          className="group relative flex items-start gap-3 rounded-2xl border border-transparent p-2.5 transition-colors hover:border-line hover:bg-surface-2/60"
                        >
                          <div className="relative z-10 shrink-0">
                            <Avatar
                              name={a.user_name || a.userName || "Sistem"}
                              id={a.user_id || a.userId || a.id}
                              src={a.user_avatar || a.userAvatar}
                              size="xs"
                            />
                            
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-ink">
                              {a.user_name || a.userName || "Sistem"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted leading-relaxed">
                              {messageText}
                            </p>
                            <span className="mt-1 block text-[10px] font-medium text-faint">
                              {relativeTime(a.created_at || a.createdAt)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Podnožje */}
              <div className="border-t border-line/60 bg-surface-2/20 px-5 py-3 text-center text-[11px] text-faint">
                Ukupno zabilježeno: {filtered.length} {filtered.length === 1 ? "aktivnost" : "aktivnosti"}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearActivities}
        title="Očistiti istoriju aktivnosti?"
        description="Sve zabilježene radnje za ovu fazu rada biće trajno uklonjene iz baze."
        confirmLabel="Očisti sve"
        danger
        loading={clearing}
      />
    </>
  );
};

export default ActivityFeed;