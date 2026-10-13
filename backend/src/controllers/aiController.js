const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const ai = require("../services/aiService");
const { emitToBoard, logActivity } = require("../realtime");

// Gramatičko usklađivanje za pacijente
const pluralizePacijenti = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} pacijenata`;
  if (mod10 === 1) return `${n} pacijenta`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} pacijenta`;
  return `${n} pacijenata`;
};

// POST /api/boards/:boardId/ai/generate-tasks
const generateTasks = asyncHandler(async (req, res) => {
  const patientsLine = (req.body.patientsLine || req.body.patientName || req.body.goal || "").trim();
  const doctorsLine = (req.body.doctorsLine || req.body.doctorName || "").trim();
  const notesLine = (req.body.notesLine || req.body.notes || "").trim();
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 6, 1), 15);

  if (!patientsLine) {
    throw ApiError.badRequest("Morate unijeti barem jednog pacijenta");
  }

  // Ako postoji prilagođeni servis koji direktno parsira linije, koristimo ga,
  // a ako ne, formiramo prompt koji AI-ju striktno nalaže da napravi pacijente
  let suggestions;
  if (ai.generatePatientsFromLines) {
    suggestions = await ai.generatePatientsFromLines({ patientsLine, doctorsLine, notesLine, count });
  } else {
    const prompt = `Kreiraj listu pacijenata kao zadatke (tasks).
Pacijenti: ${patientsLine}
Doktori: ${doctorsLine || "Ordinirajući doktor"}
Napomene / Opis rada: ${notesLine || "Standardna izrada"}
Svaki element mora imati:
- "title": Ime i prezime pacijenta
- "description": Doktor i odgovarajuća napomena za tog pacijenta
- "priority": "urgent" ako stoji hitno, inače "medium" ili "high"`;

    suggestions = await ai.generateTasks(prompt, count);
  }

  // Sanitizacija da naziv uvijek bude ime pacijenta
  suggestions = suggestions.map((s) => {
    let cleanTitle = s.title;
    // Ako naslov sadrži prefikse poput "Pacijent: ", očisti ga
    cleanTitle = cleanTitle.replace(/^Pacijent:\s*/i, "").trim();
    return {
      ...s,
      title: cleanTitle,
      description: s.description || (doctorsLine ? `Doktor: ${doctorsLine}` : ""),
    };
  });

  if (!req.body.column_id) {
    return res.json({ tasks: suggestions, persisted: false });
  }

  // Provjera pripadnosti odabrane kolone/faze pacijentu
  const colRes = await query("SELECT id, title FROM columns WHERE id = $1 AND board_id = $2", [
    req.body.column_id,
    req.board.id,
  ]);
  if (!colRes.rows.length) {
    throw ApiError.badRequest("Izabrana faza rada ne pripada ovom kartonu");
  }

  const baseRes = await query(
    "SELECT COALESCE(MAX(position), 0) AS pos FROM tasks WHERE column_id = $1",
    [req.body.column_id]
  );
  let pos = Number(baseRes.rows[0].pos);
  const created = [];

  for (const s of suggestions) {
    pos += 1000;
    const { rows } = await query(
      `INSERT INTO tasks (board_id, column_id, title, description, priority, position, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.board.id, req.body.column_id, s.title, s.description, s.priority || "medium", pos, req.user.id]
    );
    created.push(rows[0]);
    emitToBoard(req.board.id, "task:created", rows[0]);
  }

  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "ai.generated_tasks",
    message: `${req.user.name} je pomoću vještačke inteligencije dodao/la ${pluralizePacijenti(created.length)} u fazu "${colRes.rows[0].title}"`,
    metadata: { count: created.length },
  });

  res.status(201).json({ tasks: created, persisted: true });
});

// POST /api/boards/:boardId/ai/breakdown
const breakdownTask = asyncHandler(async (req, res) => {
  let { title, description } = req.body;
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 4, 1), 12);

  if (req.body.taskId) {
    const { rows } = await query(
      "SELECT title, description FROM tasks WHERE id = $1 AND board_id = $2",
      [req.body.taskId, req.board.id]
    );
    if (!rows.length) throw ApiError.notFound("Pacijent nije pronađen");
    title = rows[0].title;
    description = rows[0].description;
  }

  if (!title) throw ApiError.badRequest("Naziv pacijenta je obavezan");
  const subtasks = await ai.breakdownTask(title, description, count);
  res.json({ subtasks });
});

// POST /api/boards/:boardId/ai/summary
const summarizeBoard = asyncHandler(async (req, res) => {
  const [boardRes, colsRes, tasksRes] = await Promise.all([
    query("SELECT title FROM boards WHERE id = $1", [req.board.id]),
    query("SELECT id, title FROM columns WHERE board_id = $1 ORDER BY position ASC", [req.board.id]),
    query("SELECT column_id, title, priority FROM tasks WHERE board_id = $1", [req.board.id]),
  ]);

  const columns = colsRes.rows.map((c) => ({
    title: c.title,
    tasks: tasksRes.rows.filter((t) => t.column_id === c.id),
  }));

  const summary = await ai.summarizeBoard({
    boardTitle: boardRes.rows[0]?.title || "Vaš Izvještaj",
    columns,
  });
  res.json({ summary });
});

module.exports = { generateTasks, breakdownTask, summarizeBoard };