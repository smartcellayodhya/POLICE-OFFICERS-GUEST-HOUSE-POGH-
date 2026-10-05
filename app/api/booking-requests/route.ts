import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getServerSupabaseClient, isServiceRoleConfigured } from '@/lib/supabaseServer';
import { Booking, BookingRequest } from '@/lib/types';
import { getStayDates } from '@/lib/dateUtils';
import { generateBookingRef, generateDispatchNumber, encodeNotesWithMeta } from '@/lib/bookingUtils';
import { generateRequestNumber } from '@/lib/requestUtils';

// ─────────────────────────────────────────────────────────────
// GET /api/booking-requests:
// 1. If ?track=... -> Public tracking query
// 2. Otherwise -> Authenticated Admin / Operator list of all requests
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trackQuery = searchParams.get('track');

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database client not configured on server', requests: [] },
        { status: 200 }
      );
    }

    // Public Tracking Query (Secure & Exact Match to Prevent Data Leakage)
    if (trackQuery) {
      const clean = trackQuery.trim();
      const cleanMobile = clean.replace(/\D/g, '');
      const isMobileQuery = cleanMobile.length === 10;

      // Enforce strict query constraints: either a full 10-digit mobile or a valid Request ID (min 6 chars)
      if (!isMobileQuery && clean.length < 6) {
        return NextResponse.json(
          {
            success: false,
            error: 'कृपया सही 10-अंकों का मोबाइल नंबर या पूर्ण Request ID (कम से कम 6 अक्षर) दर्ज करें।',
            requests: [],
          },
          { status: 400 }
        );
      }

      let queryBuilder = client.from('pogh_booking_requests').select('*');

      if (isMobileQuery) {
        queryBuilder = queryBuilder.eq('mobile_number', cleanMobile);
      } else {
        queryBuilder = queryBuilder.ilike('request_number', clean);
      }

      const { data, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error tracking request:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        requests: data || [],
      });
    }

    // Authenticated Admin / Operator Query
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'अनधिकृत प्रवेश (Unauthorized: Please log in)' },
        { status: 401 }
      );
    }

    const { data, error } = await client
      .from('pogh_booking_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching booking requests:', error);
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return NextResponse.json({
          success: true,
          requests: [],
          warning: 'pogh_booking_requests table not yet created in Supabase. Run RUN_IN_SUPABASE.sql to migrate.',
        });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requests: data || [],
    });
  } catch (err: any) {
    console.error('GET /api/booking-requests error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/booking-requests: Submit a new booking request (PUBLIC)
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      guest_name,
      designation,
      department,
      mobile_number,
      email,
      id_proof_type,
      id_proof_number,
      reference = 'SSP SIR',
      purpose,
      check_in_date,
      check_out_date,
      check_in_time = '12:00 PM',
      check_out_time = '12:00 PM',
      stay_type = 'STANDARD',
      requested_suits = [],
      number_of_guests = 1,
      notes = '',
    } = body;

    if (!guest_name || !mobile_number || !check_in_date || !check_out_date || !reference) {
      return NextResponse.json(
        { success: false, error: 'कृपया नाम, मोबाइल नंबर, आगमन/प्रस्थान तिथि एवं संदर्भ अवश्य दर्ज करें।' },
        { status: 400 }
      );
    }


    // Clean mobile number
    const cleanMobile = mobile_number.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      return NextResponse.json(
        { success: false, error: 'अमान्य मोबाइल नंबर। कृपया 10 अंकों का सक्रिय नंबर दर्ज करें।' },
        { status: 400 }
      );
    }

    const client = getServerSupabaseClient();
    const reqNumber = generateRequestNumber();

    const requestPayload = {
      request_number: reqNumber,
      guest_name: guest_name.trim(),
      designation: designation ? designation.trim() : null,
      department: department ? department.trim() : null,
      mobile_number: cleanMobile.slice(-10),
      email: email ? email.trim() : null,
      id_proof_type: id_proof_type || null,
      id_proof_number: id_proof_number ? id_proof_number.trim() : null,
      reference: reference || 'SSP SIR',
      purpose: purpose ? purpose.trim() : null,
      check_in_date,
      check_out_date,
      check_in_time: check_in_time.trim(),
      check_out_time: check_out_time.trim(),
      stay_type,
      requested_suits: [],
      number_of_guests: Number(number_of_guests) || 1,
      status: 'PENDING',
      notes: notes ? notes.trim() : null,
    };

    if (client) {
      const { data, error } = await client
        .from('pogh_booking_requests')
        .insert([requestPayload])
        .select()
        .single();

      if (error) {
        console.error('Failed to insert booking request into Supabase:', error);
        const isTableMissing = error.code === 'PGRST205' || error.message?.includes('schema cache');
        return NextResponse.json(
          {
            success: false,
            error: isTableMissing
              ? 'डेटाबेस में pogh_booking_requests टेबल अनुपलब्ध है। कृपया Supabase SQL Editor में RUN_IN_SUPABASE.sql रन करें।'
              : `डेटाबेस में सेव करने में त्रुटि: ${error.message}`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        request_number: reqNumber,
        request: data,
      });
    }

    return NextResponse.json({
      success: true,
      request_number: reqNumber,
      request: { id: `req-${Date.now()}`, ...requestPayload },
    });
  } catch (err: any) {
    console.error('POST /api/booking-requests error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/booking-requests: APPROVE or REJECT (ADMIN & OPERATOR)
// ─────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'अनधिकृत प्रवेश (Unauthorized: Please log in)' },
        { status: 401 }
      );
    }

    // Role Enforcement: Only Admin & Operator can approve or reject requests
    if (user.role !== 'admin' && user.role !== 'operator') {
      return NextResponse.json(
        {
          success: false,
          error: 'निषेध: केवल प्रशासनिक (Admin) या ऑपरेटर को अनुरोध स्वीकृत या अस्वीकृत करने की अनुमति है।',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, requestId } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: 'requestId and action are required' },
        { status: 400 }
      );
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database client not configured on server' },
        { status: 500 }
      );
    }

    // ACTION: REJECT
    if (action === 'REJECT') {
      const { rejectionReason = 'कमरे अनुपलब्ध हैं' } = body;
      const { error } = await client
        .from('pogh_booking_requests')
        .update({
          status: 'REJECTED',
          rejection_reason: rejectionReason,
          action_by: user.displayName || user.username,
          action_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        console.error('Failed to reject booking request:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'अनुरोध सफलतापूर्वक अस्वीकृत कर दिया गया।',
      });
    }

    // ACTION: APPROVE
    if (action === 'APPROVE') {
      const {
        assignedSuits = ['suit_1'],
        suitRates = {},
        reference,
        dispatchNo,
        mealStatus = 'PAID',
        notes = '',
      } = body;

      // 1. Fetch the request details
      const { data: request, error: reqFetchErr } = await client
        .from('pogh_booking_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqFetchErr || !request) {
        return NextResponse.json(
          { success: false, error: 'अनुरोध रिकॉर्ड नहीं मिला।' },
          { status: 404 }
        );
      }

      if (request.status === 'APPROVED') {
        return NextResponse.json(
          { success: false, error: 'यह अनुरोध पहले ही स्वीकृत किया जा चुका है।' },
          { status: 400 }
        );
      }

      // 2. Prepare Confirmed Booking Records
      const checkInDate = request.check_in_date;
      const checkOutDate = request.check_out_date;
      const stayDates = request.stay_type === 'HOURLY' ? [checkInDate] : getStayDates(checkInDate, checkOutDate);
      
      const groupId = generateBookingRef();
      const finalDispatchNo = dispatchNo || generateDispatchNumber();
      const guestReference = reference || request.reference || 'SSP SIR';

      // Compute suit amounts
      const suit1Amt = assignedSuits.includes('suit_1') ? Number(suitRates['suit_1'] ?? 800) : 0;
      const suit2Amt = assignedSuits.includes('suit_2') ? Number(suitRates['suit_2'] ?? 800) : 0;
      const suit3Amt = assignedSuits.includes('suit_3') ? Number(suitRates['suit_3'] ?? 800) : 0;
      const suit4Amt = assignedSuits.includes('suit_4') ? Number(suitRates['suit_4'] ?? 1200) : 0;
      const perDayTotal = suit1Amt + suit2Amt + suit3Amt + suit4Amt;

      const encodedNotes = encodeNotesWithMeta(
        `${notes ? notes + ' | ' : ''}Approved from Request: ${request.request_number}${request.designation ? ` (${request.designation})` : ''}`,
        groupId,
        finalDispatchNo,
        checkInDate,
        checkOutDate,
        perDayTotal,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        request.stay_type,
        undefined,
        undefined,
        request.check_in_time || '12:00 PM',
        request.check_out_time || '12:00 PM'
      );

      const bookingRecords: Partial<Booking>[] = stayDates.map((dStr) => ({
        group_id: groupId,
        dispatch_no: finalDispatchNo,
        booking_date: dStr,
        guest_name: request.guest_name,
        mobile_number: request.mobile_number,
        reference: guestReference,
        suit_1: suit1Amt,
        suit_2: suit2Amt,
        suit_3: suit3Amt,
        suit_4: suit4Amt,
        total_amount: perDayTotal,
        meal_type_status: mealStatus,
        status: 'CONFIRMED',
        check_in_time: request.check_in_time || '12:00 PM',
        check_out_time: request.check_out_time || '12:00 PM',
        booking_type: request.stay_type || 'STANDARD',
        notes: encodedNotes,
      }));

      // Insert into pogh_bookings using server service client
      const { data: insertedBookings, error: bookingInsertErr } = await client
        .from('pogh_bookings')
        .insert(bookingRecords)
        .select();

      if (bookingInsertErr) {
        console.error('Failed to create booking records on approval:', bookingInsertErr);
        return NextResponse.json(
          { success: false, error: `बुकिंग रिकॉर्ड बनाने में त्रुटि: ${bookingInsertErr.message}` },
          { status: 500 }
        );
      }

      const primaryBookingId = insertedBookings && insertedBookings[0] ? insertedBookings[0].id : null;

      // 3. Mark request as APPROVED
      await client
        .from('pogh_booking_requests')
        .update({
          status: 'APPROVED',
          approved_suits: assignedSuits,
          approved_booking_id: primaryBookingId,
          action_by: user.displayName || user.username,
          action_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      return NextResponse.json({
        success: true,
        message: 'अनुरोध स्वीकृत कर आधिकारिक बुकिंग सफलतापूर्वक दर्ज कर दी गई है।',
        approvedBooking: insertedBookings ? insertedBookings[0] : null,
      });
    }

    return NextResponse.json(
      { success: false, error: 'अमान्य कार्रवाई (Invalid action)' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('PUT /api/booking-requests error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
