-- Fix for missing seats_total column error
-- Run this in Supabase SQL Editor

-- 1. Check if seats_total column exists, if not add it
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS seats_total INT NOT NULL DEFAULT 4;

-- 2. Make sure seats_taken also exists
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS seats_taken INT DEFAULT 0;

-- 3. Create an index on seats_total for better query performance
CREATE INDEX IF NOT EXISTS idx_rides_seats_total ON rides(seats_total);

-- 4. Verify columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'rides' AND column_name IN ('seats_total', 'seats_taken');
