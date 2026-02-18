-- Add zone tracking columns to rides table
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS pickup_zone_id UUID REFERENCES travel_zones(id),
ADD COLUMN IF NOT EXISTS drop_zone_id UUID REFERENCES travel_zones(id);

-- Add zone tracking columns to hoppers table for better matching
ALTER TABLE hoppers
ADD COLUMN IF NOT EXISTS pickup_zone_id UUID REFERENCES travel_zones(id),
ADD COLUMN IF NOT EXISTS drop_zone_id UUID REFERENCES travel_zones(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rides_pickup_zone ON rides(pickup_zone_id);
CREATE INDEX IF NOT EXISTS idx_rides_drop_zone ON rides(drop_zone_id);
CREATE INDEX IF NOT EXISTS idx_hoppers_pickup_zone ON hoppers(pickup_zone_id);
CREATE INDEX IF NOT EXISTS idx_hoppers_drop_zone ON hoppers(drop_zone_id);
