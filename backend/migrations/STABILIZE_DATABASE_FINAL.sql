-- FINAL COMPREHENSIVE FIX FOR Rydin - SCHEMA & RLS RECURSION (v1.1 Robust)
-- This script fixes the 500 error in Leaderboards/Profile and the 400 errors in Split creation.
-- Updated to be fully idempotent (safe to run multiple times).

-- 1. HARMONIZE Profiles table (ensure missing columns exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. FIX id_verifications
-- Change FK to profiles and add UNIQUE constraint for UPSERT
ALTER TABLE public.id_verifications 
DROP CONSTRAINT IF EXISTS id_verifications_user_id_fkey;

ALTER TABLE public.id_verifications
ADD CONSTRAINT id_verifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'id_verifications_user_id_key') THEN
        ALTER TABLE public.id_verifications ADD CONSTRAINT id_verifications_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 3. FIX ride_links (Harmonize with RideLinkParser.ts and CreateSplit.tsx)
-- Explicitly check for column existence before renaming to avoid errors if already renamed
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ride_links' AND column_name = 'original_url') THEN
        ALTER TABLE public.ride_links RENAME COLUMN original_url TO original_link;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ride_links' AND column_name = 'estimated_duration_minutes') THEN
        ALTER TABLE public.ride_links RENAME COLUMN estimated_duration_minutes TO estimated_duration;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ride_links' AND column_name = 'estimated_distance_km') THEN
        ALTER TABLE public.ride_links RENAME COLUMN estimated_distance_km TO estimated_distance;
    END IF;
END $$;

-- Re-establish ride_links FK
ALTER TABLE public.ride_links 
DROP CONSTRAINT IF EXISTS ride_links_user_id_fkey;

ALTER TABLE public.ride_links 
ADD CONSTRAINT ride_links_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ride_links ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.ride_links ADD COLUMN IF NOT EXISTS raw_metadata JSONB;

-- 4. FIX cost_splits (Harmonize with CreateSplit.tsx and ViewSplit.tsx)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cost_splits' AND column_name = 'creator_id') THEN
        ALTER TABLE public.cost_splits RENAME COLUMN creator_id TO created_by;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cost_splits' AND column_name = 'number_of_people') THEN
        ALTER TABLE public.cost_splits RENAME COLUMN number_of_people TO split_count;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cost_splits' AND column_name = 'per_person_amount') THEN
        ALTER TABLE public.cost_splits RENAME COLUMN per_person_amount TO amount_per_person;
    END IF;
END $$;

-- Fix FK and add default for share_token
ALTER TABLE public.cost_splits 
DROP CONSTRAINT IF EXISTS cost_splits_creator_id_fkey,
DROP CONSTRAINT IF EXISTS cost_splits_created_by_fkey;

ALTER TABLE public.cost_splits 
ADD CONSTRAINT cost_splits_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.cost_splits 
ALTER COLUMN share_token SET DEFAULT substring(md5(random()::text) from 1 for 8);

-- 5. FIX split_members
ALTER TABLE public.split_members 
DROP CONSTRAINT IF EXISTS split_members_user_id_fkey;

ALTER TABLE public.split_members 
ADD CONSTRAINT split_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Update status constraint to include 'settled'
ALTER TABLE public.split_members 
DROP CONSTRAINT IF EXISTS split_members_payment_status_check;

ALTER TABLE public.split_members 
ADD CONSTRAINT split_members_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'settled'));

-- 6. FIX RLS INFINITE RECURSION (Critical for 500 error)
-- Use SECURITY DEFINER functions to break the recursion chain
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
DROP POLICY IF EXISTS "Public can view splits via share token" ON public.cost_splits;

CREATE POLICY "Users can view splits they're part of or created"
  ON public.cost_splits
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by OR
    public.check_is_split_member(id, auth.uid()) OR
    share_token IS NOT NULL
  );

CREATE POLICY "Public can view splits via share token"
  ON public.cost_splits
  FOR SELECT
  TO anon
  USING (share_token IS NOT NULL);

-- Update split_members policies
DROP POLICY IF EXISTS "Members can view their own split membership" ON public.split_members;
DROP POLICY IF EXISTS "Users can view members of splits they're in" ON public.split_members;
DROP POLICY IF EXISTS "Public can view members via cost_splits" ON public.split_members;
DROP POLICY IF EXISTS "Users can view split members if they are in it or created it" ON public.split_members;
DROP POLICY IF EXISTS "Public can view members via share token" ON public.split_members;

CREATE POLICY "Users can view split members if they are in it or created it"
  ON public.split_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.check_is_split_creator(split_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.cost_splits cs WHERE cs.id = split_id AND cs.share_token IS NOT NULL)
  );

CREATE POLICY "Public can view members via share token"
  ON public.split_members
  FOR SELECT
  TO anon
  USING (
    EXISTS (SELECT 1 FROM public.cost_splits cs WHERE cs.id = split_id AND cs.share_token IS NOT NULL)
  );

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION public.check_is_split_creator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_split_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_split_creator(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.check_is_split_member(UUID, UUID) TO anon;
