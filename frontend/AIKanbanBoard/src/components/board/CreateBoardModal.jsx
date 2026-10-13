import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import { useBoards } from "../../context/BoardsContext";
import { cn } from "../../lib/utils";

// Paleta boja usklađena sa šumsko-zelenom temom ordinacije
const COLORS = [
  // Prve 4 fiksne osnovne boje
  "#F43F5E", // crvena / rose
  "#F59E0B", // žuta / amber
  "#0EA5E9", // svijetlo plava
  "#8B5CF6", // ljubičasta

  // Složeni parovi po nijansama
  "#c26a45", // terakota
  "#d4a23c", // ćilibar
  "#6f9b54", // maslinasta / žalfija
  "#2f8159", // forest (osnovna boja ordinacije)
];

const CreateBoardModal = ({ open, onClose }) => {
  const { create } = useBoards();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", color: COLORS[0] });
  const [loading, setLoading] = useState(false);

  // Resetovanje forme svaki put kad se otvori modal
  useEffect(() => {
    if (open) {
      setForm({ title: "", description: "", color: COLORS[0] });
      setLoading(false);
    }
  }, [open]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const cleanTitle = form.title.trim();
    if (!cleanTitle) {
      return toast.error("Unesite naziv faze rada");
    }

    setLoading(true);
    try {
      const board = await create({
        title: cleanTitle,
        description: form.description.trim() || null,
        color: form.color,
      });

      toast.success("Faza rada je uspješno kreirana");
      onClose();
      navigate(`/rad/${board.id}`);
    } catch (err) {
      toast.error(err.message || "Greška pri kreiranju faze rada");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title="Nova faza rada"
      description="Kreirajte novu radnu cjelinu i definišite protokol praćenja u laboratoriji."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Naziv faze rada"
          placeholder="npr. Modelovanje, 3D Print ili Cirkonski mostovi"
          autoFocus
          required
          disabled={loading}
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        />

        <Textarea
          label="Opis i napomene za rad (opciono)"
          rows={3}
          disabled={loading}
          placeholder="Unesite kratki opis radnog toka, protokola ili tima zaduženog za ovu fazu..."
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        />

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-ink">Izaberite boju oznake</label>
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            {COLORS.map((c) => {
              const isSelected = form.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={loading}
                  onClick={() => setForm((prev) => ({ ...prev, color: c }))}
                  className={cn(
                    "h-7 w-7 rounded-full shadow-sm transition-all duration-150 focus:outline-none",
                    isSelected
                      ? "scale-110 ring-2 ring-brand-600 ring-offset-2 ring-offset-surface"
                      : "hover:scale-105 hover:opacity-90"
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line/60 pt-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Odustani
          </Button>
          <Button type="submit" loading={loading} disabled={!form.title.trim()}>
            Kreiraj fazu rada
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateBoardModal;