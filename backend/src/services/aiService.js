const { GoogleGenAI } = require("@google/genai");
const ApiError = require("../utils/ApiError");

// Tvoji originalni modeli
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.5-flash",
  "gemini-3.7-flash",
];

let client = null;
const getClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key") {
    throw new ApiError(503, "Gemini API ključ nije podešen na serveru");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractJson = (text) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new ApiError(502, "Vještačka inteligencija je vratila neočekivan odgovor");
  const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new ApiError(502, "Neuspjelo parsiranje odgovora vještačke inteligencije");
  }
};

const runPrompt = async (prompt) => {
  const aiClient = getClient();
  let lastError = null;

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const selectedModel = FALLBACK_MODELS[i];

    try {
      const response = await aiClient.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      lastError = err;
      const status = err.status || err.statusCode || (err.error && err.error.code);

      if (status === 429) {
        throw new ApiError(
          429,
          "Prekoračena je kvota za vještačku inteligenciju. Provjerite stanje Gemini naloga i pokušajte ponovo kasnije."
        );
      }
      if (status === 400 || status === 401 || status === 403) {
        throw new ApiError(503, "Zahtjev je odbijen — provjerite da li je API ključ ispravan.");
      }

      const isUnavailable =
        status === 503 ||
        status === 404 ||
        err.message?.includes("503") ||
        err.message?.includes("not found") ||
        err.message?.includes("high demand") ||
        err.message?.includes("UNAVAILABLE");

      if (isUnavailable && i < FALLBACK_MODELS.length - 1) {
        console.warn(
          `Model ${selectedModel} nije dostupan ili je preopterećen. Prebacujem na ${FALLBACK_MODELS[i + 1]}...`
        );
        await delay(1000);
        continue;
      }

      console.error(`Greška pri Gemini upitu na modelu ${selectedModel}:`, err.message);
      break;
    }
  }

  console.error("Greška pri Gemini upitu:", lastError?.message);
  throw new ApiError(502, "AI asistent trenutno nije dostupan. Molimo pokušajte ponovo.");
};

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

const normalizePatient = (t) => {
  let title = String(t.title || t.name || t.pacijent || "").trim().slice(0, 200);
  title = title.replace(/^pacijent:\s*/i, "").trim();

  let doctor = String(t.doctor || t.doktor || "").trim();
  let description = String(t.description || t.opis || "").trim().slice(0, 1000);

  if (doctor && !description.toLowerCase().includes(doctor.toLowerCase())) {
    description = `Ordinirajući doktor: ${doctor}${description ? `\nNapomene: ${description}` : ""}`;
  }

  return {
    title,
    doctor,
    description,
    priority: VALID_PRIORITIES.includes(t.priority) ? t.priority : "medium",
  };
};

/**
 * 1. GLAVNI PROMPT: Masovno kreiranje zasebnih pacijenata iz unesenih linija
 */
const generatePatientsFromLines = async ({ patientsLine, doctorsLine, notesLine, count = 6 }) => {
  const prompt = `Djeluješ kao vodeći koordinator stomatološke ordinacije i dentalne laboratorije "Stomatologija Krsmanović".
Tvoj zadatak je da unijete podatke pretvoriš u listu odvojenih kartona pacijenata (najviše do ${count} pacijenata).

ULAZNI PODACI OD KORISNIKA:
1. Linija sa pacijentima: "${patientsLine}"
2. Linija sa doktorima: "${doctorsLine || "Nije navedeno"}"
3. Linija sa napomenama i opisom izrade: "${notesLine || "Standardna dentalna izrada"}"

PRAVILA OBRADE I MAPIRANJA:
- Razdvoj pacijente (uglavnom su odvojeni zarezom, novim redom ili tačkom-zarezom).
- Svaki element u nizu PREDSTAVLJA JEDNOG ZASEBNOG PACIJENTA (ne faze rada jednog čovjeka, već različite pacijente!).
- Ako je naveden samo jedan doktor, dodijeli tog istog doktora svim pacijentima. Ako ih ima više, dodijeli ih redom pacijentima.
- Ako su napomene specifične za pojedine pacijente, pridruži ih odgovarajućem pacijentu; inače primijeni opštu napomenu ili specifikaciju materijala.
- "title": ISKLJUČIVO ime i prezime pacijenta (npr. "Marko Marković", bez prefiksa poput "Pacijent:").
- "doctor": Ime i titula doktora (npr. "Dr Krsmanović").
- "description": Jasan opis koji sadrži ordinirajućeg doktora i specifikaciju/napomenu rada (boja zuba, materijal npr. cirkon/keramika, vilica, hitnost).
- "priority": Postavi na "urgent" ako u napomenama piše "hitno", "odmah", "hitna predaja" ili slično; postavi na "high" za složene radove; inače "medium".

Odgovori ISKLJUČIVO na srpskom jeziku (ijekavica) u formi validnog JSON niza.
Format svakog elementa:
{
  "title": "Ime i Prezime Pacijenta",
  "doctor": "Dr Ime Doktora",
  "description": "Ordinirajući doktor: Dr ...\\nNapomene: ...",
  "priority": "low" | "medium" | "high" | "urgent"
}
Bez ikakvog uvodnog ili zaključnog teksta, bez markdown navodnika.`;

  const json = extractJson(await runPrompt(prompt));
  if (!Array.isArray(json)) throw new ApiError(502, "AI nije vratio ispravnu listu pacijenata");
  return json.map(normalizePatient).filter((t) => t.title);
};

/**
 * 2. PROMPT: Generisanje pacijenata ili faza iz opšteg cilja
 */
