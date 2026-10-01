import { BookingRequest, Booking } from './types';
import { getAuthToken } from './auth';

const REQUESTS_CACHE_KEY = 'pogh_booking_requests_cache';

export function getLocalBookingRequests(): BookingRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REQUESTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalBookingRequests(requests: BookingRequest[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify(requests));
  } catch (err) {
    console.error('Failed to save booking requests cache:', err);
  }
}

export function generateRequestNumber(): string {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `POGH-REQ-${yr}${mo}-${rand}`;
}

function getHeaders(customHeaders?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return {
    ...headers,
    ...customHeaders,
  };
}

// 1. Fetch all requests (Admin & Operator)
export async function apiFetchBookingRequests(): Promise<{
  success: boolean;
  requests?: BookingRequest[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/booking-requests', {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.requests)) {
      saveLocalBookingRequests(data.requests);
    }
    return data;
  } catch (err: any) {
    const cached = getLocalBookingRequests();
    if (cached.length > 0) {
      return { success: true, requests: cached };
    }
    return { success: false, error: err.message || 'Network error' };
  }
}

// 2. Submit new public booking request
export async function apiSubmitBookingRequest(
  requestData: Partial<BookingRequest>
): Promise<{
  success: boolean;
  request?: BookingRequest;
  request_number?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/booking-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });
    const data = await res.json();
    if (data.success && data.request) {
      const existing = getLocalBookingRequests();
      saveLocalBookingRequests([data.request, ...existing]);
    }
    return data;
  } catch (err: any) {
    // Fallback: create locally
    const fallbackNumber = generateRequestNumber();
    const fallbackRequest: BookingRequest = {
      id: `req-local-${Date.now()}`,
      request_number: fallbackNumber,
      guest_name: requestData.guest_name || '',
      designation: requestData.designation,
      department: requestData.department,
      mobile_number: requestData.mobile_number || '',
      email: requestData.email,
      id_proof_type: requestData.id_proof_type,
      id_proof_number: requestData.id_proof_number,
      reference: requestData.reference || 'SSP SIR',
      purpose: requestData.purpose || '',
      check_in_date: requestData.check_in_date || '',
      check_out_date: requestData.check_out_date || '',
      check_in_time: requestData.check_in_time || '12:00 PM',
      check_out_time: requestData.check_out_time || '12:00 PM',
      stay_type: requestData.stay_type || 'STANDARD',
      requested_suits: requestData.requested_suits || [],
      number_of_guests: requestData.number_of_guests || 1,
      status: 'PENDING',
      notes: requestData.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const existing = getLocalBookingRequests();
    saveLocalBookingRequests([fallbackRequest, ...existing]);

    return {
      success: true,
      request_number: fallbackNumber,
      request: fallbackRequest,
    };
  }
}

// 3. Track request status (Public search by Request Number or Mobile)
export async function apiTrackBookingRequest(query: string): Promise<{
  success: boolean;
  requests?: BookingRequest[];
  error?: string;
}> {
  try {
    const res = await fetch(`/api/booking-requests?track=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    const cached = getLocalBookingRequests();
    const clean = query.trim().toUpperCase();
    const filtered = cached.filter(
      (r) =>
        r.request_number.toUpperCase().includes(clean) ||
        r.mobile_number.includes(clean)
    );
    return { success: true, requests: filtered };
  }
}

// 4. Approve request and create confirmed booking (Admin & Operator)
export async function apiApproveBookingRequest(params: {
  requestId: string;
  assignedSuits: string[]; // ['suit_1', 'suit_2', etc]
  suitRates: Record<string, number>; // { suit_1: 800 }
  reference?: string;
  dispatchNo?: string;
  mealStatus?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  approvedBooking?: Booking;
  error?: string;
}> {
  try {
    const res = await fetch('/api/booking-requests', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'APPROVE',
        ...params,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Approval failed' };
  }
}

// 5. Reject request (Admin & Operator)
export async function apiRejectBookingRequest(params: {
  requestId: string;
  rejectionReason: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/booking-requests', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'REJECT',
        ...params,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Rejection failed' };
  }
}
