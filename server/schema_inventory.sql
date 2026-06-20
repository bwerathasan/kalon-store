-- ════════════════════════════════════════
-- SILLAGE — Inventory + Waitlist schema
-- Run this in Supabase → SQL Editor
-- ════════════════════════════════════════

-- Inventory: one row per physical SKU (citrus, rouge, sweet)
CREATE TABLE IF NOT EXISTS inventory (
  product    TEXT PRIMARY KEY,
  stock      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT stock_non_negative CHECK (stock >= 0)
);

-- Initial stock — citrus 40, rouge 130, sweet 40
INSERT INTO inventory (product, stock) VALUES
  ('citrus',  40),
  ('rouge',  130),
  ('sweet',   40)
ON CONFLICT (product) DO UPDATE SET stock = EXCLUDED.stock;

-- Waitlist: one row per email+product subscription
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT NOT NULL,
  product    TEXT NOT NULL,
  notified   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate active subscriptions for same email+product
-- (allows re-signup after being notified)
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_active_unique
  ON waitlist (email, product)
  WHERE notified = FALSE;
