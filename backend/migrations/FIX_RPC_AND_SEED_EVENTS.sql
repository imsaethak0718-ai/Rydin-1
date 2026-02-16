-- FIX FOR RPC AND SEEDING CHENNAI EVENTS (v1.3 Ultra-Robust)
-- This script fixes the 404 for expire_past_rides and adds real events nearby Chennai.
-- It now features comprehensive schema harmonization for both 'events' and 'event_ride_rooms'.

-- 1. HARMONIZE EVENTS TABLE
DO $$ 
BEGIN 
    -- Rename columns if they exist as older variants
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'name') THEN
        ALTER TABLE public.events RENAME COLUMN "name" TO title;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'date') THEN
        ALTER TABLE public.events RENAME COLUMN "date" TO event_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'start_time') THEN
        ALTER TABLE public.events RENAME COLUMN start_time TO event_time;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'created_by') THEN
        ALTER TABLE public.events RENAME COLUMN created_by TO organizer_id;
    END IF;
END $$;

-- Ensure required columns exist in events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. HARMONIZE EVENT_RIDE_ROOMS TABLE
DO $$ 
BEGIN 
    -- Rename columns if they exist as older variants
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_ride_rooms' AND column_name = 'max_seats') THEN
        ALTER TABLE public.event_ride_rooms RENAME COLUMN max_seats TO max_capacity;
    END IF;
END $$;

-- Ensure critical columns exist in event_ride_rooms
ALTER TABLE public.event_ride_rooms ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.event_ride_rooms ADD COLUMN IF NOT EXISTS departure_location TEXT NOT NULL DEFAULT 'SRM Campus';
ALTER TABLE public.event_ride_rooms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.event_ride_rooms ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 4;

-- 3. FIX expire_past_rides RPC (The 404 Fix)
CREATE OR REPLACE FUNCTION public.expire_past_rides()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Mark rides as expired if departure time has passed (with a 2-hour grace period)
    -- We use a flexible cast to handle both DATE+TIME and TIMESTAMP formats
    UPDATE public.rides
    SET status = 'expired'
    WHERE status IN ('open', 'full', 'locked')
    AND (
        CASE 
            WHEN date_trunc('day', date) = date THEN (date + time)
            ELSE date 
        END
    ) < (NOW() - INTERVAL '2 hours');
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Mark pending requests for those rides as expired too
    UPDATE public.ride_members
    SET status = 'expired'
    WHERE status = 'pending'
    AND ride_id IN (SELECT id FROM public.rides WHERE status = 'expired');
    
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to both authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_past_rides() TO anon;

-- 4. SEED CHENNAI EVENTS & RIDES
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Try to get the first available profile to act as event organizer
    SELECT id INTO v_org_id FROM public.profiles LIMIT 1;
    
    IF v_org_id IS NULL THEN
        RAISE NOTICE 'No profiles found to act as organizer. Seeding skipped.';
        RETURN;
    END IF;

    -- Clear existing Chennai events to ensure clean re-seeding
    DELETE FROM public.events WHERE location ILIKE '%Chennai%';

    -- Insert Real Chennai Events
    INSERT INTO public.events (title, description, category, location, event_date, event_time, organizer_id, image_url, capacity, ticket_price)
    VALUES 
    (
        'A.R. Rahman: The Wonderment Tour', 
        'The legend returns to Chennai! Experience AR Rahman live in concert with an immersive spectacle of sound and light.', 
        'concert', 
        'Jawaharlal Nehru Stadium, Chennai', 
        '2026-02-14 18:00:00+05:30', 
        '6:00 PM', 
        v_org_id,
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800',
        40000,
        1499.00
    ),
    (
        'Sunburn Holi Ft. KSHMR', 
        'Chennai''s biggest Holi celebration with world-renowned DJ KSHMR. High energy, colors, and music!', 
        'concert', 
        'VGP Golden Beach Resorts, Chennai', 
        '2026-03-04 10:00:00+05:30', 
        '10:00 AM', 
        v_org_id,
        'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=800',
        5000,
        999.00
    ),
    (
        'Anirudh XV - 15 Years of Rockstar', 
        'Celebrate 15 years of Anirudh Ravichander! A massive homecoming concert for the Rockstar.', 
        'concert', 
        'Chennai Trade Centre', 
        '2026-03-21 19:00:00+05:30', 
        '7:00 PM', 
        v_org_id,
        'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=800',
        15000,
        1999.00
    ),
    (
        'Indra Vizha Cultural Fest', 
        'A grand celebration of Tamil culture, arts, and traditions. Features folk dance, authentic food, and local artisans.', 
        'fest', 
        'Chennai Citicentre', 
        '2026-02-28 10:00:00+05:30', 
        '10:00 AM', 
        v_org_id,
        'https://images.unsplash.com/photo-1514525253361-bee8a187499b?q=80&w=800',
        2000,
        0.00
    ),
    (
        'Abhishek Upmanyu: TOXIC Live', 
        'One of India''s funniest comedians is back with his new special "Toxic". Prepare for a night of non-stop laughter.', 
        'other', 
        'Music Academy, Chennai', 
        '2026-02-20 19:00:00+05:30', 
        '7:00 PM', 
        v_org_id,
        'https://images.unsplash.com/photo-1527224857853-e374a7f9d45a?q=80&w=800',
        1200,
        799.00
    ),
    (
        'Chennai EV & Battery Expo 2026', 
        'Leading exhibition for Electric Vehicles and Battery technology. See the future of transport.', 
        'tech_talk', 
        'Chennai Trade Centre', 
        '2026-02-12 10:00:00+05:30', 
        '10:00 AM', 
        v_org_id,
        'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?q=80&w=800',
        5000,
        0.00
    ),
    (
        'Aakash Gupta: Daily Ka Kaam Hai', 
        'Excuses, stories, and observation! Join Aakash Gupta for his solo stand-up special in Chennai.', 
        'other', 
        'The Music Academy, Chennai', 
        '2026-02-22 18:00:00+05:30', 
        '6:00 PM', 
        v_org_id,
        'https://images.unsplash.com/photo-1585699324551-f6c309eedee6?q=80&w=800',
        1500,
        699.00
    );

    -- Seed Ride Rooms for these major events
    -- (We use the newly created Title to find IDs)
    
    INSERT INTO public.event_ride_rooms (event_id, organizer_id, ride_type, departure_time, departure_location, description)
    SELECT 
        id, v_org_id, 'to_event', '16:30:00'::TIME, 'SRM KTR Main Gate', 'Carpooling for ARR. Let''s ride together!'
    FROM public.events WHERE title = 'A.R. Rahman: The Wonderment Tour' LIMIT 1;

    INSERT INTO public.event_ride_rooms (event_id, organizer_id, ride_type, departure_time, departure_location, description)
    SELECT 
        id, v_org_id, 'to_event', '09:00:00'::TIME, 'Vistara Club Corner', 'Going to Sunburn early for the best spots!'
    FROM public.events WHERE title = 'Sunburn Holi Ft. KSHMR' LIMIT 1;

    INSERT INTO public.event_ride_rooms (event_id, organizer_id, ride_type, departure_time, departure_location, description)
    SELECT 
        id, v_org_id, 'to_event', '18:00:00'::TIME, 'Potheri Station', 'Going for some laughs. Join the group.'
    FROM public.events WHERE title = 'Abhishek Upmanyu: TOXIC Live' LIMIT 1;

    RAISE NOTICE 'Chennai Events and Ride Rooms successfully seeded with robust schema handling.';
END $$;
