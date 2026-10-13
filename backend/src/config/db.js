const { Pool } = require("pg");

// Neon requires SSL. The connection string already carries ?sslmode=require,
// but we set ssl explicitly so it works across local/prod environments.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

/**
 * Run a parameterized query against the pool.
 * @param {string} text SQL with $1, $2... placeholders
 * @param {Array} params
 */
const query = (text, params) => pool.query(text, params);

/**
 * Run a set of statements inside a single transaction.
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, withTransaction };
