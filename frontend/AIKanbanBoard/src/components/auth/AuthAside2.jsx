import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Sparkles } from "lucide-react";
import KanbanDemo from "../landing/KanbanDemo2";

const AuthAside = ({
  title = "Planirajte i pratite radove pacijenata u realnom vremenu.",
  subtitle = "Pratite svaki rad kroz faze izrade i optimizujte raspoređivanje radova pacijenata uz pomoć AI.",
}) => {
  return (
    <aside className="brand-gradient animate-gradient-pan relative hidden w-1/2 overflow-hidden lg:flex">
      {/* aurora mesh waves */}
      <div className="pointer-events-none absolute inset-0 mix-blend-screen">
        <motion.div
          className="absolute left-[-15%] top-[8%] h-72 w-[70%] rounded-[50%] blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(124,214,164,0.7), transparent)" }}
          animate={{ x: ["-6%", "16%", "-6%"], y: [0, 30, 0], rotate: [-8, 8, -8] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[-15%] top-[34%] h-80 w-[72%] rounded-[50%] blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(150,236,186,0.55), transparent)" }}
          animate={{ x: ["8%", "-16%", "8%"], y: [0, -26, 0], rotate: [8, -8, 8] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[6%] left-1/4 h-64 w-[55%] rounded-[50%] blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(196,250,216,0.5), transparent)" }}
          animate={{ x: ["-10%", "14%", "-10%"], y: [0, 18, 0], scale: [1, 1.18, 1] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* darkening tint so the white cards pop */}
      <div className="pointer-events-none absolute inset-0 bg-[#0b1f13]/10" />

      {/* soft depth glows */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-white/[0.07] blur-3xl" />

      {/* brand mark */}
      <Link to="/" className="absolute left-8 top-8 z-10 flex items-center gap-2.5 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20">
           <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 text-white"
    aria-hidden="true"
  >
    <path d="M7 3C4.24 3 2 5.24 2 8c0 3.5 1.5 6 3 9.5 1.2 2.8 2.5 3.5 4 3.5s2.3-.8 3-3c.7 2.2 1.5 3 3 3s2.8-.7 4-3.5c1.5-3.5 3-6 3-9.5 0-2.76-2.24-5-5-5-2 0-3.5 1.2-5 1.2S9 3 7 3z" />
  </svg>
        </span>
        <span className="font-display text-lg font-bold tracking-tight">Stomatologija Krsmanović</span>
      </Link>

      <div className="relative z-10 flex w-full flex-col items-center justify-center px-8 text-white">
        {/* live kanban board */}
        <KanbanDemo className="w-full max-w-2xl" />

        {/* AI chip */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> Optimizovano praćenje radova pacijenata uz pomoć AI
        </div>

        {/* copy */}
        <div className="mt-10 max-w-sm text-center">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">{title}</h2>
          <p className="mt-3 leading-relaxed text-white/75">{subtitle}</p>
        </div>
      </div>
    </aside>
  );
};

export default AuthAside;
