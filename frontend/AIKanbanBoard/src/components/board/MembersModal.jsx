import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { UserPlus, X, Search, Crown, ShieldCheck, User, ChevronDown, Check } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import { boardApi, userApi } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { cn } from "../../lib/utils";

const roleTone = (role) =>
  role === "owner"
    ? "bg-brand-50 text-brand-700"
    : role === "admin"
    ? "bg-[#FBF1E2] text-[#c28a3a]"
    : "bg-sky-50 text-sky-700";

const formatRole = (role) => {
  switch (role) {
    case "owner":
      return "Super Admin";
    case "admin":
      return "Admin";
    default:
      return "Radnik";
  }
};

const MembersModal = ({ open, onClose, boardId, members = [], setMembers, canManage, ownerId }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    userApi
      .search("")
      .then((res) => {
        const users = Array.isArray(res) ? res : res?.users || [];
        setAllUsers(users);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewUser = (newUser) => {
      setAllUsers((prev) => {
        if (prev.some((u) => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    };

    socket.on("user:registered", handleNewUser);
    return () => {
      socket.off("user:registered", handleNewUser);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.id === u.id)
  );

  const selectedUser = availableUsers.find((u) => String(u.id) === String(selectedUserId));

  const addSelectedMember = async (userToAdd) => {
    if (!userToAdd?.email) return;
    setLoading(true);
    try {
      const member = await boardApi.addMember(boardId, { email: userToAdd.email });
      setMembers((prev) => {
        const exists = prev.find((m) => m.id === member.id);
        return exists ? prev.map((m) => (m.id === member.id ? { ...m, ...member } : m)) : [...prev, member];
      });
      toast.success(`${member.name || userToAdd.name} je uspješno dodan`);
      setSelectedUserId("");
      setDropdownOpen(false);
    } catch (err) {
      toast.error(err.message || "Greška pri dodavanju radnika");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (userId) => {
    try {
      await boardApi.removeMember(boardId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      toast.success("Radnik je uklonjen sa pacijenta");
    } catch (err) {
      toast.error(err.message || "Greška pri uklanjanju");
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Radnici na pacijentu"
      description="Dodajte članove tima za rad na pacijentu u realnom vremenu."
      size="md"
    >
      {canManage && (
        <div className="mb-5 space-y-2.5 rounded-2xl border border-line bg-surface-2/40 p-3 sm:p-4">
          <label className="block text-xs font-semibold text-ink">
            Izaberite zaposlenog sa spiska
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Custom Styled Dropdown prilagođen za mob/tablet */}
            <div className="relative flex-1" ref={dropdownRef}>
              <div
                onClick={() => setDropdownOpen((prev) => !prev)}
                role="button"
                tabIndex={0}
                className={cn(
                  "flex h-10 w-full cursor-pointer select-none items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 text-xs text-ink shadow-[var(--shadow-card)] transition-all duration-200 active:scale-[0.99]",
                  "hover:border-brand-500/40 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15",
                  dropdownOpen && "border-brand-500 ring-2 ring-brand-500/15"
                )}
              >
                {selectedUser ? (
                  <div className="flex min-w-0 items-center gap-2 truncate">
                    <Avatar name={selectedUser.name} id={selectedUser.id} src={selectedUser.avatar_url} size="xs" className="shrink-0" />
                    <span className="truncate font-medium text-ink">{selectedUser.name}</span>
                  </div>
                ) : (
                  <span className="text-muted">Izaberite radnika</span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {selectedUser && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserId("");
                      }}
                      title="Poništi izbor"
                      className="grid h-5 w-5 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}

                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-faint transition-transform duration-200",
                      dropdownOpen && "rotate-180 text-brand-600"
                    )}
                  />
                </div>
              </div>

              {/* Meni sa opcijama */}
              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)] no-scrollbar">
                  <div
                    onClick={() => {
                      setSelectedUserId("");
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-colors duration-150",
                      !selectedUserId
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-muted hover:bg-surface-2 hover:text-ink"
                    )}
                  >
                    <span>Izaberite radnika</span>
                    {!selectedUserId && <Check className="h-3.5 w-3.5 text-brand-600" />}
                  </div>

                  <div className="my-1 h-px bg-line/60" />

                  {availableUsers.length === 0 ? (
                    <div className="px-3 py-2.5 text-center text-xs text-faint">
                      Svi radnici su već dodati
                    </div>
                  ) : (
                    availableUsers.map((u) => {
                      const isSelected = String(u.id) === String(selectedUserId);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors duration-150 active:scale-[0.98]",
                            isSelected
                              ? "bg-brand-50 text-brand-700 font-medium"
                              : "text-ink hover:bg-surface-2"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2 truncate">
                            <Avatar name={u.name} id={u.id} src={u.avatar_url} size="xs" className="shrink-0" />
                            <span className="truncate">{u.name}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <Button
              type="button"
              loading={loading}
              disabled={!selectedUserId}
              onClick={() => {
                if (selectedUser) addSelectedMember(selectedUser);
              }}
              className="h-10 sm:h-auto w-full sm:w-auto shrink-0 active:scale-95"
            >
              <UserPlus className="h-4 w-4" /> Dodajte radnika
            </Button>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Radnici na ovom pacijentu ({members.length})
        </span>

        {members.length > 5 && (
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtriraj članove..."
              className="h-8 w-full sm:w-44 rounded-full border border-line bg-surface pl-8 pr-3 text-xs outline-none focus:border-brand-500 shadow-sm"
            />
          </div>
        )}
      </div>

      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {filteredMembers.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-line/70 bg-surface p-3 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-3 flex-1">
              <Avatar name={m.name} id={m.id} src={m.avatar_url} size="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs sm:text-sm font-semibold text-ink">{m.name}</p>
                <p className="truncate text-[11px] sm:text-xs text-muted">{m.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] sm:text-[11px] font-medium",
                  roleTone(m.role)
                )}
              >
                {m.role === "owner" && <Crown className="h-3 w-3" />}
                {m.role === "admin" && <ShieldCheck className="h-3 w-3" />}
                {(m.role === "member" || !m.role) && <User className="h-3 w-3" />}
                {formatRole(m.role)}
              </span>

              {canManage && m.id !== ownerId && (
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  title="Ukloni radnika"
                  className="rounded-full p-1.5 text-faint transition-colors hover:bg-elevated hover:text-priority-urgent active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
};

export default MembersModal;