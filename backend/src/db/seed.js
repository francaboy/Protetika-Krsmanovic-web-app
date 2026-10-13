require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, withTransaction } = require("../config/db");

const PASSWORD = "123456";
const DAY = 86400000;

// 4 Glavne faze rada (svaka je poseban board sa tačno 1 kolonom)
const PHASES = [
  { title: "Priprema i modelovanje", color: "#2f8159" },
  { title: "Printanje modela zuba", color: "#0ea5e9" },
  { title: "Laboratorijska izrada", color: "#f59e0b" },
  { title: "Završeni dentalni radovi", color: "#10b981" },
];

// 9 Korisnika: Srđan Milošević kao Superadmin (owner) + 2 Admina + 6 Radnika
const USERS = [
  // Superadmin
  { key: "srdjan", name: "Srđan Milošević", email: "srdjan.msevic@gmail.com", role: "owner" },
  // 2 Administratora
  { key: "milica", name: "Milica Petrović", email: "milica@krsmanovic.com", role: "admin" },
  { key: "stefan", name: "Stefan Jovanović", email: "stefan@krsmanovic.com", role: "admin" },
  // 6 Radnika
  { key: "nikola", name: "Nikola Savić", email: "nikola@krsmanovic.com", role: "member" },
  { key: "jelena", name: "Jelena Đurić", email: "jelena@krsmanovic.com", role: "member" },
  { key: "marko", name: "Marko Ilić", email: "marko@krsmanovic.com", role: "member" },
  { key: "tamara", name: "Tamara Babić", email: "tamara@krsmanovic.com", role: "member" },
  { key: "goran", name: "Goran Simić", email: "goran@krsmanovic.com", role: "member" },
  { key: "bojana", name: "Bojana Popović", email: "bojana@krsmanovic.com", role: "member" },
];

const DOCTORS = [
  "Dr Milan Knežević",
  "Dr Sanja Vuković",
  "Dr Dejan Marjanović",
  "Dr Ivana Božić",
  "Dr Vladimir Lukić",
  "Dr Zorana Kostić",
];

const FIRST_NAMES = [
  "Marko", "Nikola", "Jelena", "Milica", "Stefan", "Ana", "Dragan", "Bojana", "Petar", "Marija",
  "Goran", "Tamara", "Bojan", "Ivana", "Dušan", "Jovana", "Aleksandar", "Snežana", "Luka", "Sara",
  "Nemanja", "Milena", "Dejan", "Tijana", "Filip", "Dragana", "Miloš", "Danijela", "Zoran", "Katarina"
];

const LAST_NAMES = [
  "Jovanović", "Petrović", "Nikolić", "Ilić", "Đorđević", "Pavlović", "Marković", "Popović",
  "Stojanović", "Živković", "Janković", "Todorović", "Stanković", "Ristić", "Kostić", "Milošević",
  "Cvetković", "Lazić", "Vasić", "Dukić", "Simić", "Mitrović", "Gajić", "Vuković", "Babić"
];

const TOOTH_NUMBERS = ["11", "12", "21", "22", "14, 15", "24, 25, 26", "36, 37", "45, 46, 47", "13-23", "33-43", "Gornja vilica", "Donja vilica"];
const SHADES = ["A1", "A2", "A3", "A3.5", "B1", "B2", "BL1", "BL2", "BL3", "C2"];
const RESTORATION_TYPES = [
  "Cirkon monolitna krunica",
  "Cirkon-keramički most",
  "E.max fasete (viniri)",
  "Privremeni PMMA most",
  "Totalna proteza na lokatorima",
  "Skeletirana wironit proteza",
  "Keramički inlej / onlej",
  "Šrafom nošena krunica na implantatu",
  "Hirurški šablon za implantaciju",
  "Individualni abatment od titanijuma"
];

const SPECIAL_NOTES = [
  "Pojačati anatomiju i fisure, pacijent traži prirodniji izgled.",
  "Obratite pažnju na okluziju, u antagonistu je keramika.",
  "Hitno za probu u petak do 12h, pacijent putuje u inostranstvo.",
  "Minimalna preparacija subgingivalno, paziti na rub zatvaranja.",
  "Boja prelazi iz A3 u cerviksu u A1 incizalno.",
  "Tražena mliječna transparencija na incizalnim bridovima.",
  "Izbjeći preuranjeni kontakt pri lateralnim kretnjama.",
  "Proba metala/cirkona zakazana odmah po završetku glodanja.",
  "Standardna morfologija, pacijent zadovoljan preliminarnim wax-upom.",
  "Pojačati aproksimalne kontakte, pacijent ima dijastemu."
];

