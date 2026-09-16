import { Booking } from './types';

/**
 * Formats guest name cleanly for display without awkward duplicate honorifics.
 */
export function formatGuestDisplayName(rawName: string): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  const hasHonorific = /^(श्री|श्रीमती|सुश्री|डॉ०|डाॅ०|डा०|डॉक्टर|Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Shri|Prof\.?|Capt\.?|Col\.?)/i.test(trimmed);
  return hasHonorific ? trimmed : `श्री ${trimmed}`;
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
  ratePerRoom?: number,
  foodAmount?: number,
  paymentMode?: string,
  collectedBy?: string,
  collectionNote?: string,
  expenditure?: number
): string {
  const cleanNotes = (notes || '').replace(/\[META:.*?\]/g, '').trim();
  const metaObj: Record<string, any> = {
    group_id: groupId,
    dispatch_no: dispatchNo,
  };
  if (checkInDate) metaObj.check_in_date = checkInDate;
  if (checkOutDate) metaObj.check_out_date = checkOutDate;
  if (ratePerRoom && ratePerRoom > 0) metaObj.rate_per_room = ratePerRoom;
  if (foodAmount !== undefined && foodAmount >= 0) metaObj.food_amount = foodAmount;
  if (expenditure !== undefined && expenditure >= 0) metaObj.expenditure = expenditure;
  if (paymentMode) metaObj.payment_mode = paymentMode;
  if (collectedBy) metaObj.collected_by = collectedBy;
  if (collectionNote) metaObj.collection_note = collectionNote;

  const metaTag = `[META:${JSON.stringify(metaObj)}]`;
  return cleanNotes ? `${cleanNotes} ${metaTag}` : metaTag;
}

export function extractGroupIdFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.group_id || parsed.groupId || '';
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
      return parsed.dispatch_no || parsed.dispatchNo || '';
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
      return parsed.check_in_date || parsed.checkInDate || '';
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
      return parsed.check_out_date || parsed.checkOutDate || '';
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
      return Number(parsed.rate_per_room || parsed.ratePerRoom) || 0;
    } catch {
      // ignore
    }
  }
  return 0;
}

export function extractFoodAmountFromNotes(notes?: string): number {
  if (!notes) return 0;
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return Number(parsed.food_amount) || 0;
    } catch {
      // ignore
    }
  }
  return 0;
}

export function extractPaymentModeFromNotes(notes?: string): string {
  if (!notes) return 'CASH';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.payment_mode || 'CASH';
    } catch {
      // ignore
    }
  }
  return 'CASH';
}

export function extractCollectedByFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.collected_by || '';
    } catch {
      // ignore
    }
  }
  return '';
}

export function extractCollectionNoteFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return parsed.collection_note || '';
    } catch {
      // ignore
    }
  }
  return '';
}

