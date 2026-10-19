-- EVOL-COM-001 / T1 — uniquement des compteurs agrégés et ID de dédoublonnage éphémères.
CREATE TABLE IF NOT EXISTS hourly_counts (
  hour_start_utc TEXT PRIMARY KEY NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0)
);
CREATE TABLE IF NOT EXISTS event_dedupe (
  event_id TEXT PRIMARY KEY NOT NULL,
  inserted_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_dedupe_date ON event_dedupe(inserted_at_utc);