const PRIORITIES = ["low", "medium", "high", "urgent"];

const run = async () => {
  await withTransaction(async (c) => {
    console.log("🧹 Čistim stare podatke...");
    await c.query("DELETE FROM users WHERE email = ANY($1)", [
      USERS.map((u) => u.email.toLowerCase()),
    ]);

    console.log("👥 Kreiram 9 korisnika...");
    const hash = await bcrypt.hash(PASSWORD, 10);
    const uid = {};

    for (const u of USERS) {
      const { rows } = await c.query(
        `INSERT INTO users (name, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, now() - interval '60 days') RETURNING id`,
        [u.name, u.email.toLowerCase(), hash, u.role]
      );
      uid[u.key] = rows[0].id;
    }

    const ownerId = uid["srdjan"];
    const workerKeys = ["srdjan", "milica", "stefan", "nikola", "jelena", "marko", "tamara", "goran", "bojana"];

    console.log("⚙️ Kreiram 4 boarda (svaki sa 1 kolonom)...");
    const boards = [];

    for (const p of PHASES) {
      const { rows: br } = await c.query(
        `INSERT INTO boards (title, description, color, owner_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now() - interval '30 days', now()) RETURNING id`,
        [p.title, `Faza rada: ${p.title}`, p.color, ownerId]
      );
      const boardId = br[0].id;

      for (const u of USERS) {
        await c.query(
          `INSERT INTO board_members (board_id, user_id, role)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [boardId, uid[u.key], u.role]
        );
      }

      // Tačno 1 kolona sa istim nazivom kao faza rada
      const { rows: cr } = await c.query(
        `INSERT INTO columns (board_id, title, position) VALUES ($1, $2, 1000) RETURNING id`,
        [boardId, p.title]
      );

      boards.push({ boardId, columnId: cr[0].id, title: p.title });
    }

    console.log("🦷 Upisujem 50 pacijenata raspoređenih po fazama rada...");
    let taskTotal = 0;

    for (let i = 0; i < 50; i++) {
      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(i * 3 + 5) % LAST_NAMES.length];
      const patientTitle = `${firstName} ${lastName}`;

      const doctor = DOCTORS[i % DOCTORS.length];
      const teeth = TOOTH_NUMBERS[i % TOOTH_NUMBERS.length];
      const shade = SHADES[(i * 2) % SHADES.length];
      const restoration = RESTORATION_TYPES[i % RESTORATION_TYPES.length];
      const note = SPECIAL_NOTES[i % SPECIAL_NOTES.length];

      const description = `Doktor: ${doctor}\nZubi: ${teeth}\nBoja: ${shade}\nVrsta rada: ${restoration}\n\nNapomena: ${note}`;

      // Ciklično raspoređivanje u jedan od 4 boarda (~12-13 po boardu)
      const bIndex = i % boards.length;
      const target = boards[bIndex];

      const priority = PRIORITIES[(i + 2) % PRIORITIES.length];
      const dueOffsetDays = (i % 12) - 2;
      const dueDate = new Date(Date.now() + dueOffsetDays * DAY);

      const assigneeKey = workerKeys[i % workerKeys.length];
      const assigneeId = uid[assigneeKey];

      await c.query(
        `INSERT INTO tasks
           (board_id, column_id, title, description, priority, due_date, assignee_id, position, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - (($10 || ' days')::interval), now())`,
        [
          target.boardId,
          target.columnId,
          patientTitle,
          description,
          priority,
          dueDate,
          assigneeId,
          (i + 1) * 100,
          ownerId,
          (i % 10) + 1,
        ]
      );
      taskTotal += 1;
    }

    return taskTotal;
  }).then((taskTotal) => {
    console.log("==========================================");
    console.log("✅ SISTEM JE USPJEŠNO POPUNJEN!");
    console.log(`   Ukupno unijeto pacijenata: ${taskTotal}`);
    console.log("   Lozinka za sve: 123456");
    console.log("   Superadmin: srdjan.msevic@gmail.com");
    console.log("==========================================");
  });
};

run()
  .catch((err) => {
    console.error("❌ Greška:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());