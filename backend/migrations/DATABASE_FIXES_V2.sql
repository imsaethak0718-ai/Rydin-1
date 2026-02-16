-- DATABASE SCHEMA INTEGRITY & RPC FIXES
-- This script ensures all joins work correctly in PostgREST and the missing RPCs are created.

-- 1. Ensure Profiles table has required foreign keys for auto-joining
-- Note: Supabase's PostgREST needs explicit FK relationships to perform joins like .select('*, profiles(*)')

-- Fix ride_members -> profiles relationship
ALTER TABLE public.ride_members 
DROP CONSTRAINT IF EXISTS ride_members_user_id_fkey,
ADD CONSTRAINT ride_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix rides -> profiles (host) relationship
ALTER TABLE public.rides 
DROP CONSTRAINT IF EXISTS rides_host_id_fkey,
ADD CONSTRAINT rides_host_id_fkey 
FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix train_info -> profiles relationship
ALTER TABLE public.train_info 
DROP CONSTRAINT IF EXISTS train_info_user_id_fkey,
ADD CONSTRAINT train_info_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Create the missing RPC: expire_past_rides
-- (Ensuring it exists in the public schema)
CREATE OR REPLACE FUNCTION public.expire_past_rides()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Mark rides as expired if departure time has passed (with a 2-hour grace period)
    -- date is DATE, time is TIME
    WITH past_rides AS (
        SELECT id FROM public.rides
        WHERE status IN ('open', 'full', 'locked')
        AND (date + time) < (NOW() - INTERVAL '2 hours')
    )
    UPDATE public.rides
    SET status = 'expired'
    WHERE id IN (SELECT id FROM past_rides);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Mark pending requests for those rides as expired too
    UPDATE public.ride_members
    SET status = 'expired'
    WHERE status = 'pending'
    AND ride_id IN (SELECT id FROM public.rides WHERE status = 'expired');
    
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure ride_messages -> profiles relationship
ALTER TABLE public.ride_messages
DROP CONSTRAINT IF EXISTS ride_messages_user_id_fkey,
ADD CONSTRAINT ride_messages_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Grant access to the function
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO anon;
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO service_role;
