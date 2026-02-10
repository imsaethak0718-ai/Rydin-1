-- Fix the foreign key relationship between rides and profiles
-- This ensures PostgREST can find the relationship for joins

-- First, check what foreign keys exist
-- SELECT constraint_name, table_name, column_name, foreign_table_name
-- FROM information_schema.table_constraints
-- WHERE table_name = 'rides' AND constraint_type = 'FOREIGN KEY';

-- Drop the old constraint if it exists
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_host_id_fkey CASCADE;

-- Re-add the foreign key with explicit name
ALTER TABLE rides
ADD CONSTRAINT rides_host_id_fkey 
FOREIGN KEY (host_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Verify the constraint exists
-- SELECT * FROM information_schema.table_constraints 
-- WHERE table_name = 'rides' AND constraint_type = 'FOREIGN KEY';

-- Force schema cache refresh by toggling schema publication
-- This helps PostgREST discover the relationship
ALTER PUBLICATION supabase_realtime DROP TABLE rides CASCADE;
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
