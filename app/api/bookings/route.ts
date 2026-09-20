import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getServerSupabaseClient, isServiceRoleConfigured } from '@/lib/supabaseServer';
import { Booking } from '@/lib/types';
import { extractGroupIdFromNotes } from '@/lib/bookingUtils';

// ─────────────────────────────────────────────────────────────
// GET /api/bookings: Fetch all bookings (Authenticated users only)
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'अनधिकृत प्रवेश (Unauthorized: Please log in)' },
        { status: 401 }
      );
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database client not configured on server', bookings: [] },
        { status: 200 }
      );
    }

    const { data, error } = await client
      .from('pogh_bookings')
      .select('*')
      .order('booking_date', { ascending: false });

    if (error) {
      console.error('Error fetching bookings from Supabase:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bookings: data || [],
    });
  } catch (err: any) {
    console.error('GET /api/bookings error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/bookings: Create new booking (ADMIN ONLY)
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'अनधिकृत प्रवेश (Unauthorized: Please log in)' },
        { status: 401 }
      );
    }

    // Role Enforcement: Only Admin can create bookings
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'निषेध: केवल प्रशासनिक (Admin) नियंत्रण को नई बुकिंग दर्ज करने की अनुमति है (403 Forbidden)',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { bookings: records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'बुकिंग डेटा आवश्यक है (Invalid bookings payload)' },
        { status: 400 }
      );
    }

    if (!isServiceRoleConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'सुरक्षा त्रुटि: सर्वर पर SUPABASE_SERVICE_ROLE_KEY (Private Key) सेट नहीं है। कृपया Vercel Environment Variables में SUPABASE_SERVICE_ROLE_KEY जोड़ें।',
        },
        { status: 500 }
      );
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database client not configured on server' },
        { status: 500 }
      );
    }

    // Prepare full schema payload
    const fullPayload = records.map((b: Booking) => ({
      group_id: b.group_id,
      dispatch_no: b.dispatch_no,
      booking_date: b.booking_date,
      guest_name: b.guest_name,
      mobile_number: b.mobile_number,
      reference: b.reference,
      suit_1: b.suit_1,
      suit_2: b.suit_2,
      suit_3: b.suit_3,
      suit_4: b.suit_4,
      total_amount: b.total_amount,
      meal_type_status: b.meal_type_status,
      status: b.status || 'CONFIRMED',
      check_in_time: b.check_in_time,
      check_out_time: b.check_out_time,
      booking_type: b.booking_type,
      stay_hours: b.stay_hours,
      hourly_rate: b.hourly_rate,
      is_maintenance: b.is_maintenance || false,
      food_amount: b.food_amount || 0,
      expenditure: b.expenditure || 0,
      payment_mode: b.payment_mode || 'CASH',
      collected_by: b.collected_by || null,
      notes: b.notes || '',
    }));

    let { error } = await client.from('pogh_bookings').insert(fullPayload);

    if (error) {
      console.warn('Full payload insert failed, falling back to core columns:', error.message);
      const corePayload = records.map((b: Booking) => ({
        booking_date: b.booking_date,
        guest_name: b.guest_name,
        mobile_number: b.mobile_number,
        reference: b.reference,
        suit_1: b.suit_1,
        suit_2: b.suit_2,
        suit_3: b.suit_3,
        suit_4: b.suit_4,
        total_amount: b.total_amount,
        meal_type_status: b.meal_type_status,
        status: b.status || 'CONFIRMED',
        notes: b.notes || '',
      }));
      const fallbackRes = await client.from('pogh_bookings').insert(corePayload);
      if (fallbackRes.error) {
        return NextResponse.json(
          { success: false, error: fallbackRes.error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Booking created successfully',
    });
  } catch (err: any) {
    console.error('POST /api/bookings error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/bookings: Update existing booking (ADMIN & OPERATOR)
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

    // Role Enforcement: Officers are strictly read-only
    if (user.role === 'officer') {
      return NextResponse.json(
        {
          success: false,
          error: 'निषेध: अधिकारी दृश्य केवल पठन (Read-Only) हेतु अधिकृत है (403 Forbidden)',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, groupId, updatedData, applyToAll } = body;

    if (!id && !groupId) {
      return NextResponse.json(
        { success: false, error: 'Booking id or groupId is required' },
        { status: 400 }
      );
    }

    if (!isServiceRoleConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'सुरक्षा त्रुटि: सर्वर पर SUPABASE_SERVICE_ROLE_KEY (Private Key) सेट नहीं है। कृपया Vercel Environment Variables में SUPABASE_SERVICE_ROLE_KEY जोड़ें।',
        },
        { status: 500 }
      );
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database client not configured on server' },
        { status: 500 }
      );
    }

    // Safe payload sanitization
    const payload: Record<string, any> = { ...updatedData };

    // If Operator is updating: allow status, collection, notes, amount
    // Operator is not allowed to change room allocation or guest name directly
    if (user.role === 'operator') {
      delete payload.guest_name;
      delete payload.mobile_number;
      delete payload.reference;
    }

    let error = null;

    if (applyToAll && groupId) {
      // 1. Try full payload with both group_id and notes filters
      let res = await client
        .from('pogh_bookings')
        .update(payload)
        .or(`group_id.eq.${groupId},notes.ilike.%"group_id":"${groupId}"%,notes.ilike.%"groupId":"${groupId}"%`);
      
      if (res.error) {
        console.warn('Full update failed, attempting resilient fallback:', res.error.message);
        const isGroupIdMissing = res.error.message.includes('group_id');
        const filterStr = isGroupIdMissing
          ? `notes.ilike.%"group_id":"${groupId}"%,notes.ilike.%"groupId":"${groupId}"%`
          : `group_id.eq.${groupId},notes.ilike.%"group_id":"${groupId}"%,notes.ilike.%"groupId":"${groupId}"%`;

        const corePayload: Record<string, any> = {
          total_amount: payload.total_amount,
          status: payload.status,
          notes: payload.notes,
          suit_1: payload.suit_1,
          suit_2: payload.suit_2,
          suit_3: payload.suit_3,
          suit_4: payload.suit_4,
        };

        // Try full payload with safe filter first (if only group_id was missing)
        if (isGroupIdMissing) {
          res = await client.from('pogh_bookings').update(payload).or(filterStr);
        }

        // If still failing (e.g. payload columns like food_amount are missing), fall back to corePayload
        if (res.error) {
          res = await client
            .from('pogh_bookings')
            .update(corePayload)
            .or(filterStr);
        }

        // As a final safety net, update by primary ID
        if (res.error && id) {
          console.warn('Group update failed completely, falling back to updating single ID:', id);
          res = await client.from('pogh_bookings').update(corePayload).eq('id', id);
        }
      }
      error = res.error;
    } else {
      let res = await client
        .from('pogh_bookings')
        .update(payload)
        .eq('id', id);

      if (res.error) {
        console.warn('Full update failed, falling back to core columns:', res.error.message);
        const corePayload: Record<string, any> = {
          total_amount: payload.total_amount,
          status: payload.status,
          notes: payload.notes,
          suit_1: payload.suit_1,
          suit_2: payload.suit_2,
          suit_3: payload.suit_3,
          suit_4: payload.suit_4,
        };
        res = await client.from('pogh_bookings').update(corePayload).eq('id', id);
      }
      error = res.error;
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Booking updated successfully',
    });
  } catch (err: any) {
    console.error('PUT /api/bookings error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/bookings: Delete booking (ADMIN ONLY)
// ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'अनधिकृत प्रवेश (Unauthorized: Please log in)' },
        { status: 401 }
      );
    }

    // Role Enforcement: Only Admin can delete bookings
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'निषेध: केवल प्रशासनिक (Admin) नियंत्रण को रिकॉर्ड हटाने की अनुमति है (403 Forbidden)',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const groupId = searchParams.get('groupId');

    if (!id && !groupId) {
      return NextResponse.json(
        { success: false, error: 'id or groupId is required to delete' },
        { status: 400 }
      );
    }

    if (!isServiceRoleConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'सुरक्षा त्रुटि: सर्वर पर SUPABASE_SERVICE_ROLE_KEY (Private Key) सेट नहीं है। कृपया Vercel Environment Variables में SUPABASE_SERVICE_ROLE_KEY जोड़ें।',
        },
        { status: 500 }
      );
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Database client not configured on server' },
        { status: 500 }
      );
    }

    let error = null;

    if (groupId) {
      let res = await client
        .from('pogh_bookings')
        .delete()
        .or(`group_id.eq.${groupId},notes.ilike.%"group_id":"${groupId}"%,notes.ilike.%"groupId":"${groupId}"%`);

      if (res.error && res.error.message.includes('group_id')) {
        console.warn('DELETE by group_id failed, falling back to notes filter:', res.error.message);
        res = await client
          .from('pogh_bookings')
          .delete()
          .or(`notes.ilike.%"group_id":"${groupId}"%,notes.ilike.%"groupId":"${groupId}"%`);
      }

      if (res.error && id) {
        console.warn('DELETE by notes failed, falling back to id:', id);
        res = await client.from('pogh_bookings').delete().eq('id', id);
      }

      error = res.error;
    } else if (id) {
      const res = await client.from('pogh_bookings').delete().eq('id', id);
      error = res.error;
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (err: any) {
    console.error('DELETE /api/bookings error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
