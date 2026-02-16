-- FINAL ROBUST RPC FIX (v1.4)
-- This script fixes the "operator does not exist: date + text" error by casting types explicitly.

-- 1. DROP EVERYTHING
DROP FUNCTION IF EXISTS public.expire_past_rides();

-- 2. CREATE FUNCTION
CREATE OR REPLACE FUNCTION public.expire_past_rides()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update rides to 'expired'
    -- We explicitly cast "time" to TIME to handle cases where it might be stored as TEXT
    UPDATE public.rides
    SET status = 'expired'
    WHERE status IN ('open', 'full', 'locked')
    AND (
        CASE 
            WHEN "time" IS NULL OR "time"::text = '' THEN "date" + INTERVAL '23 hours 59 minutes'
            ELSE "date" + "time"::time
        END
    ) < (NOW() - INTERVAL '2 hours');
    
    -- Also expire the members of those rides
    UPDATE public.ride_members
    SET status = 'expired'
    WHERE status = 'pending'
    AND ride_id IN (SELECT id FROM public.rides WHERE status = 'expired');
END;
$$;

-- 3. PERMISSIONS
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO anon;
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO service_role;

-- 4. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';
