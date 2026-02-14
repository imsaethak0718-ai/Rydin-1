-- Add lock status to rides table
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id);

-- Create function to lock ride automatically when all seats filled
CREATE OR REPLACE FUNCTION auto_lock_ride_on_full()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if ride is now full
  IF (SELECT COUNT(*) FROM ride_members WHERE ride_id = NEW.ride_id AND status = 'accepted') >= (SELECT max_seats FROM rides WHERE id = NEW.ride_id) THEN
    UPDATE rides SET is_locked = TRUE, locked_at = NOW() WHERE id = NEW.ride_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-lock when ride is full
DROP TRIGGER IF EXISTS auto_lock_full_rides ON ride_members;
CREATE TRIGGER auto_lock_full_rides
AFTER INSERT OR UPDATE ON ride_members
FOR EACH ROW
EXECUTE FUNCTION auto_lock_ride_on_full();

-- Create function to lock ride manually (for host)
CREATE OR REPLACE FUNCTION lock_ride(ride_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE rides 
  SET is_locked = TRUE, locked_at = NOW(), locked_by = auth.uid()
  WHERE id = ride_id AND host_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to unlock ride manually (for host)
CREATE OR REPLACE FUNCTION unlock_ride(ride_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE rides 
  SET is_locked = FALSE, locked_at = NULL, locked_by = NULL
  WHERE id = ride_id AND host_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add index on lock status for faster queries
CREATE INDEX IF NOT EXISTS rides_is_locked_idx ON rides(is_locked);
CREATE INDEX IF NOT EXISTS rides_locked_at_idx ON rides(locked_at);

-- Update RLS policy to prevent edits on locked rides
DROP POLICY IF EXISTS "Users can update their own rides" ON rides;
CREATE POLICY "Users can update their own rides"
  ON rides
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id AND NOT is_locked)
  WITH CHECK (auth.uid() = host_id AND NOT is_locked);

-- Add policy to prevent joining locked rides
DROP POLICY IF EXISTS "Prevent joining locked rides" ON ride_members;
CREATE POLICY "Prevent joining locked rides"
  ON ride_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT (SELECT is_locked FROM rides WHERE id = ride_id)
  );

-- Create notification function for lock events
CREATE OR REPLACE FUNCTION notify_ride_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_locked AND NOT OLD.is_locked THEN
    -- Notify all ride members that the ride is locked
    INSERT INTO notifications (user_id, type, title, message, ride_id, created_at)
    SELECT 
      user_id, 
      'ride_locked', 
      'Ride Full', 
      'Your ride is now full and locked!',
      NEW.id,
      NOW()
    FROM ride_members 
    WHERE ride_id = NEW.id AND status = 'accepted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lock notifications
DROP TRIGGER IF EXISTS notify_ride_locked_trigger ON rides;
CREATE TRIGGER notify_ride_locked_trigger
AFTER UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION notify_ride_locked();

-- Create materialized view for locked rides
DROP MATERIALIZED VIEW IF EXISTS locked_rides_summary CASCADE;
CREATE MATERIALIZED VIEW locked_rides_summary AS
SELECT 
  r.id,
  r.from_location,
  r.to_location,
  r.departure_time,
  r.max_seats,
  COUNT(rm.id) as current_members,
  r.is_locked,
  r.locked_at
FROM rides r
LEFT JOIN ride_members rm ON r.id = rm.ride_id AND rm.status = 'accepted'
WHERE r.is_locked = TRUE
GROUP BY r.id;

-- Create index for performance
CREATE INDEX IF NOT EXISTS locked_rides_summary_locked_at_idx 
ON locked_rides_summary(locked_at);
