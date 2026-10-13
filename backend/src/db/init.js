// Runs schema.sql against the configured database. Usage: npm run db:init
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    console.log("Primjenjivanje baze podataka...");
    await pool.query(sql);
    console.log("✅ Baza podataka primjenjena.");
  } catch (err) {
    console.error("❌ Greška baze podataka:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
