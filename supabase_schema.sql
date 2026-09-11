-- ====================================================================
-- POLICE OFFICERS GUEST HOUSE (POGH) AYODHYA - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ====================================================================

-- 1. Create Bookings Table
CREATE TABLE IF NOT EXISTS public.pogh_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_date DATE NOT NULL,
    guest_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT 'SSP SIR',
    suit_1 NUMERIC(10, 2) DEFAULT 0.00,
    suit_2 NUMERIC(10, 2) DEFAULT 0.00,
    suit_3 NUMERIC(10, 2) DEFAULT 0.00,
    suit_4 NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) DEFAULT 0.00,
    meal_type_status TEXT NOT NULL DEFAULT 'PAID', -- 'PAID', 'FREE', 'PENDING'
    status TEXT NOT NULL DEFAULT 'CONFIRMED',      -- 'CONFIRMED', 'CANCELLED'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Kolkata', now()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Kolkata', now())
);

-- 2. Indexes for fast date and guest search
CREATE INDEX IF NOT EXISTS idx_pogh_booking_date ON public.pogh_bookings (booking_date);
CREATE INDEX IF NOT EXISTS idx_pogh_guest_name ON public.pogh_bookings (guest_name);
CREATE INDEX IF NOT EXISTS idx_pogh_mobile ON public.pogh_bookings (mobile_number);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.pogh_bookings ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy allowing full read/write access with Supabase anon key
CREATE POLICY "Allow public full access" ON public.pogh_bookings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Enable Realtime Publications for instant live updates across devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.pogh_bookings;

-- 6. Insert initial seed sample records (matching historical data)
INSERT INTO public.pogh_bookings 
(booking_date, guest_name, mobile_number, reference, suit_1, suit_2, suit_3, suit_4, total_amount, meal_type_status)
VALUES
('2026-08-05', 'राहुल यादव', '9411616767', 'SSP SIR', 800.0, 800.0, 0.0, 0.0, 1600.0, 'PAID'),
('2026-08-13', 'ashwani', '8090467395', 'SSP SIR', 0.0, 800.0, 1200.0, 0.0, 2000.0, 'PAID')
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 7. UPGRADE / MIGRATION SCRIPT (For existing deployed databases)
-- Run this block if your table was created previously
-- ====================================================================
ALTER TABLE public.pogh_bookings 
    ADD COLUMN IF NOT EXISTS group_id TEXT,
    ADD COLUMN IF NOT EXISTS dispatch_no TEXT,
    ADD COLUMN IF NOT EXISTS check_in_time TEXT DEFAULT '12:00 PM',
    ADD COLUMN IF NOT EXISTS check_out_time TEXT DEFAULT '12:00 PM',
    ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pogh_group_id ON public.pogh_bookings (group_id);
CREATE INDEX IF NOT EXISTS idx_pogh_reference ON public.pogh_bookings (reference);

