/** Loads a few sample leads. Safe to run repeatedly: it replaces existing rows. */
import { createPool } from "./db.js";

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const leads = [
  { name: "Sarah Connor", company: "Acme Corp", phone: "555-0199", status: "Proposal Sent", follow: days(0), created: days(-10),
    notes: [["Lead created via web form.", -10], ["Discovery call. They need a CRM for 50 reps.", -5], ["Sent pricing PDF. Will review with her boss.", -2]] },
  { name: "Hank Scorpio", company: "Globex", phone: "555-0742", status: "New", follow: null, created: days(0),
    notes: [["Inbound lead from website contact form.", 0]] },
  { name: "Ellen Ripley", company: "Weyland-Yutani", phone: "555-0311", status: "Qualified", follow: days(-2), created: days(-14),
    notes: [["Intro call went well. Budget confirmed.", -7], ["Waiting on legal review.", -3]] },
  { name: "Marty McFly", company: "Hill Valley Labs", phone: "555-0155", status: "Won", follow: null, created: days(-30),
    notes: [["Contract signed.", -4]] },
  { name: "Dana Scully", company: "Bureau Analytics", phone: "555-0107", status: "Contacted", follow: days(2), created: days(-3),
    notes: [["Left voicemail. Follow up Thursday.", -1]] },
  { name: "Tony Stark", company: "Stark Industries", phone: "555-0001", status: "Lost", follow: null, created: days(-45),
    notes: [["Went with an in-house tool.", -20]] },
] as const;

async function main() {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE discussions, leads RESTART IDENTITY");
    for (const l of leads) {
      const { rows } = await client.query(
        `INSERT INTO leads (name, company, phone, status, follow_up_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
        [l.name, l.company, l.phone, l.status, l.follow, l.created]
      );
      for (const [note, d] of l.notes) {
        await client.query(
          "INSERT INTO discussions (lead_id, note, created_at) VALUES ($1,$2,$3)",
          [rows[0].id, note, days(d)]
        );
      }
    }
    await client.query("COMMIT");
    console.log(`seeded ${leads.length} leads`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
