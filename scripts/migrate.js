require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require(path.join(__dirname, '..', 'config', 'db'));

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations() {
  const { rows } = await pool.query('SELECT name FROM migrations ORDER BY id ASC');
  return rows.map((r) => r.name);
}

async function runUp() {
  await ensureTrackingTable();

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.up.sql')).sort();
  if (files.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  const executed = await getExecutedMigrations();

  for (const file of files) {
    const name = file.replace('.up.sql', '');
    if (executed.includes(name)) {
      console.log(`Skipping ${file} (already executed).`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`Running ${file}...`);

    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
      await pool.query('COMMIT');
      console.log(`  Done: ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`  Failed: ${file} - ${err.message}`);
      process.exit(1);
    }
  }
}

async function runDown() {
  await ensureTrackingTable();

  const { rows } = await pool.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) {
    console.log('No migrations to roll back.');
    return;
  }

  const name = rows[0].name;
  const downFile = path.join(MIGRATIONS_DIR, `${name}.down.sql`);

  if (!fs.existsSync(downFile)) {
    console.error(`Down migration not found: ${name}.down.sql`);
    process.exit(1);
  }

  const sql = fs.readFileSync(downFile, 'utf-8');
  console.log(`Rolling back ${name}...`);

  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('DELETE FROM migrations WHERE name = $1', [name]);
    await pool.query('COMMIT');
    console.log(`  Done: ${name}`);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(`  Failed: ${name} - ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  if (!command || (command !== 'up' && command !== 'down')) {
    console.error('Usage: node scripts/migrate.js <up|down>');
    process.exit(1);
  }

  try {
    if (command === 'up') {
      await runUp();
    } else {
      await runDown();
    }
    console.log('Done.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
