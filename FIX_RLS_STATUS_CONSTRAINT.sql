-- Fix RLS and status check constraint errors
-- Run this in Supabase SQL Editor

-- 1. Remove existing status check constraint if it exists
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check CASCADE;

-- 2. Add proper status check constraint
ALTER TABLE rides
ADD CONSTRAINT rides_status_check 
CHECK (status IN ('open', 'full', 'locked', 'completed', 'cancelled'));

-- 3. Ensure status has default value
ALTER TABLE rides
ALTER COLUMN status SET DEFAULT 'open';

-- 4. Fix RLS policy - Enable INSERT for authenticated users
-- First, check if RLS is enabled
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rides';

-- 5. Drop existing INSERT policy if needed and create new one
DROP POLICY IF EXISTS "Users can insert own rides" ON rides;

CREATE POLICY "Users can insert own rides" 
ON rides 
FOR INSERT 
WITH CHECK (
  auth.uid() = host_id OR 
  host_id = 'system' -- Allow system user for auto-bucket rides
);

-- 6. Enable RLS on rides table
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

-- 7. Create SELECT policy
DROP POLICY IF EXISTS "Rides are visible to all authenticated users" ON rides;

CREATE POLICY "Rides are visible to all authenticated users"
ON rides
FOR SELECT
USING (true); -- Allow all authenticated users to see all rides

-- 8. Create UPDATE policy for ride owners
DROP POLICY IF EXISTS "Users can update their own rides" ON rides;

CREATE POLICY "Users can update their own rides"
ON rides
FOR UPDATE
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- 9. Verify constraints
-- SELECT constraint_name FROM information_schema.table_constraints 
-- WHERE table_name = 'rides' AND constraint_type = 'CHECK';
