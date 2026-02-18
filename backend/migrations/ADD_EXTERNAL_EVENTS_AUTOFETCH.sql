-- ============================================
-- EXTERNAL EVENTS AUTO-FETCH (TICKETMASTER + NOMINATIM)
-- ============================================

-- Extend existing events table with source-tracking and lifecycle fields
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_event_id TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS external_payload JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_status_external_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_status_external_check
      CHECK (status IN ('active', 'expired', 'cancelled', 'hidden'));
  END IF;
END $$;

-- Unique external ID to support upsert from providers
CREATE UNIQUE INDEX IF NOT EXISTS events_source_event_unique_idx
  ON events(source, source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
CREATE INDEX IF NOT EXISTS events_source_idx ON events(source);
CREATE INDEX IF NOT EXISTS events_expires_at_idx ON events(expires_at);
CREATE INDEX IF NOT EXISTS events_last_seen_at_idx ON events(last_seen_at);

-- Optional geocode cache to avoid repeated Nominatim requests
CREATE TABLE IF NOT EXISTS geocode_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL UNIQUE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'nominatim',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '180 days')
);

CREATE INDEX IF NOT EXISTS geocode_cache_expires_at_idx ON geocode_cache(expires_at);

-- Keep real-time publication in sync for event updates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE events';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Already included in publication
    NULL;
END $$;
