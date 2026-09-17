import { Booking } from './types';
import { getAuthToken } from './auth';

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

export async function apiFetchBookings(): Promise<{ success: boolean; bookings?: Booking[]; error?: string }> {
  try {
    const res = await fetch('/api/bookings', {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function apiCreateBookings(records: Booking[]): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ bookings: records }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server responded with ${res.status}`);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create booking' };
  }
}

export async function apiUpdateBooking(params: {
  id?: string;
  groupId?: string;
  updatedData: Partial<Booking>;
  applyToAll?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/bookings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server responded with ${res.status}`);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update booking' };
  }
}

export async function apiDeleteBooking(params: {
  id?: string;
  groupId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const query = new URLSearchParams();
    if (params.id) query.set('id', params.id);
    if (params.groupId) query.set('groupId', params.groupId);

    const res = await fetch(`/api/bookings?${query.toString()}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server responded with ${res.status}`);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete booking' };
  }
}
