require('dotenv').config();

const { Pool } = require('pg');

// Connect to default 'postgres' database to create the target database
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres',
});

async function createDb() {
  const dbName = process.env.DB_NAME || 'myshop_db';
  try {
    await pool.query(`CREATE DATABASE ${dbName}`);
    console.log(`Database "${dbName}" created successfully.`);
  } catch (err) {
    if (err.code === '42P04') {
      console.log(`Database "${dbName}" already exists.`);
    } else {
      console.error('Error creating database:', err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) createDb();
