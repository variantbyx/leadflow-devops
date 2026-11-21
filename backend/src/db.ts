import pg from "pg";

/** Build a connection pool from DATABASE_URL (no default on purpose). */
export function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return new pg.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    connectionTimeoutMillis: 5000,
  });
}
