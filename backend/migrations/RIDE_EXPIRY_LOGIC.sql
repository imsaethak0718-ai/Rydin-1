-- Migration to handle Ride and Request Expiry logic

-- 1. Update status constraints to include 'expired'
-- We wrap in DO blocks to be safe if constraints have different names
DO $$ 
BEGIN 
    ALTER TABLE ride_members DROP CONSTRAINT IF EXISTS ride_members_status_check;
    ALTER TABLE ride_members ADD CONSTRAINT ride_members_status_check 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired'));
END $$;

DO $$ 
BEGIN 
    ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
    ALTER TABLE rides ADD CONSTRAINT rides_status_check 
        CHECK (status IN ('open', 'full', 'locked', 'completed', 'cancelled', 'expired'));
END $$;

-- 2. Create function to automatically expire rides whose time has passed
CREATE OR REPLACE FUNCTION expire_past_rides()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Mark rides as expired if departure time has passed (with a 2-hour grace period)
    -- We assume 'date' is DATE and 'time' is TIME (converted to timestamp for comparison)
    WITH past_rides AS (
        SELECT id FROM rides
        WHERE status IN ('open', 'full', 'locked')
        AND (date + time) < (NOW() - INTERVAL '2 hours')
    )
    UPDATE rides
    SET status = 'expired'
    WHERE id IN (SELECT id FROM past_rides);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Mark pending requests for those rides as expired too
    UPDATE ride_members
    SET status = 'expired'
    WHERE status = 'pending'
    AND ride_id IN (SELECT id FROM rides WHERE status = 'expired');
    
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a trigger to check for expiry on every select (Passive approach)
-- Note: A real cron job is better, but this ensures a user always sees fresh data
-- Alternately, we can just update the frontend queries as well.
