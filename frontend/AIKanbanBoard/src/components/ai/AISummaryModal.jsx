import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { aiApi } from "../../lib/api";

const Section = ({ icon: Icon, title, items, color, bg }) => {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl border border-line p-3.5 bg-surface shadow-sm">
      <h4 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        <span className="grid h-5 w-5 place-items-center rounded-lg shrink-0" style={{ backgroundColor: bg }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{title} ({items.length})</span>
      </h4>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const AISummaryModal = ({ open, onClose, boardId }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchSummary = useCallback(() => {
    if (!boardId) return;
    setSummary(null);
    setLoading(true);
    aiApi
      .summary(boardId)
      .then(setSummary)
      .catch((err) => {
        toast.error(err.message || "Greška pri kreiranju izvještaja");
      })
      .finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => {
    if (open) fetchSummary();
  }, [open, fetchSummary]);

  const copyToClipboard = () => {
    if (!summary) return;
    const lines = [
      "KLINIČKI IZVJEŠTAJ I TOK RADOVA",
      summary.headline ? `\nStatus: ${summary.headline}\n` : "",
      summary.completed?.length ? `\nZavršeni pacijenti:\n- ${summary.completed.join("\n- ")}` : "",
      summary.inProgress?.length ? `\nRadovi u toku:\n- ${summary.inProgress.join("\n- ")}` : "",
      summary.risks?.length ? `\nHitne stavke i kašnjenja:\n- ${summary.risks.join("\n- ")}` : "",
      summary.recommendations?.length ? `\nPreporuke:\n- ${summary.recommendations.join("\n- ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(lines);
    setCopied(true);
    toast.success("Izvještaj kopiran u memoriju");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2 truncate">
          <FileText className="h-5 w-5 text-brand-600 shrink-0" /> AI Izvještaj Pacijenta
        </span>
      }
      description="Automatski generisan izvještaj faza radova i trenutnog stanja za pacijente."
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          <p className="text-xs">Prikupljanje podataka i generisanje izvještaja…</p>
        </div>
      ) : summary ? (
        <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-4 no-scrollbar">
          {summary.headline && (
            <div className="rounded-2xl border border-brand-500/20 bg-brand-50/70 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 mb-1">
                Glavni pregled radova
              </p>
              <p className="text-xs leading-relaxed text-ink font-medium">
                {summary.headline}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Section
              icon={CheckCircle2}
              title="Završene faze radova"
              items={summary.completed}
              color="#059669"
              bg="#ecfdf5"
            />
            <Section
              icon={Clock}
              title="Radovi u toku"
              items={summary.inProgress}
              color="#d97706"
              bg="#fffbeb"
            />
            <Section
              icon={AlertTriangle}
              title="Hitni radovi i kašnjenja"
              items={summary.risks}
              color="#e11d48"
              bg="#fff1f2"
            />
            <Section
              icon={ArrowRight}
              title="Preporučeni koraci"
              items={summary.recommendations}
              color="#2f8159"
              bg="#f0fdf4"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-line pt-3 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSummary}
              disabled={loading}
              className="gap-1.5 text-xs text-muted active:scale-95 w-full sm:w-auto justify-center"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Osvježi analizu pacijenata
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="gap-1.5 text-xs active:scale-95 flex-1 sm:flex-initial justify-center"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Kopirano" : "Kopiraj tekst"}
              </Button>
              <Button size="sm" onClick={onClose} className="text-xs active:scale-95 flex-1 sm:flex-initial justify-center">
                U redu
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-xs text-muted">Nije uspjelo generisanje izvještaja za pacijente.</p>
          <Button variant="outline" size="sm" onClick={fetchSummary} className="mt-3 text-xs active:scale-95">
            Pokušajte ponovo
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default AISummaryModal;