const generateTasks = async (goal, count = 6) => {
  const prompt = `Djeluješ kao stomatološki koordinator u dentalnoj praksi "Stomatologija Krsmanović".
Na osnovu sljedećeg zahtjeva: "${goal}", kreiraj do ${count} konkretnih pacijenata ili kliničkih stavki za radnu tablu.

PRAVILA:
- "title": Ime i prezime pacijenta ili naziv specifičnog dentalnog protokola.
- "description": Ordinirajući doktor, materijal, boja i kratka napomena izrade (1-2 jasne rečenice).
- "priority": "urgent", "high", "medium" ili "low".

Odgovori ISKLJUČIVO na srpskom jeziku (ijekavica) u formi validnog JSON niza.
Svaki element:
{
  "title": string,
  "description": string,
  "priority": "low"|"medium"|"high"|"urgent"
}
Bez uvodnog ili zaključnog teksta, bez markdown oznaka.`;

  const json = extractJson(await runPrompt(prompt));
  if (!Array.isArray(json)) throw new ApiError(502, "AI nije vratio listu pacijenata");
  return json.map(normalizePatient).filter((t) => t.title);
};

/**
 * 3. PROMPT: Razbijanje kompleksnog dentalnog rada na korake laboratorijske izrade
 */
const breakdownTask = async (title, description = "", count = 4) => {
  const prompt = `Djeluješ kao vodeći zubni tehničar u modernoj laboratoriji "Stomatologija Krsmanović".
Razbij dentalni rad za pacijenta "${title}" na tačno ${count} hronološke laboratorijske faze:
1. Priprema i modelovanje (CAD dizajn, pregled skena)
2. Printanje modela zuba (3D print, priprema podloge)
3. Laboratorijska izrada (CAM glodanje, sinterovanje cirkonijuma ili keramika)
4. Završetak rada (glaziranje, poliranje i kontrola predaje)

Dodatne napomene za rad: "${description || "Standardni rad"}"

Odgovori ISKLJUČIVO na srpskom jeziku (ijekavica) u formi validnog JSON niza.
Svaki element:
{
  "title": string (precizan naziv etape izrade),
  "description": string (konkretno tehničko uputstvo za tehničara u toj fazi),
  "priority": "low"|"medium"|"high"|"urgent"
}
Bez uvodnog ili zaključnog teksta, bez markdown oznaka.`;

  const json = extractJson(await runPrompt(prompt));
  if (!Array.isArray(json)) throw new ApiError(502, "AI nije vratio faze izrade");
  return json.map(normalizePatient).filter((t) => t.title);
};

/**
 * 4. PROMPT: Sažetak toka i stanja svih pacijenata u ordinaciji (Povezan sa AISummaryModal)
 */
const summarizeBoard = async ({ boardTitle, columns = [] }) => {
  const snapshot = columns
    .map((c) => {
      const taskLines = (c.tasks || []).map((t) => {
        const details = [
          t.priority === "urgent" ? "HITNO" : t.priority === "high" ? "VISOK PRIORITET" : null,
          t.due_date ? `Rok: ${t.due_date.slice(0, 10)}` : null,
          t.description ? t.description.replace(/\n/g, ", ") : null,
        ]
          .filter(Boolean)
          .join(" | ");

        return `  - Pacijent: ${t.title}${details ? ` [${details}]` : ""}`;
      });

      return `${c.title} (${c.tasks ? c.tasks.length : 0} pacijenata):\n` +
        (taskLines.length > 0 ? taskLines.join("\n") : "  (trenutno nema pacijenata)");
    })
    .join("\n\n");

  const prompt = `Djeluješ kao glavni koordinator i šef laboratorije u ordinaciji "Stomatologija Krsmanović".
Tvoj zadatak je da sačiniš stručan, sažet i pregledan klinički izvještaj za radnu cjelinu: "${boardTitle}".

PREGLED PACIJENATA PO FAZAMA IZ BAZE:
${snapshot}

STRUKTURA ODGOVORA (JSON OBJEKAT):
1. "headline": Jedna upečatljiva, sažeta rečenica o trenutnom stanju laboratorije (npr. koliko je ukupno radova, da li sve teče po planu ili ima zastoja).
2. "completed": Niz stringova (kratke stavke) za pacijente koji su u fazi "Završetak", gotovi ili spremni za isporuku doktorima.
3. "inProgress": Niz stringova za pacijente koji se trenutno modeluju, printaju ili frezuju u laboratoriji.
4. "risks": Niz stringova koji izdvaja ISKLJUČIVO hitne radove ("urgent"), radove sa probijenim ili bliskim rokom, ili pacijente sa komplikovanim napomenama.
5. "recommendations": Niz konkretnih preporuka (2 do 4 stavke) za zubne tehničare i ordinirajuće doktore kako da organizuju današnji rad.

PRAVILA:
- Piši ISKLJUČIVO na srpskom jeziku (ijekavica).
- Nazive pacijenata navodi tačno kako pišu u pregledu.
- Ako u nekoj kategoriji nema stavki, vrati kratku umirujuću poruku kao jedan element u nizu (npr. ["Nema evidentiranih hitnih kašnjenja"]).
- Format mora biti 100% validan JSON bez markdown blokova i bez komentara.

Primjer JSON strukture:
{
  "headline": "...",
  "completed": ["Pacijent Marko Marković - Završen cirkon most spreman za probu"],
  "inProgress": ["Pacijent Petar Petrović - U toku je 3D print modela vilice"],
  "risks": ["Pacijent Jovan Jovanović - HITAN rad, rok predaje ističe danas"],
  "recommendations": ["Prvo završiti poliranje za dr Krsmanovića prije podneva"]
}`;

  return extractJson(await runPrompt(prompt));
};

module.exports = {
  generatePatientsFromLines,
  generateTasks,
  breakdownTask,
  summarizeBoard,
};