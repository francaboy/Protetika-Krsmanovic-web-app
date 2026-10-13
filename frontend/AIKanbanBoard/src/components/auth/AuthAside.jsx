import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import KanbanDemo2 from "../landing/KanbanDemo2";

const AuthAside = ({
  title = "Planirajte i pratite radove pacijenata u realnom vremenu.",
  subtitle = "Pratite svaki rad kroz faze izrade i optimizujte raspoređivanje radova pacijenata uz pomoć AI.",
}) => {
  return (
    <aside className="relative hidden w-1/2 flex-col justify-center overflow-hidden border-l border-line bg-surface px-8 lg:flex">
      {/* Suptilni pozadinski glow na svijetloj temi */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-brand-50/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-80 w-80 rounded-full bg-brand-50/30 blur-3xl" />

      {/* Brand logotip gore lijevo */}
      <Link
        to="/"
        className="absolute left-8 top-8 z-10 flex items-center gap-2.5 text-ink"
      >
        <span className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[var(--shadow-brand)]">
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
        </span>
        <span className="font-display text-lg font-bold tracking-tight">
          Stomatologija Krsmanović
        </span>
      </Link>

      <div className="relative z-10 flex w-full flex-col items-center justify-center">
        {/* Kanban Demo kartica */}
        <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface-2/60 p-2 shadow-soft backdrop-blur-sm">
          <KanbanDemo2 className="w-full" />
        </div>

        {/* AI chip */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          <span>Optimizovano praćenje radova pacijenata uz pomoć AI</span>
        </div>

        {/* Naslov i podnaslov */}
        <div className="mt-8 max-w-md text-center">
          <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink lg:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{subtitle}</p>
        </div>
      </div>
    </aside>
  );
};

export default AuthAside;