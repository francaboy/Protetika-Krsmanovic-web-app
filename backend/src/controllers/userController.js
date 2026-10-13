const bcrypt = require("bcryptjs");
const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { emitGlobal } = require("../realtime");

// GET /api/users/search?q= — pretraga ili svi korisnici
const searchUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || "").trim();

  let sql;
  let params;

  if (q.length >= 2) {
    sql = `
      SELECT id, name, email, role, avatar_url
        FROM users
       WHERE name ILIKE $1 OR email ILIKE $1
       ORDER BY name ASC
       LIMIT 50
    `;
    params = [`%${q}%`];
  } else {
    // Vrati sve korisnike ordinacije sa ulogama
    sql = `
      SELECT id, name, email, role, avatar_url
        FROM users
       ORDER BY name ASC
    `;
    params = [];
  }

  const { rows } = await query(sql, params);
  res.json({ users: rows });
});

// PUT /api/users/profile — Izmjena imena
const updateProfile = asyncHandler(async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) throw ApiError.badRequest("Ime i prezime je obavezno polje");

  const { rows } = await query(
    `UPDATE users
        SET name = $1
      WHERE id = $2
      RETURNING id, name, email, role, avatar_url`,
    [name, req.user.id]
  );

  if (!rows.length) throw ApiError.notFound("Korisnik nije pronađen");
  res.json({ user: rows[0], message: "Profil je uspješno ažuriran" });
});

// PUT /api/users/change-password — Promjena lozinke
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest("Trenutna i nova lozinka su obavezna polja");
  }

  if (newPassword.length < 6) {
    throw ApiError.badRequest("Nova lozinka mora imati najmanje 6 znakova");
  }

  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!rows.length) throw ApiError.notFound("Korisnik nije pronađen");

  const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!isMatch) {
    throw ApiError.badRequest("Trenutna lozinka nije ispravna");
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user.id]);

  res.json({ message: "Lozinka je uspješno promijenjena" });
});

// PATCH /api/users/:id/role — Dozvola isključivo za Super Admina (owner)
const updateUserRole = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner") {
    throw ApiError.forbidden("Samo Super Admin može mijenjati uloge korisnika");
  }

  const targetUserId = req.params.id;
  const { role } = req.body;

  const VALID_ROLES = ["owner", "admin", "member"];
  if (!VALID_ROLES.includes(role)) {
    throw ApiError.badRequest("Neispravna uloga korisnika");
  }

  // Zaštita: Vlasnik ne može sam sebi skinuti Super Admin ulogu ako je jedini
  if (String(targetUserId) === String(req.user.id) && role !== "owner") {
    const countRes = await query("SELECT COUNT(*) FROM users WHERE role = 'owner'");
    if (parseInt(countRes.rows[0].count, 10) <= 1) {
      throw ApiError.badRequest("Ne možete promijeniti svoju ulogu jer ste jedini Super Admin");
    }
  }

  const { rows } = await query(
    `UPDATE users
        SET role = $1
      WHERE id = $2
      RETURNING id, name, email, role, avatar_url`,
    [role, targetUserId]
  );

  if (!rows.length) throw ApiError.notFound("Korisnik nije pronađen");
  res.json({ user: rows[0], message: "Uloga je uspješno ažurirana" });
});

// DELETE /api/users/:id — Brisanje korisnika (samo Super Admin i Admin)
const deleteUser = asyncHandler(async (req, res) => {
  if (req.user.role !== "owner" && req.user.role !== "admin") {
    throw ApiError.forbidden("Nemate ovlašćenje za brisanje zaposlenih");
  }

  const targetId = req.params.id;

  if (String(targetId) === String(req.user.id)) {
    throw ApiError.badRequest("Ne možete obrisati sopstveni nalog");
  }

  // Provjera postojanja korisnika i njegove uloge
  const userCheck = await query("SELECT id, name, role FROM users WHERE id = $1", [targetId]);
  if (!userCheck.rows.length) throw ApiError.notFound("Korisnik nije pronađen");

  const targetUser = userCheck.rows[0];
  if (targetUser.role === "owner") {
    throw ApiError.badRequest("Nalog sa Super Admin ulogom se ne može obrisati");
  }

  // 1. Provjera da li je vlasnik nekog kartona pacijenta
  const ownedBoards = await query("SELECT COUNT(*) FROM boards WHERE owner_id = $1", [targetId]);
  const ownedBoardsCount = parseInt(ownedBoards.rows[0].count, 10);

  // 2. Provjera da li je pridruženi član na kartonima pacijenata
  const memberBoards = await query("SELECT COUNT(*) FROM board_members WHERE user_id = $1", [targetId]);
  const memberBoardsCount = parseInt(memberBoards.rows[0].count, 10);

  // 3. Provjera aktivnih zaduženja na fazama rada
  const assignedTasks = await query("SELECT COUNT(*) FROM tasks WHERE assignee_id = $1", [targetId]);
  const assignedTasksCount = parseInt(assignedTasks.rows[0].count, 10);

  const totalPatients = ownedBoardsCount + memberBoardsCount;

  if (totalPatients > 0 || assignedTasksCount > 0) {
    throw ApiError.badRequest(
      `Korisnik se ne može obrisati jer još uvijek ima ${totalPatients} dodijeljenih pacijenata i ${assignedTasksCount} zaduženih faza rada.`
    );
  }

  // Brisanje iz baze
  await query("DELETE FROM users WHERE id = $1", [targetId]);

  // Obavještavanje svih u realnom vremenu
  emitGlobal("user:deleted", { id: targetId });

  res.json({ success: true, message: `Korisnik ${targetUser.name} je uspješno obrisan` });
});

module.exports = {
  searchUsers,
  updateProfile,
  changePassword,
  updateUserRole,
  deleteUser,
};