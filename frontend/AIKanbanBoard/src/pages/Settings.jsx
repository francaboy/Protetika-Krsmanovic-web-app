import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LogOut,
  Command,
  FolderKanban,
  CheckSquare,
  Users,
  KeyRound,
  UserCheck,
  Crown,
  ShieldCheck,
  User as UserIcon,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Loader2,
  ArrowUpRight,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLayout } from "../components/layout/AppLayout";
import { useWorkspace } from "../hooks/useWorkspace";
import { userApi } from "../lib/api";
import { getSocket } from "../lib/socket";
import Topbar from "../components/layout/Topbar";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import Avatar from "../components/ui/Avatar";
import { cn } from "../lib/utils";

const formatGrammar = (count, one, few, many) => {
  const n = Math.abs(Number(count) || 0);
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 19) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
};

const ROLES = [
  { value: "member", label: "Radnik", icon: UserIcon },
  { value: "admin", label: "Admin", icon: ShieldCheck },
  { value: "owner", label: "Super Admin", icon: Crown },
];

const RoleSelect = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const currentRole = ROLES.find((r) => r.value === (value || "member")) || ROLES[0];
  const Icon = currentRole.icon;

  return (
    <div className="relative w-full sm:w-auto" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full sm:w-auto items-center justify-between gap-2.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-ink shadow-[var(--shadow-card)] transition-all duration-200 active:scale-95",
          "hover:border-brand-500/40 hover:shadow-[var(--shadow-soft)] disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-brand-500 ring-2 ring-brand-500/15"
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {disabled ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-faint shrink-0" />
          ) : (
            <Icon className="h-3.5 w-3.5 text-muted shrink-0" />
          )}
          <span className="truncate">{currentRole.label}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-faint transition-transform duration-200 shrink-0",
            open && "rotate-180 text-brand-600"
          )}
        />
      </button>

      {open && (
        <div className="card animate-in absolute right-0 sm:right-auto left-0 sm:left-auto z-50 mt-1.5 w-full sm:w-44 overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-lift)]">
          {ROLES.map((r) => {
            const active = r.value === (value || "member");
            const RoleIcon = r.icon;
            return (
              <div
                key={r.value}
                onClick={() => {
                  onChange(r.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors duration-150 active:scale-[0.98]",
                  active
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-ink hover:bg-surface-2"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <RoleIcon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-brand-600" : "text-faint")} />
                  <span className="truncate">{r.label}</span>
                </div>
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Switch = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
      checked ? "bg-brand-500" : "bg-line"
    )}
  >
    <span
      className={cn(
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[var(--shadow-card)] transition-transform duration-200 ease-in-out",
        checked ? "translate-x-5" : "translate-x-0"
      )}
    />
  </button>
);

const Card = ({ title, description, children }) => (
  <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6 shadow-[var(--shadow-card)]">
    <h3 className="font-display text-sm font-semibold tracking-tight text-ink">{title}</h3>
    {description && <p className="mt-1 text-xs text-muted">{description}</p>}
    <div className="mt-4 sm:mt-5">{children}</div>
  </section>
);

const roleLabel = (role) => {
  if (role === "owner") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Radnik";
};

const Settings = () => {
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openCreateBoard } = useLayout();
  const { boards = [], tasks = [], members = [] } = useWorkspace();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();

  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  const [reduceMotion, setReduceMotion] = useState(
    () => localStorage.getItem("pref-reduced-motion") === "true"
  );

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
    localStorage.setItem("pref-reduced-motion", String(reduceMotion));
  }, [reduceMotion]);

  const fetchAllUsers = useCallback(async () => {
    if (user?.role !== "owner") return;
    setLoadingUsers(true);
    try {
      const list = await userApi.search("");
      setAllUsers(list || []);
    } catch {
      /* tiho */
    } finally {
      setLoadingUsers(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return toast.error("Ime i prezime je obavezno");
    if (cleanName === user?.name) return toast("Nema izmjena u imenu");

    setSavingName(true);
    try {
      const res = await userApi.updateProfile({ name: cleanName });
      const updatedUser = res.user || { ...user, name: cleanName };

      if (typeof setUser === "function") {
        setUser((prev) => ({ ...prev, ...updatedUser }));
      }

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("user:updated", updatedUser);
      }

      toast.success("Ime je uspješno promijenjeno");
      fetchAllUsers();
    } catch (err) {
      toast.error(err.message || "Greška pri promjeni imena");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      return toast.error("Unesite trenutnu lozinku");
    }
    if (passwordForm.newPassword.length < 6) {
      return toast.error("Nova lozinka mora imati najmanje 6 znakova");
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error("Nove lozinke se ne poklapaju");
    }

    setSavingPassword(true);
    try {
      await userApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Lozinka je uspješno promijenjena");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      toast.error(err.message || "Greška pri promjeni lozinke");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    setUpdatingRoleId(targetUserId);
    try {
      const res = await userApi.updateRole(targetUserId, newRole);
      setAllUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: res.user.role } : u))
      );
      if (targetUserId === user?.id && setUser) {
        setUser((prev) => ({ ...prev, role: res.user.role }));
      }
      toast.success(`Uloga za ${res.user.name} je postavljena na ${roleLabel(newRole)}`);
    } catch (err) {
      toast.error(err.message || "Greška pri ažuriranju uloge");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  return (
    <>
      <Topbar
        title="Podešavanja"
        subtitle="Pregled i izmjena informacija o Vašem nalogu"
        onCreateBoard={openCreateBoard}
      />

      <div className="flex flex-1 flex-col justify-between overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:px-8">
          {/* Vaš profil */}
          <Card
            title="Vaš profil"
            description="Pregled i izmjena osnovnih informacija o Vašem nalogu."
          >
            <div className="flex items-center gap-3.5 sm:gap-4 border-b border-line pb-5 sm:pb-6">
              <Avatar
                name={user?.name}
                id={user?.id}
                src={user?.avatar_url}
                size="lg"
                className="h-14 w-14 sm:h-16 sm:w-16 text-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-base sm:text-lg font-semibold tracking-tight text-ink truncate">
                    {user?.name}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-brand-700 shrink-0">
                    {user?.role === "owner" && <Crown className="h-3 w-3" />}
                    {user?.role === "admin" && <ShieldCheck className="h-3 w-3" />}
                    {(!user?.role || user?.role === "member") && <UserIcon className="h-3 w-3" />}
                    {roleLabel(user?.role)}
                  </span>
                </div>
                <p className="truncate text-xs sm:text-sm text-muted">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateName} className="mt-4 sm:mt-5 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <div className="sm:col-span-2">
                  <Input
                    label="Ime i prezime"
                    value={name}
                    disabled={savingName}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Vaše puno ime i prezime"
                  />
                </div>
                <Button type="submit" loading={savingName} disabled={savingName} className="w-full active:scale-95">
                  <UserCheck className="h-4 w-4" /> Ažuriraj ime
                </Button>
              </div>
            </form>
          </Card>

          {/* Super Admin Panel: Upravljanje ulogama */}
          {user?.role === "owner" && (
            <Card
              title="Upravljanje ulogama"
              description="Kao Super Admin možete dodjeljivati i mijenjati nivoe pristupa zaposlenima."
            >
              {loadingUsers ? (
                <p className="text-xs text-muted">Učitavanje zaposlenih...</p>
              ) : (
                <div className="space-y-2.5">
                  {allUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-col gap-3 rounded-2xl border border-line/70 bg-surface-2/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={u.name} id={u.id} src={u.avatar_url} size="sm" className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold text-ink truncate">
                            {u.name} {u.id === user?.id && <span className="text-faint font-normal">(Vaš nalog)</span>}
                          </p>
                          <p className="text-[11px] sm:text-xs text-muted truncate">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end sm:justify-start gap-2">
                        <RoleSelect
                          value={u.role || "member"}
                          disabled={updatingRoleId === u.id}
                          onChange={(val) => handleRoleChange(u.id, val)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Sigurnost i Lozinka sa prikazom lozinke */}
          <Card
            title="Sigurnost i lozinka"
            description="Redovno ažurirajte svoju pristupnu lozinku radi bezbjednosti naloga."
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="relative">
                <Input
                  label="Trenutna lozinka"
                  type={showCurrentPassword ? "text" : "password"}
                  disabled={savingPassword}
                  placeholder="••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3.5 top-[34px] text-faint transition-colors hover:text-ink active:scale-90"
                  title={showCurrentPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="relative">
                  <Input
                    label="Nova lozinka"
                    type={showNewPassword ? "text" : "password"}
                    disabled={savingPassword}
                    placeholder="Najmanje 6 znakova"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3.5 top-[34px] text-faint transition-colors hover:text-ink active:scale-90"
                    title={showNewPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    label="Potvrdite novu lozinku"
                    type={showConfirmPassword ? "text" : "password"}
                    disabled={savingPassword}
                    placeholder="Ponovite novu lozinku"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3.5 top-[34px] text-faint transition-colors hover:text-ink active:scale-90"
                    title={showConfirmPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={savingPassword} disabled={savingPassword} className="w-full sm:w-auto active:scale-95">
                  <KeyRound className="h-4 w-4" /> Promijeni lozinku
                </Button>
              </div>
            </form>
          </Card>

          {/* Radni prostor: Optimizovano za mobilne uređaje (Grid 3 kolone sa automatskim skaliranjem) */}
          <Card title="Radni prostor" description="Pregled aktivnosti u ordinaciji.">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <Metric
                icon={FolderKanban}
                label={formatGrammar(
                  boards.length,
                  "Faza rada",
                  "Faze rada",
                  "Faza rada"
                )}
                value={boards.length}
                tint="#2f8159"
              />
              <Metric
                icon={CheckSquare}
                label={formatGrammar(
                  tasks.length,
                  "Pacijent",
                  "Pacijenta",
                  "Pacijenata"
                )}
                value={tasks.length}
                tint="#0ea5e9"
              />
              <Metric
                icon={Users}
                label={formatGrammar(
                  members.length,
                  "Zaposleni",
                  "Zaposlena",
                  "Zaposlenih"
                )}
                value={members.length}
                tint="#10b981"
              />
            </div>
          </Card>

          {/* Postavke interfejsa */}
          <Card title="Vaše postavke" description="Prilagodite izgled aplikacije.">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Tamna tema</p>
                <p className="mt-0.5 text-xs text-muted">
                  Prebacite izgled aplikacije na ugodniji noćni režim rada.
                </p>
              </div>
              <Switch checked={theme === "dark"} onChange={toggleTheme} />
            </div>

            <div className="mt-4 sm:mt-5 flex items-center justify-between gap-4 border-t border-line pt-4 sm:pt-5">
              <div>
                <p className="text-sm font-medium text-ink">Smanji animacije</p>
                <p className="mt-0.5 text-xs text-muted">
                  Smanjuje efekte i ubrzava prelaze kroz aplikaciju.
                </p>
              </div>
              <Switch checked={reduceMotion} onChange={setReduceMotion} />
            </div>

            <div className="mt-4 sm:mt-5 flex items-center justify-between gap-4 border-t border-line pt-4 sm:pt-5">
              <div>
                <p className="text-sm font-medium text-ink">Prečica za brzu pretragu</p>
                <p className="mt-0.5 text-xs text-muted">Otvorite pretragu sa tastature.</p>
              </div>
              <kbd className="flex items-center gap-0.5 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-muted">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
          </Card>

          {/* O aplikaciji */}
          <Card title="O aplikaciji" description="Informacije o sistemu.">
            <div className="flex items-center gap-3">
              <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-2xl shadow-[var(--shadow-brand)] shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-white"
                  aria-hidden="true"
                >
                  <path d="M7 3C4.24 3 2 5.24 2 8c0 3.5 1.5 6 3 9.5 1.2 2.8 2.5 3.5 4 3.5s2.3-.8 3-3c.7 2.2 1.5 3 3 3s2.8-.7 4-3.5c1.5-3.5 3-6 3-9.5 0-2.76-2.24-5-5-5-2 0-3.5 1.2-5 1.2S9 3 7 3z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">Stomatologija Krsmanović</p>
                <p className="text-xs text-muted truncate">
                  Pametno upravljanje ordinacijom · AI asistent · Verzija 1.0.0
                </p>
              </div>
            </div>
          </Card>

          {/* Odjava */}
          <Card title="Vaš nalog" description="Upravljajte sesijom i odjavom sa uređaja.">
            <Button
              variant="danger"
              className="w-full sm:w-auto active:scale-95"
              onClick={() => {
                logout();
                navigate("/prijava");
              }}
            >
              <LogOut className="h-4 w-4" /> Odjavite se
            </Button>
          </Card>
        </div>

        <footer className="mt-12 w-full border-t border-line/60 bg-surface/40 py-4 sm:py-5 text-xs text-muted backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2.5 px-4 sm:flex-row sm:px-6 md:px-8">
            <p className="flex items-center gap-1 text-center">
              <span>©</span> {currentYear}
              <span className="font-semibold text-ink">Stomatologija Krsmanović.</span>
              Sva prava zadržana.
            </p>
            <div className="flex items-center gap-1.5 text-faint">
              <span>Made by</span>
              <a
                href="https://srdjanmilosevic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center gap-1 font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                <span>Srđan</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 bg-brand-500 transition-all duration-300 group-hover:w-full" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

const Metric = ({ icon: Icon, label, value, tint }) => (
  <div className="rounded-2xl bg-surface-2/60 p-3.5 sm:p-4">
    <div
      className="mb-2 sm:mb-3 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl"
      style={{ backgroundColor: `${tint}1a`, color: tint }}
    >
      <Icon className="h-4 w-4" />
    </div>
    <p className="font-display text-xl sm:text-2xl font-semibold tracking-tight tabular text-ink">{value}</p>
    <p className="mt-0.5 text-[11px] sm:text-xs text-muted truncate">{label}</p>
  </div>
);

export default Settings;