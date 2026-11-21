import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import { createPool } from "../src/db.js";
import { migrate } from "../src/migrate.js";

// These tests need a PostgreSQL database: set DATABASE_URL (see README).
// They empty the tables, so never point them at data you care about.

const pool = createPool();
let server: Server;
let base: string;

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) as any };
};

before(async () => {
  await migrate();
  await pool.query("TRUNCATE discussions, leads RESTART IDENTITY CASCADE");
  server = createApp(pool).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});

describe("operational endpoints", () => {
  it("liveness and readiness are ok", async () => {
    assert.equal((await call("GET", "/healthz")).status, 500);
    assert.equal((await call("GET", "/readyz")).status, 200);
  });
});

describe("leads", () => {
  it("creates, reads and updates a lead", async () => {
    const created = await call("POST", "/api/leads", { name: "  Ada Lovelace ", company: "Analytical Co" });
    assert.equal(created.status, 201);
    assert.equal(created.json.name, "Ada Lovelace");
    assert.equal(created.json.status, "New");

    const id = created.json.id;
    assert.equal((await call("GET", `/api/leads/${id}`)).json.discussions.length, 0);

    const patched = await call("PATCH", `/api/leads/${id}`, { status: "Qualified" });
    assert.equal(patched.json.status, "Qualified");
  });

  it("rejects bad input", async () => {
    assert.equal((await call("POST", "/api/leads", { name: "  " })).status, 400);
    assert.equal((await call("PATCH", "/api/leads/1", { status: "Nope" })).status, 400);
    assert.equal((await call("GET", "/api/leads/99999")).status, 404);
    assert.equal((await call("GET", "/api/leads/abc")).status, 404);
  });

  it("filters by status and search", async () => {
    await call("POST", "/api/leads", { name: "Grace Hopper", company: "Navy" });
    const all = await call("GET", "/api/leads");
    assert.ok(all.json.length >= 2);
    const found = await call("GET", "/api/leads?search=hopper");
    assert.deepEqual(found.json.map((l: any) => l.name), ["Grace Hopper"]);
    const none = await call("GET", "/api/leads?status=Won");
    assert.equal(none.json.length, 0);
  });
});

describe("discussions and stats", () => {
  it("adds a discussion and sets the follow-up", async () => {
    const lead = (await call("POST", "/api/leads", { name: "Alan Turing" })).json;
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const d = await call("POST", `/api/leads/${lead.id}/discussions`, { note: "First call", follow_up_at: when });
    assert.equal(d.status, 201);
    const detail = (await call("GET", `/api/leads/${lead.id}`)).json;
    assert.equal(detail.discussions.length, 1);
    assert.equal(new Date(detail.follow_up_at).toISOString(), when);
    assert.equal((await call("POST", `/api/leads/${lead.id}/discussions`, { note: "" })).status, 400);
    assert.equal((await call("POST", "/api/leads/99999/discussions", { note: "x" })).status, 404);
  });

  it("reports stats", async () => {
    const s = (await call("GET", "/api/stats")).json;
    assert.ok(s.totalLeads >= 3);
    assert.equal(typeof s.conversionRate, "number");
  });
});
