-- COMPREHENSIVE FIX FOR COST SPLITTING SCHEMA & RLS
-- This script fixes the 500 errors (recursion) and column name mismatches.

-- 1. FIX FOREIGN KEYS & CONSTRAINTS
ALTER TABLE public.id_verifications 
DROP CONSTRAINT IF EXISTS id_verifications_user_id_fkey,
ADD CONSTRAINT id_verifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT id_verifications_user_id_key UNIQUE (user_id);

ALTER TABLE public.ride_links 
DROP CONSTRAINT IF EXISTS ride_links_user_id_fkey,
ADD CONSTRAINT ride_links_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure ride_links has correct columns for the parser
ALTER TABLE public.ride_links 
RENAME COLUMN original_url TO original_link;
ALTER TABLE public.ride_links 
RENAME COLUMN estimated_duration_minutes TO estimated_duration;
ALTER TABLE public.ride_links 
RENAME COLUMN estimated_distance_km TO estimated_distance;
-- Add currency if missing
ALTER TABLE public.ride_links ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.ride_links ADD COLUMN IF NOT EXISTS raw_metadata JSONB;

ALTER TABLE public.cost_splits 
DROP CONSTRAINT IF EXISTS cost_splits_creator_id_fkey,
ADD CONSTRAINT cost_splits_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Rename columns in cost_splits for parity with code
ALTER TABLE public.cost_splits RENAME COLUMN creator_id TO created_by;
ALTER TABLE public.cost_splits RENAME COLUMN number_of_people TO split_count;
ALTER TABLE public.cost_splits RENAME COLUMN per_person_amount TO amount_per_person;

-- Add default for share_token
ALTER TABLE public.cost_splits 
ALTER COLUMN share_token SET DEFAULT substring(md5(random()::text) from 1 for 8);

ALTER TABLE public.split_members 
DROP CONSTRAINT IF EXISTS split_members_user_id_fkey,
ADD CONSTRAINT split_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Update split_members status constraint
ALTER TABLE public.split_members 
DROP CONSTRAINT IF EXISTS split_members_payment_status_check;
ALTER TABLE public.split_members 
ADD CONSTRAINT split_members_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'settled'));

-- 2. FIX RLS INFINITE RECURSION
-- Create security definer helper functions
CREATE OR REPLACE FUNCTION public.check_is_split_creator(p_split_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cost_splits
    WHERE id = p_split_id AND created_by = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_split_member(p_split_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.split_members
    WHERE split_id = p_split_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update cost_splits policies
DROP POLICY IF EXISTS "Users can view splits they're part of or created" ON public.cost_splits;
CREATE POLICY "Users can view splits they're part of or created"
  ON public.cost_splits
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by OR
    public.check_is_split_member(id, auth.uid()) OR
    share_token IS NOT NULL
  );

-- Update split_members policies
DROP POLICY IF EXISTS "Members can view their own split membership" ON public.split_members;
DROP POLICY IF EXISTS "Users can view members of splits they're in" ON public.split_members;

CREATE POLICY "Users can view split members if they are in it or created it"
  ON public.split_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.check_is_split_creator(split_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.cost_splits WHERE id = split_id AND share_token IS NOT NULL)
  );

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.check_is_split_creator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_split_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_split_creator(UUID, UUID) TO anon; -- Needed for shared views
GRANT EXECUTE ON FUNCTION public.check_is_split_member(UUID, UUID) TO anon;
