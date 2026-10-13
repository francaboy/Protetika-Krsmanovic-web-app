const { verifyToken } = require("../utils/jwt");
const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Express middleware: zahtijeva validan Bearer token i postavlja svježeg req.user iz baze.
const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized("Nedostaje autentifikacioni token");

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw ApiError.unauthorized("Nevažeći ili istekao autentifikacioni token");
  }

  // Uvijek dohvataj najsvježiju ulogu direktno iz baze
  const { rows } = await query(
    "SELECT id, name, email, role FROM users WHERE id = $1",
    [decoded.id]
  );

  if (!rows.length) {
    throw ApiError.unauthorized("Korisnički nalog više ne postoji");
  }

  req.user = rows[0];
  next();
});

module.exports = { requireAuth };