import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, ArrowUpRight, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/api";
import { Input } from "../components/ui/Input";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import AuthAside2 from "../components/auth/AuthAside2";
import { AuthContextMenu } from "../components/auth/AuthContextMenu";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetForm, setResetForm] = useState({ email: "", pin: "", newPassword: "" });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const currentYear = new Date().getFullYear();

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      toast.success("Dobrodošli!");
      navigate(location.state?.from?.pathname || "/dashboard", {
        replace: true,
      });
    } catch (err) {
      toast.error(err.message || "Neuspješna prijava");
    } finally {
      setLoading(false);
    }
  };

  const onResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetForm.email.trim()) return toast.error("Unesite Vašu e-mail adresu");
    if (!resetForm.pin.trim()) return toast.error("Unesite sigurnosni PIN ordinacije");
    if (resetForm.newPassword.length < 6) return toast.error("Nova lozinka mora imati najmanje 6 znakova");

    setResetting(true);
    try {
      await authApi.resetPasswordWithPin(resetForm);
      toast.success("Lozinka je uspješno promijenjena! Prijavite se novom lozinkom.");
      setForm((prev) => ({ ...prev, email: resetForm.email, password: "" }));
      setResetModalOpen(false);
      setResetForm({ email: "", pin: "", newPassword: "" });
    } catch (err) {
      toast.error(err.message || "Greška pri resetovanju lozinke");
    } finally {
      setResetting(false);
    }
  };

  return (
    <AuthContextMenu onOpenForgotModal={() => setResetModalOpen(true)}>
      <div className="flex min-h-screen">
        <div className="flex min-h-screen w-full flex-col justify-between px-4 pt-8 sm:pt-10 lg:w-1/2">
          <div className="mx-auto my-auto w-full max-w-sm animate-in fade-in-50 slide-in-from-bottom-2 duration-300 py-6">
            <Link
              to="https://stomatologijakrsmanovic.ba/"
              className="mb-8 flex items-center justify-center gap-2.5 font-semibold transition-transform active:scale-95"
            >
              <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-2xl shadow-[var(--shadow-brand)]">
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
              <span className="font-display text-lg font-bold tracking-tight text-ink">
                Stomatologija Krsmanović
              </span>
            </Link>

            <div className="card rounded-3xl p-6 sm:p-8 shadow-[var(--shadow-soft)]">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Dobrodošli nazad!
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Prijavite se na Vašu radnu tablu.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Input
                  id="email"
                  label="E-mail"
                  type="email"
                  placeholder="Unesite svoj e-mail"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-ink">
                    Lozinka
                  </label>

                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Unesite svoju lozinku"
                      autoComplete="current-password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-[10px] text-faint transition-colors hover:text-ink active:scale-90"
                      title={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setResetForm((prev) => ({ ...prev, email: form.email }));
                        setResetModalOpen(true);
                      }}
                      className="ml-auto text-xs font-medium text-brand-600 mb-2 transition-colors hover:text-brand-700 hover:underline active:scale-95"
                    >
                      Zaboravljena lozinka?
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full active:scale-[0.99]"
                  loading={loading}
                >
                  Prijava
                </Button>
              </form>
            </div>

            <p className="mt-5 text-center text-sm text-muted">
              Novi korisnik?{" "}
              <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-500">
                Napravite svoj nalog
              </Link>
            </p>
          </div>

          <footer className="w-full border-t border-line/60 py-4 text-xs text-muted">
            <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row">
              <p className="flex items-center justify-center gap-1">
                <span>©</span> {currentYear}
                <span className="font-semibold text-ink">
                  Stomatologija Krsmanović.
                </span>
                Sva prava zadržana.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-faint">
                <span>Made by</span>
                <a
                  href="https://srdjanmilosevic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center gap-0.5 font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  <span>Srđan</span>
                  <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 bg-brand-500 transition-all duration-300 group-hover:w-full" />
                </a>
              </div>
            </div>
          </footer>
        </div>

        <AuthAside2
          title="Centralizovani sistem za praćenje i organizaciju radova pacijenata."
          subtitle="Prijavite se i nastavite rad sa svojim timom."
        />
      </div>

      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        size="sm"
        title="Resetovanje lozinke"
        description="Unesite e-mail i sigurnosni PIN ordinacije za postavljanje nove lozinke."
      >
        <form onSubmit={onResetSubmit} className="space-y-4">
          <Input
            label="Vaša e-mail adresa"
            type="email"
            placeholder="Unesite e-mail adresu za prijavu"
            required
            autoFocus
            value={resetForm.email}
            onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <KeyRound className="h-3.5 w-3.5 text-brand-600" />
              Sigurnosni PIN ordinacije
            </label>
            <Input
              type="password"
              placeholder="Unesite PIN koji posjeduje ordinacija"
              required
              value={resetForm.pin}
              onChange={(e) => setResetForm({ ...resetForm, pin: e.target.value })}
            />
            <p className="text-[11px] text-faint">
              Zatražite sigurnosni PIN od administratora ordinacije.
            </p>
          </div>

          <div className="relative space-y-1.5">
            <label className="block text-xs font-semibold text-ink">
              Nova lozinka
            </label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                placeholder="Najmanje 6 znakova"
                required
                value={resetForm.newPassword}
                onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute right-3.5 top-[10px] text-faint transition-colors hover:text-ink active:scale-90"
                title={showNewPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetModalOpen(false)}
              className="active:scale-95"
            >
              Odustani
            </Button>
            <Button type="submit" loading={resetting} className="active:scale-95">
              Postavi novu lozinku
            </Button>
          </div>
        </form>
      </Modal>
    </AuthContextMenu>
  );
};

export default Login;