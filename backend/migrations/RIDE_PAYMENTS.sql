-- Add payment tracking to profiles and ride_members
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Add payment status to ride_members to track settlements
ALTER TABLE public.ride_members ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid'));

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS ride_members_payment_status_idx ON public.ride_members(payment_status);

-- Update RLS policies to allow hosts to update payment status
DROP POLICY IF EXISTS "Hosts can update payment status of their members" ON public.ride_members;
CREATE POLICY "Hosts can update payment status of their members"
  ON public.ride_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_members.ride_id
      AND rides.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_members.ride_id
      AND rides.host_id = auth.uid()
    )
  );

-- Update RLS for profiles so users can update their own UPI ID
DROP POLICY IF EXISTS "Users can update their own upi_id" ON public.profiles;
CREATE POLICY "Users can update their own upi_id"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
