-- ====================================================================
-- POLICE OFFICERS GUEST HOUSE (POGH) AYODHYA
-- RUN THIS IN SUPABASE SQL EDITOR TO CREATE BOOKING REQUESTS SYSTEM
-- ====================================================================

-- 1. Create pogh_booking_requests table
CREATE TABLE IF NOT EXISTS public.pogh_booking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    guest_name TEXT NOT NULL,
    designation TEXT,
    department TEXT,
    mobile_number TEXT NOT NULL,
    email TEXT,
    id_proof_type TEXT,
    id_proof_number TEXT,
    reference TEXT DEFAULT 'SSP SIR',
    purpose TEXT,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    check_in_time TEXT DEFAULT '12:00 PM',
    check_out_time TEXT DEFAULT '12:00 PM',
    stay_type TEXT DEFAULT 'STANDARD',
    requested_suits TEXT[],
    number_of_guests INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    rejection_reason TEXT,
    approved_suits TEXT[],
    approved_booking_id UUID REFERENCES public.pogh_bookings(id) ON DELETE SET NULL,
    action_by TEXT,
    action_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Kolkata', now()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Kolkata', now())
);

-- 2. Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_pogh_requests_mobile ON public.pogh_booking_requests (mobile_number);
CREATE INDEX IF NOT EXISTS idx_pogh_requests_status ON public.pogh_booking_requests (status);
CREATE INDEX IF NOT EXISTS idx_pogh_requests_dates ON public.pogh_booking_requests (check_in_date, check_out_date);

-- 3. Row Level Security (RLS)
ALTER TABLE public.pogh_booking_requests ENABLE ROW LEVEL SECURITY;

-- Allow public to insert requests
CREATE POLICY "Allow public insert requests" ON public.pogh_booking_requests
    FOR INSERT
    WITH CHECK (true);

-- Allow public to view requests (for tracking status)
CREATE POLICY "Allow public read requests" ON public.pogh_booking_requests
    FOR SELECT
    USING (true);

-- Full mutation access for service_role (Approve/Reject operations via Server API)
CREATE POLICY "Allow service role full access to requests" ON public.pogh_booking_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Enable Supabase Realtime for live alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.pogh_booking_requests;

-- 5. Insert Rahul Yadav's pending test request so it immediately shows up!
INSERT INTO public.pogh_booking_requests (
    request_number,
    guest_name,
    mobile_number,
    reference,
    check_in_date,
    check_out_date,
    check_in_time,
    check_out_time,
    stay_type,
    status,
    notes
) VALUES (
    'POGH-REQ-202610-3869',
    'Rahul yadav',
    '9411616767',
    'SSP SIR',
    '2026-10-01',
    '2026-10-02',
    '12:00 PM',
    '12:00 PM',
    'STANDARD',
    'PENDING',
    'Initial test request'
) ON CONFLICT (request_number) DO NOTHING;
