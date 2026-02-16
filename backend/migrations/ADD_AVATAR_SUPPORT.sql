-- Add avatar_url to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update RLS for profiles if needed (already likely exists for other updates)
-- Users can update their own avatar_url
DROP POLICY IF EXISTS "Users can update their own avatar" ON public.profiles;
CREATE POLICY "Users can update their own avatar"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
