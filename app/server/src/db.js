import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const {
  DB_HOST = '127.0.0.1',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_DATABASE = 'hypertrophy'
} = process.env;

let pool;

export const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: false
    });
  }
  return pool;
};

export async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD
  });
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_DATABASE}\``);
  } finally {
    await connection.end();
  }
}
