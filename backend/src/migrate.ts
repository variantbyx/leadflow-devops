/**
 * Applies the SQL files in /migrations in order, once each.
 * Run it as a separate step. The API never migrates on startup.
 *
 *   npm run migrate          (development, TypeScript)
 *   npm run migrate:prod     (compiled, after `npm run build`)
 */
import fs from "node:fs";
import path from "node:path";
import { createPool } from "./db.js";

const dir = path.resolve(process.cwd(), "migrations");

export async function migrate(): Promise<string[]> {
  const pool = createPool();
  const applied: string[] = [];
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
    const done = new Set(
      (await pool.query("SELECT name FROM schema_migrations")).rows.map(
        (r) => r.name as string
      )
    );
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    return applied;
  } finally {
    await pool.end();
  }
}

// Run directly (not when imported by tests).
if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  migrate()
    .then((a) => console.log(a.length ? `applied: ${a.join(", ")}` : "nothing to apply"))
    .catch((e) => {
      console.error("migration failed:", e.message);
      process.exit(1);
    });
}
