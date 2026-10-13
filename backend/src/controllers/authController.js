const bcrypt = require("bcryptjs");
const { query } = require("../config/db");
const { signToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { emitGlobal } = require("../realtime");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role || "member",
  avatar_url: u.avatar_url,
  created_at: u.created_at,
});

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const { password } = req.body;

  if (!name) throw ApiError.badRequest("Ime i prezime je obavezno polje");
  if (!EMAIL_RE.test(email)) throw ApiError.badRequest("Unesite ispravnu e-mail adresu");
  if (!password || password.length < 6)
    throw ApiError.badRequest("Lozinka mora imati najmanje 6 znakova");

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) throw ApiError.conflict("Nalog sa ovom e-mail adresom već postoji");

  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, avatar_url, created_at`,
    [name, email, password_hash]
  );

  const user = rows[0];
  const userData = publicUser(user);

  emitGlobal("user:registered", userData);

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.status(201).json({ user: userData, token });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const { password } = req.body;

  if (!email || !password) throw ApiError.badRequest("E-mail i lozinka su obavezna polja");

  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user) throw ApiError.unauthorized("Neispravna e-mail adresa ili lozinka");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw ApiError.unauthorized("Neispravna e-mail adresa ili lozinka");

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.json({ user: publicUser(user), token });
});

// POST /api/auth/reset-password-pin
const resetPasswordWithPin = asyncHandler(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const pin = (req.body.pin || "").trim();
  const newPassword = req.body.newPassword;

  if (!email || !pin || !newPassword) {
    throw ApiError.badRequest("E-mail, PIN ordinacije i nova lozinka su obavezna polja");
  }

  // Provjera PIN-a iz .env (CLINIC_MASTER_PIN) ili default 123456
  const masterPin = process.env.CLINIC_MASTER_PIN || "123456";
  if (pin !== masterPin) {
    throw ApiError.forbidden("Neispravan sigurnosni PIN ordinacije");
  }

  if (newPassword.length < 6) {
    throw ApiError.badRequest("Nova lozinka mora imati najmanje 6 znakova");
  }

  const { rows } = await query("SELECT id, name FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user) {
    throw ApiError.notFound("Korisnički nalog sa ovom e-mail adresom nije pronađen");
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [password_hash, user.id]);

  res.json({ success: true, message: "Lozinka je uspješno promijenjena" });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  const { rows } = await query(
    "SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = $1",
    [req.user.id]
  );
  if (!rows.length) throw ApiError.notFound("Korisnički nalog nije pronađen");
  res.json({ user: rows[0] });
});

module.exports = { register, login, resetPasswordWithPin, me };