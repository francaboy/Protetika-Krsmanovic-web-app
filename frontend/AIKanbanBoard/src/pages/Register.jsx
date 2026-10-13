import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Eye, EyeOff, ArrowUpRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/Input";
import Button from "../components/ui/Button";
import AuthAside from "../components/auth/AuthAside";
import { AuthContextMenu } from "../components/auth/AuthContextMenu";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const currentYear = new Date().getFullYear();

  const onSubmit = async (e) => {
    if (e) e.preventDefault();
    if (form.password.length < 6) {
      return toast.error("Lozinka mora imati najmanje 6 znakova");
    }
    setLoading(true);
    try {
      await register(form);
      toast.success("Nalog je uspješno kreiran!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.message || "Greška pri registraciji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContextMenu onSubmitForm={onSubmit}>
      <div className="flex min-h-screen bg-surface">
        <div className="brand-gradient animate-gradient-pan relative flex min-h-screen w-full flex-col justify-between overflow-hidden px-4 pt-8 sm:pt-10 lg:w-1/2">
          {/* Aurora efekat */}
          <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <motion.div
              className="absolute left-[-15%] top-[8%] h-72 w-[70%] rounded-[50%] blur-3xl"
              style={{
                background: "radial-gradient(closest-side, rgba(124,214,164,0.7), transparent)",
              }}
              animate={{
                x: ["-6%", "16%", "-6%"],
                y: [0, 30, 0],
                rotate: [-8, 8, -8],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[-15%] top-[34%] h-80 w-[72%] rounded-[50%] blur-3xl"
              style={{
                background: "radial-gradient(closest-side, rgba(150,236,186,0.55), transparent)",
              }}
              animate={{
                x: ["8%", "-16%", "8%"],
                y: [0, -26, 0],
                rotate: [8, -8, 8],
              }}
              transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-[6%] left-1/4 h-64 w-[55%] rounded-[50%] blur-3xl"
              style={{
                background: "radial-gradient(closest-side, rgba(196,250,216,0.5), transparent)",
              }}
              animate={{
                x: ["-10%", "14%", "-10%"],
                y: [0, 18, 0],
                scale: [1, 1.18, 1],
              }}
              transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[#0b1f13]/10" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-white/[0.07] blur-3xl" />

          <div className="relative z-10 mx-auto my-auto w-full max-w-sm animate-in fade-in-50 slide-in-from-bottom-2 duration-300 py-6">
            <Link
              to="https://stomatologijakrsmanovic.ba/"
              className="mb-8 flex items-center justify-center gap-2.5 font-semibold text-white drop-shadow-sm transition-transform active:scale-95"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 shadow-[var(--shadow-brand)] backdrop-blur-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="white"
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
              <span className="font-display text-lg font-bold tracking-tight">
                Stomatologija Krsmanović
              </span>
            </Link>

            <div className="card rounded-3xl bg-surface/95 p-6 sm:p-8 shadow-[var(--shadow-soft)] backdrop-blur-md">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
                Kreirajte svoj nalog
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Započnite sa organizacijom radova i pacijenata.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Input
                  id="name"
                  label="Ime i prezime"
                  placeholder="Unesite svoje ime i prezime"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

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

                <div className="relative">
                  <Input
                    id="password"
                    label="Lozinka"
                    type={showPassword ? "text" : "password"}
                    placeholder="Najmanje 6 znakova"
                    autoComplete="new-password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-[34px] text-faint transition-colors hover:text-ink active:scale-90"
                    title={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full active:scale-[0.99]"
                  loading={loading}
                >
                  Kreirajte nalog
                </Button>
              </form>
            </div>

            <p className="mt-5 text-center text-sm font-medium text-white/90">
              Imate već nalog?{" "}
              <Link
                to="/login"
                className="font-semibold text-white underline underline-offset-4 hover:text-white/80"
              >
                Prijava
              </Link>
            </p>
          </div>

          <footer className="relative z-10 w-full border-t border-white/15 py-4 text-xs text-white/75">
            <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row">
              <p className="flex items-center justify-center gap-1">
                <span>©</span> {currentYear}
                <span className="font-semibold text-white">
                  Stomatologija Krsmanović.
                </span>
                Sva prava zadržana.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-white/70">
                <span>Made by</span>
                <a
                  href="https://srdjanmilosevic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center gap-0.5 font-semibold text-white transition-colors hover:text-white/90"
                >
                  <span>Srđan</span>
                  <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 bg-white transition-all duration-300 group-hover:w-full" />
                </a>
              </div>
            </div>
          </footer>
        </div>

        <AuthAside
          title="Efikasno praćenje svih faza protetike i laboratorijskih radova na jednom mjestu."
          subtitle="Jasna podjela obaveza i uvid u radne procese svakog člana tima."
        />
      </div>
    </AuthContextMenu>
  );
};

export default Register;