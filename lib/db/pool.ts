import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const useSSL = process.env.DATABASE_SSL !== 'disable';
  pool = new Pool({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: true } : false,
  });
  return pool;
}
