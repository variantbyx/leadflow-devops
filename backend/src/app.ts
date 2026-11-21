import express, { type NextFunction, type Request, type Response } from "express";
import type pg from "pg";
import { LEAD_STATUSES, type LeadStatus } from "./types.js";

/** Create the Express app. The pool is injected so tests can bring their own. */
export function createApp(pool: pg.Pool) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  // ── Operational endpoints ───────────────────────────────────────
  // Liveness: the process is up. Does not touch the database.
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Readiness: the process can serve traffic (database reachable).
  app.get("/readyz", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not ready" });
    }
  });

  // Which build is running? Set APP_VERSION at build or deploy time.
  app.get("/version", (_req, res) => {
    res.json({ version: process.env.APP_VERSION ?? "dev" });
  });

  // ── Leads ───────────────────────────────────────────────────────
  app.get("/api/leads", wrap(async (req, res) => {
    const where: string[] = [];
    const params: unknown[] = [];
    const status = req.query.status as LeadStatus | undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
      params.push(status);
      where.push(`l.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(l.name ILIKE $${params.length} OR l.company ILIKE $${params.length})`);
    }

    const { rows } = await pool.query(
      `SELECT l.*, d.note AS last_note, d.created_at AS last_discussion_at
         FROM leads l
         LEFT JOIN LATERAL (
           SELECT note, created_at FROM discussions
            WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1
         ) d ON true
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY l.updated_at DESC`,
      params
    );
    res.json(rows);
  }));

  app.post("/api/leads", wrap(async (req, res) => {
    const { name, company, phone } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    const { rows } = await pool.query(
      `INSERT INTO leads (name, company, phone) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), clean(company), clean(phone)]
    );
    res.status(201).json(rows[0]);
  }));

  app.get("/api/leads/:id", wrap(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: "Lead not found" });
    const lead = (await pool.query("SELECT * FROM leads WHERE id = $1", [id])).rows[0];
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const discussions = (
      await pool.query(
        "SELECT * FROM discussions WHERE lead_id = $1 ORDER BY created_at DESC",
        [id]
      )
    ).rows;
    res.json({ ...lead, discussions });
  }));

  app.patch("/api/leads/:id", wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const status = req.body?.status;
    if (!status || !(LEAD_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${LEAD_STATUSES.join(", ")}`,
      });
    }
    if (id === null) return res.status(404).json({ error: "Lead not found" });
    const { rows } = await pool.query(
      "UPDATE leads SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [status, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Lead not found" });
    res.json(rows[0]);
  }));

  // ── Discussions ─────────────────────────────────────────────────
  app.get("/api/leads/:id/discussions", wrap(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(404).json({ error: "Lead not found" });
    const lead = await pool.query("SELECT id FROM leads WHERE id = $1", [id]);
    if (!lead.rows[0]) return res.status(404).json({ error: "Lead not found" });
    const { rows } = await pool.query(
      "SELECT * FROM discussions WHERE lead_id = $1 ORDER BY created_at DESC",
      [id]
    );
    res.json(rows);
  }));

  app.post("/api/leads/:id/discussions", wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { note, follow_up_at } = req.body ?? {};
    if (typeof note !== "string" || !note.trim()) {
      return res.status(400).json({ error: "Note is required" });
    }
    if (follow_up_at && Number.isNaN(Date.parse(follow_up_at))) {
      return res.status(400).json({ error: "follow_up_at must be an ISO 8601 date" });
    }
    if (id === null) return res.status(404).json({ error: "Lead not found" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lead = await client.query("SELECT id FROM leads WHERE id = $1 FOR UPDATE", [id]);
      if (!lead.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Lead not found" });
      }
      const d = await client.query(
        `INSERT INTO discussions (lead_id, note, follow_up_at)
         VALUES ($1, $2, $3) RETURNING *`,
        [id, note.trim(), follow_up_at || null]
      );
      await client.query(
        `UPDATE leads
            SET follow_up_at = COALESCE($1::timestamptz, follow_up_at), updated_at = now()
          WHERE id = $2`,
        [follow_up_at || null, id]
      );
      await client.query("COMMIT");
      res.status(201).json(d.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }));

  // ── Stats ───────────────────────────────────────────────────────
  app.get("/api/stats", wrap(async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int                                                        AS "totalLeads",
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS "newThisMonth",
        COUNT(*) FILTER (WHERE status = 'Won')::int                          AS "wonCount",
        COUNT(*) FILTER (WHERE follow_up_at >= date_trunc('day', now()))::int AS "followUpsDue",
        COUNT(*) FILTER (WHERE follow_up_at <  date_trunc('day', now()))::int AS "overdueCount"
      FROM leads`);
    const s = rows[0];
    res.json({
      ...s,
      conversionRate: s.totalLeads > 0 ? Math.round((s.wonCount / s.totalLeads) * 100) : 0,
    });
  }));

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: "error", msg: err.message }));
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function parseId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
