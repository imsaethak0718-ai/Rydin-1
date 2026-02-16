-- FIX FOR RLS RECURSION & JOIN ERRORS in Cost Splitting tables
-- This script fixes the 500 Internal Server Error caused by circular RLS policies.

-- 1. FIX FOREIGN KEYS to enable joins with profiles
ALTER TABLE public.id_verifications 
DROP CONSTRAINT IF EXISTS id_verifications_user_id_fkey,
ADD CONSTRAINT id_verifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ride_links 
DROP CONSTRAINT IF EXISTS ride_links_user_id_fkey,
ADD CONSTRAINT ride_links_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.cost_splits 
DROP CONSTRAINT IF EXISTS cost_splits_creator_id_fkey,
ADD CONSTRAINT cost_splits_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.split_members 
DROP CONSTRAINT IF EXISTS split_members_user_id_fkey,
ADD CONSTRAINT split_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.settlements 
DROP CONSTRAINT IF EXISTS settlements_from_user_id_fkey,
ADD CONSTRAINT settlements_from_user_id_fkey 
FOREIGN KEY (from_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
DROP CONSTRAINT IF EXISTS settlements_to_user_id_fkey,
ADD CONSTRAINT settlements_to_user_id_fkey 
FOREIGN KEY (to_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. FIX RLS INFINITE RECURSION
-- Create security definer helper functions to bypass RLS for internal checks
CREATE OR REPLACE FUNCTION public.check_is_split_creator(p_split_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cost_splits
    WHERE id = p_split_id AND creator_id = p_user_id
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
    auth.uid() = creator_id OR
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

-- 3. Grant permissions for functions
GRANT EXECUTE ON FUNCTION public.check_is_split_creator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_split_member(UUID, UUID) TO authenticated;
