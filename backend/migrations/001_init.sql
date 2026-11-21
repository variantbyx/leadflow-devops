CREATE TABLE IF NOT EXISTS leads (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL,
  company       TEXT,
  phone         TEXT,
  status        TEXT        NOT NULL DEFAULT 'New',
  follow_up_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discussions (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id       INTEGER     NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note          TEXT        NOT NULL,
  follow_up_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussions_lead_id ON discussions(lead_id);