export function extractExpenditureFromNotes(notes?: string): number {
  if (!notes) return 0;
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return Number(parsed.expenditure) || 0;
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

/**
 * Calculates the exact rent of a booking according to POGH rules and meta rates.
 */
export function calculateBookingRent(b: Booking): number {
  if (b.status === 'CANCELLED') return 0;

  const metaRate = extractRatePerRoomFromNotes(b.notes);
  const roomsCount =
    (Number(b.suit_1) > 0 ? 1 : 0) +
    (Number(b.suit_2) > 0 ? 1 : 0) +
    (Number(b.suit_3) > 0 ? 1 : 0) +
    (Number(b.suit_4) > 0 ? 1 : 0);

  if (metaRate > 0) {
    return metaRate * (roomsCount || 1);
  }

  const rawTotal = Number(b.total_amount) || 0;
  const suitSum =
    (Number(b.suit_1) > 1 ? Number(b.suit_1) : 0) +
    (Number(b.suit_2) > 1 ? Number(b.suit_2) : 0) +
    (Number(b.suit_3) > 1 ? Number(b.suit_3) : 0) +
    (Number(b.suit_4) > 1 ? Number(b.suit_4) : 0);

  if (suitSum > 0) {
    return Math.max(rawTotal, suitSum);
  }

  if (rawTotal <= 0) return 0;

  if (roomsCount > 1 && rawTotal <= 1500) {
    return rawTotal * roomsCount;
  }

  return rawTotal;
}

export function getBookingRoomsCount(b: Booking): number {
  const count =
    (Number(b.suit_1) > 0 ? 1 : 0) +
    (Number(b.suit_2) > 0 ? 1 : 0) +
    (Number(b.suit_3) > 0 ? 1 : 0) +
    (Number(b.suit_4) > 0 ? 1 : 0);
  return count > 0 ? count : 1;
}

export function getBookingSuitsList(b: Booking): string[] {
  const suits: string[] = [];
  if (Number(b.suit_1) > 0) suits.push('सूट 1');
  if (Number(b.suit_2) > 0) suits.push('सूट 2');
  if (Number(b.suit_3) > 0) suits.push('सूट 3');
  if (Number(b.suit_4) > 0) suits.push('सूट 4');
  return suits.length > 0 ? suits : ['सूट 1'];
}

export function calculateBookingFoodAmount(b: Booking): number {
  if (b.status === 'CANCELLED') return 0;
  if (b.food_amount !== undefined && Number(b.food_amount) >= 0) {
    return Number(b.food_amount);
  }
  return extractFoodAmountFromNotes(b.notes);
}

export function calculateBookingTotalCollection(b: Booking): number {
  if (b.status === 'CANCELLED') return 0;
  const rent = calculateBookingRent(b);
  const food = calculateBookingFoodAmount(b);
  return rent + food;
}

export function calculateBookingExpenditure(b: Booking): number {
  if (b.status === 'CANCELLED') return 0;
  if (b.expenditure !== undefined && Number(b.expenditure) >= 0) {
    return Number(b.expenditure);
  }
  return extractExpenditureFromNotes(b.notes);
}

/**
 * Calculates net collection: (Room Rent + Food Collection) - Expenditure.
 * If gross collection is 0 (e.g. Free/Complimentary/VIP room with no rent & no food charge),
 * the net revenue is NEVER shown as negative (returns 0).
 */
export function calculateBookingNetCollection(b: Booking): number {
  if (b.status === 'CANCELLED') return 0;
  const rent = calculateBookingRent(b);
  const food = calculateBookingFoodAmount(b);
  const exp = calculateBookingExpenditure(b);
  const gross = rent + food;
  if (gross <= 0) return 0;
  return Math.max(0, gross - exp);
}

/**
 * Checks if a specific suit is allocated/booked in the given booking record.
 */
export function isSuitAllocatedInBooking(b: Booking, suitId: string): boolean {
  if (!b) return false;
  const val = b[suitId as keyof Booking];
  if (typeof val === 'number') return val > 0;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }
  if (typeof val === 'boolean') return val;
  return false;
}

/**
 * Checks if a booking record occupies a specific calendar date (format: 'YYYY-MM-DD').
 * Handles single-day records, timestamped dates, and multi-day spans from metadata.
 */
export function isBookingOccupyingDate(b: Booking, targetDate: string): boolean {
  if (!b || !targetDate) return false;
  const status = (b.status || '').toUpperCase();
  if (status === 'CANCELLED') return false;

  const target = String(targetDate || '').trim().slice(0, 10);
  const bDate = String(b.booking_date || '').trim().slice(0, 10);

  // Exact date match
  if (bDate && bDate === target) return true;

  // Check date range in metadata if available
  const cin = String(extractCheckInDateFromNotes(b.notes) || bDate).trim().slice(0, 10);
  const cout = String(extractCheckOutDateFromNotes(b.notes) || bDate).trim().slice(0, 10);

  if (cin && cout) {
    if (cin === cout) {
      return cin === target;
    }
    // Overnight stay: occupant occupies from checkInDate up to (but not including checkout noon) checkOutDate
    return target >= cin && target < cout;
  }

  return false;
}

export interface SuitConflictResult {
  isBooked: boolean;
  booking?: Booking;
  conflictingDate?: string;
  guestName?: string;
  isMaintenance?: boolean;
}

/**
 * Checks whether a suit is already booked on any date of a stay dates array.
 * Optionally excludes a set of booking IDs (e.g. current booking group being edited).
 */
export function findConflictingBooking(
  existingBookings: Booking[],
  suitId: string,
  stayDates: string[],
  excludeBookingIds?: Set<string>
): SuitConflictResult {
  if (!existingBookings || existingBookings.length === 0 || stayDates.length === 0) {
    return { isBooked: false };
  }

  for (const dateStr of stayDates) {
    for (const b of existingBookings) {
      if (excludeBookingIds && excludeBookingIds.has(b.id)) {
        continue;
      }
      const status = (b.status || '').toUpperCase();
      if (status === 'CANCELLED') {
        continue;
      }
      if (!isSuitAllocatedInBooking(b, suitId)) {
        continue;
      }
      if (isBookingOccupyingDate(b, dateStr)) {
        const isMaint = status === 'MAINTENANCE' || !!b.is_maintenance;
        return {
          isBooked: true,
          booking: b,
          conflictingDate: dateStr,
          guestName: b.guest_name,
          isMaintenance: isMaint,
        };
      }
    }
  }

  return { isBooked: false };
}
