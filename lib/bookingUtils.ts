import { Booking } from './types';

const STAFF_PIN_KEY = 'pogh_staff_pin';
const DEFAULT_PIN = '1122';

export function getStaffPin(): string {
  if (typeof window === 'undefined') return DEFAULT_PIN;
  return localStorage.getItem(STAFF_PIN_KEY) || DEFAULT_PIN;
}

export function setStaffPin(newPin: string): boolean {
  if (typeof window !== 'undefined' && newPin.trim().length >= 4) {
    localStorage.setItem(STAFF_PIN_KEY, newPin.trim());
    return true;
  }
  return false;
}

export function verifyStaffPin(inputPin: string): boolean {
  return inputPin.trim() === getStaffPin();
}

// Generate unique sequential reference number e.g. POGH-2026-003
export function generateBookingRef(existingBookings: Booking[]): string {
  const currentYear = new Date().getFullYear();
  let maxNum = 0;

  existingBookings.forEach((b) => {
    const ref = b.group_id || extractGroupIdFromNotes(b.notes);
    if (ref && ref.startsWith(`POGH-${currentYear}-`)) {
      const parts = ref.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return `POGH-${currentYear}-${String(nextNum).padStart(3, '0')}`;
}

// Generate auto dispatch number e.g. 003
export function generateDispatchNumber(existingBookings: Booking[]): string {
  const currentYear = new Date().getFullYear();
  let maxNum = 0;

  existingBookings.forEach((b) => {
    const disp = b.dispatch_no || extractDispatchNoFromNotes(b.notes);
    if (disp) {
      const num = parseInt(disp, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return String(maxNum + 1).padStart(3, '0');
}

// Helpers to encode/decode metadata inside notes safely
export function encodeNotesWithMeta(
  notes: string,
  groupId: string,
  dispatchNo: string,
  checkInDate?: string,
  checkOutDate?: string,
  ratePerRoom?: number
): string {
  const cleanNotes = (notes || '').replace(/\[META:.*?\]/g, '').trim();
  const metaObj: Record<string, any> = {
    group_id: groupId,
    dispatch_no: dispatchNo,
  };
  if (checkInDate) metaObj.check_in_date = checkInDate;
  if (checkOutDate) metaObj.check_out_date = checkOutDate;
  if (ratePerRoom && ratePerRoom > 0) metaObj.rate_per_room = ratePerRoom;

  const metaTag = `[META:${JSON.stringify(metaObj)}]`;
  return cleanNotes ? `${cleanNotes} ${metaTag}` : metaTag;
}

export function extractGroupIdFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.group_id || '';
    } catch {
      // ignore
    }
  }
  return '';
}

export function extractDispatchNoFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.dispatch_no || '';
    } catch {
      // ignore
    }
  }
  return '';
}

export function extractCheckInDateFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.check_in_date || '';
    } catch {
      // ignore
    }
  }
  return '';
}

export function extractCheckOutDateFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.check_out_date || '';
    } catch {
      // ignore
    }
  }
  return '';
}

export function extractRatePerRoomFromNotes(notes?: string): number {
  if (!notes) return 0;
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return Number(parsed.rate_per_room) || 0;
    } catch {
      // ignore
    }
  }
  return 0;
}

export function cleanNotesText(notes?: string): string {
  if (!notes) return '';
  return notes.replace(/\[META:.*?\]/g, '').trim();
}
