const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL || "";
if (!connectionString) {
  console.error("[db] DATABASE_URL is not set. Set it to your Neon Postgres connection string.");
}

const pool = new Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      credits_used INT NOT NULL DEFAULT 0,
      credits_period TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
      bonus_credits INT NOT NULL DEFAULT 0,
      unlimited BOOLEAN NOT NULL DEFAULT false,
      last_login_at TIMESTAMPTZ,
      last_login_ip TEXT
    );
  `);

  // Saved profile (name + address) so users don't have to retype it on every
  // receipt. Added with ALTER TABLE so it's safe to run against a database
  // that already has the users table from before this feature existed.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_first_name TEXT NOT NULL DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_whole_name TEXT NOT NULL DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_address1 TEXT NOT NULL DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_address2 TEXT NOT NULL DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_address3 TEXT NOT NULL DEFAULT '';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_address4 TEXT NOT NULL DEFAULT '';`);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      ip TEXT,
      last_seen_at TIMESTAMPTZ,
      last_seen_ip TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS generations (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      template TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      failures INT NOT NULL DEFAULT 0,
      blocked_until TIMESTAMPTZ
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id);`);
}

module.exports = { pool, query, initSchema };
