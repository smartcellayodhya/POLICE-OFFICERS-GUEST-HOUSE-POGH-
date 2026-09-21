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
  expenditure?: number,
  bookingType?: 'STANDARD' | 'HOURLY',
  stayHours?: number,
  hourlyRate?: number,
  checkInTime?: string,
  checkOutTime?: string,
  bankAmount?: number,
  cashAmount?: number
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
  if (bookingType) metaObj.booking_type = bookingType;
  if (stayHours !== undefined && stayHours > 0) metaObj.stay_hours = stayHours;
  if (hourlyRate !== undefined && hourlyRate > 0) metaObj.hourly_rate = hourlyRate;
  if (checkInTime) metaObj.check_in_time = checkInTime;
  if (checkOutTime) metaObj.check_out_time = checkOutTime;
  if (bankAmount !== undefined && bankAmount >= 0) metaObj.bank_amount = bankAmount;
  if (cashAmount !== undefined && cashAmount >= 0) metaObj.cash_amount = cashAmount;

  const metaTag = `[META:${JSON.stringify(metaObj)}]`;
  return cleanNotes ? `${cleanNotes} ${metaTag}` : metaTag;
}

// Structured metadata interface
export interface BookingMeta {
  groupId?: string;
  dispatchNo?: string;
  checkInDate?: string;
  checkOutDate?: string;
  ratePerRoom?: number;
  foodAmount?: number;
  expenditure?: number;
  paymentMode?: string;
  bankAmount?: number;
  cashAmount?: number;
  collectedBy?: string;
  collectionNote?: string;
  bookingType?: 'STANDARD' | 'HOURLY';
  stayHours?: number;
  hourlyRate?: number;
  checkInTime?: string;
  checkOutTime?: string;
}

export function parseBookingMeta(notes?: string): BookingMeta {
  if (!notes) return {};
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        groupId: parsed.group_id || parsed.groupId || '',
        dispatchNo: parsed.dispatch_no || parsed.dispatchNo || '',
        checkInDate: parsed.check_in_date || parsed.checkInDate || '',
        checkOutDate: parsed.check_out_date || parsed.checkOutDate || '',
        ratePerRoom: Number(parsed.rate_per_room || parsed.ratePerRoom) || 0,
        foodAmount: parsed.food_amount !== undefined ? Number(parsed.food_amount) : undefined,
        expenditure: parsed.expenditure !== undefined ? Number(parsed.expenditure) : undefined,
        paymentMode: parsed.payment_mode || undefined,
        bankAmount: parsed.bank_amount !== undefined ? Number(parsed.bank_amount) : undefined,
        cashAmount: parsed.cash_amount !== undefined ? Number(parsed.cash_amount) : undefined,
        collectedBy: parsed.collected_by || undefined,
        collectionNote: parsed.collection_note || undefined,
        bookingType: parsed.booking_type === 'HOURLY' ? 'HOURLY' : 'STANDARD',
        stayHours: Number(parsed.stay_hours) || 0,
        hourlyRate: Number(parsed.hourly_rate) || 0,
        checkInTime: parsed.check_in_time || parsed.checkInTime || undefined,
        checkOutTime: parsed.check_out_time || parsed.checkOutTime || undefined,
      };
    } catch {
      // ignore
    }
  }
  return {};
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

export function extractBookingTypeFromNotes(notes?: string): 'STANDARD' | 'HOURLY' {
  if (!notes) return 'STANDARD';
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.booking_type === 'HOURLY') return 'HOURLY';
    } catch {
      // ignore
    }
  }
  return 'STANDARD';
}

export function extractStayHoursFromNotes(notes?: string): number {
  if (!notes) return 0;
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return Number(parsed.stay_hours) || 0;
    } catch {
      // ignore
    }
  }
  return 0;
}

export function extractHourlyRateFromNotes(notes?: string): number {
  if (!notes) return 0;
  const match = notes.match(/\[META:(\{.*?\})\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return Number(parsed.hourly_rate) || 0;
    } catch {
      // ignore
    }
  }
  return 0;
}

/**
 * Checks if a booking is an hourly / short stay booking.
 */
export function isHourlyBooking(b?: Booking | null): boolean {
  if (!b) return false;
  if (b.booking_type === 'HOURLY') return true;
  if (extractBookingTypeFromNotes(b.notes) === 'HOURLY') return true;
  if ((b.stay_hours || 0) > 0 || extractStayHoursFromNotes(b.notes) > 0) return true;
  return false;
}

/**
 * Parses time string (e.g. "10:00 AM", "02:30 PM", "14:30") to minutes from midnight (0-1439).
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase();

  const match12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const isPM = match12[3].toUpperCase() === 'PM';
    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
    return hours * 60 + minutes;
  }

  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }

  return null;
}

/**
 * Formats minutes from midnight to a 12-hour AM/PM string, e.g. 600 -> "10:00 AM", 840 -> "02:00 PM".
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(norm / 60);
  const minutes = norm % 60;
  const isPM = hours24 >= 12;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minStr = String(minutes).padStart(2, '0');
  const period = isPM ? 'PM' : 'AM';
  return `${String(hours12).padStart(2, '0')}:${minStr} ${period}`;
}

/**
 * Calculates stay duration in hours from check-in and check-out times.
 */
export function calculateStayHours(checkInTime?: string, checkOutTime?: string): number {
  const tIn = parseTimeToMinutes(checkInTime);
  const tOut = parseTimeToMinutes(checkOutTime);
  if (tIn === null || tOut === null) return 4;
  let diff = tOut - tIn;
  if (diff <= 0) diff += 1440; // overnight/past midnight
  const hrs = Math.round((diff / 60) * 10) / 10;
  return hrs > 0 ? hrs : 1;
}

/**
 * Checks whether two time slots on the same day overlap.
 */
export function doTimeSlotsOverlap(
  cin1?: string,
  cout1?: string,
  cin2?: string,
  cout2?: string,
  bufferMinutes: number = 0
): boolean {
  const s1 = parseTimeToMinutes(cin1);
  const e1 = parseTimeToMinutes(cout1);
  const s2 = parseTimeToMinutes(cin2);
  const e2 = parseTimeToMinutes(cout2);

  if (s1 === null || e1 === null || s2 === null || e2 === null) {
    return true; // Conservatively flag overlap if format invalid
  }

  const end1 = e1 <= s1 ? e1 + 1440 : e1;
  const end2 = e2 <= s2 ? e2 + 1440 : e2;

  return Math.max(s1, s2) < Math.min(end1 + bufferMinutes, end2 + bufferMinutes);
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

  const roomsCount =
    (Number(b.suit_1) > 0 ? 1 : 0) +
    (Number(b.suit_2) > 0 ? 1 : 0) +
    (Number(b.suit_3) > 0 ? 1 : 0) +
    (Number(b.suit_4) > 0 ? 1 : 0) || 1;

  if (isHourlyBooking(b)) {
    const hourlyRate = b.hourly_rate || extractHourlyRateFromNotes(b.notes);
    const stayHours = b.stay_hours || extractStayHoursFromNotes(b.notes) || calculateStayHours(b.check_in_time, b.check_out_time);
    if (hourlyRate > 0 && stayHours > 0) {
      return hourlyRate * stayHours * roomsCount;
    }
  }

  const metaRate = extractRatePerRoomFromNotes(b.notes);
  if (metaRate > 0) {
    return metaRate * roomsCount;
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
  conflictingTime?: string;
  guestName?: string;
  isMaintenance?: boolean;
}

/**
 * Checks whether a suit is already booked on any date of a stay dates array.
 * Optionally excludes a set of booking IDs (e.g. current booking group being edited).
 * Supports intelligent time-slot checking when target stay is hourly.
 */
export function findConflictingBooking(
  existingBookings: Booking[],
  suitId: string,
  stayDates: string[],
  excludeBookingIds?: Set<string>,
  targetCheckInTime?: string,
  targetCheckOutTime?: string,
  targetIsHourly?: boolean
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
        const existingIsHourly = isHourlyBooking(b);

        // If both the candidate and existing bookings are hourly on this single date:
        if (targetIsHourly && existingIsHourly && stayDates.length === 1) {
          const bCin = b.check_in_time || '12:00 PM';
          const bCout = b.check_out_time || '12:00 PM';
          const tCin = targetCheckInTime || '12:00 PM';
          const tCout = targetCheckOutTime || '12:00 PM';

          const overlaps = doTimeSlotsOverlap(tCin, tCout, bCin, bCout);
          if (!overlaps) {
            // Separate time slot on the same day -> no conflict!
            continue;
          }
          return {
            isBooked: true,
            booking: b,
            conflictingDate: dateStr,
            conflictingTime: `${bCin} - ${bCout}`,
            guestName: b.guest_name,
            isMaintenance: isMaint,
          };
        }

        return {
          isBooked: true,
          booking: b,
          conflictingDate: dateStr,
          conflictingTime: existingIsHourly ? `${b.check_in_time || '12:00 PM'} - ${b.check_out_time || '12:00 PM'}` : undefined,
          guestName: b.guest_name,
          isMaintenance: isMaint,
        };
      }
    }
  }

  return { isBooked: false };
}

export function extractBankAmountFromNotes(notes?: string): number | undefined {
  const meta = parseBookingMeta(notes);
  return meta.bankAmount;
}

export function extractCashAmountFromNotes(notes?: string): number | undefined {
  const meta = parseBookingMeta(notes);
  return meta.cashAmount;
}

export function isBankPaymentMode(mode?: string): boolean {
  if (!mode) return false;
  const m = mode.trim().toUpperCase();
  return (
    m === 'UPI' ||
    m === 'ONLINE' ||
    m === 'BANK' ||
    m === 'NETBANKING' ||
    m === 'CARD' ||
    m === 'CHEQUE' ||
    m.includes('ONLINE') ||
    m.includes('ऑनलाइन') ||
    m.includes('UPI') ||
    m.includes('BANK')
  );
}

export function isCashPaymentMode(mode?: string): boolean {
  if (!mode) return true;
  const m = mode.trim().toUpperCase();
  return m === 'CASH' || m.includes('नकद') || m.includes('CASH');
}

/**
 * Computes split of rent and net collection between Bank/Online and Cash for a booking.
 */
export function getBookingPaymentSplit(b: Booking): {
  bankRent: number;
  cashRent: number;
  bankAmount: number;
  cashAmount: number;
} {
  const rent = calculateBookingRent(b);
  const food = calculateBookingFoodAmount(b);
  const exp = calculateBookingExpenditure(b);
  const gross = rent + food;
  const net = gross <= 0 ? 0 : Math.max(0, gross - exp);

  const rawMode = (b.payment_mode || extractPaymentModeFromNotes(b.notes) || 'CASH').toUpperCase();

  // If explicit split is recorded in notes or booking properties
  const bankExplicit = extractBankAmountFromNotes(b.notes) ?? b.bank_amount;
  const cashExplicit = extractCashAmountFromNotes(b.notes) ?? b.cash_amount;

  if (bankExplicit !== undefined || cashExplicit !== undefined) {
    const bAmt = Number(bankExplicit) || 0;
    const cAmt = Number(cashExplicit) || 0;
    const totalExplicit = bAmt + cAmt;
    let bRent = 0;
    let cRent = 0;
    if (totalExplicit > 0) {
      bRent = Math.min(rent, Math.round((bAmt / totalExplicit) * rent));
      cRent = Math.max(0, rent - bRent);
    } else {
      bRent = Math.min(rent, bAmt);
      cRent = Math.max(0, rent - bRent);
    }
    return {
      bankRent: bRent,
      cashRent: cRent,
      bankAmount: bAmt,
      cashAmount: cAmt,
    };
  }

  // Exempt / VIP / Govt
  if (['GOVT', 'VIP', 'FREE', 'COMPLIMENTARY', 'AS_PER_APPLICABLE'].includes(rawMode)) {
    return {
      bankRent: 0,
      cashRent: 0,
      bankAmount: 0,
      cashAmount: 0,
    };
  }

  if (isBankPaymentMode(rawMode)) {
    return {
      bankRent: rent,
      cashRent: 0,
      bankAmount: net,
      cashAmount: 0,
    };
  }

  // Default to Cash
  return {
    bankRent: 0,
    cashRent: rent,
    bankAmount: 0,
    cashAmount: net,
  };
}

export function getCurrentFormattedTime(): string {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strMinutes = minutes < 10 ? '0' + minutes : minutes;
  const strHours = hours < 10 ? '0' + hours : hours;
  return `${strHours}:${strMinutes} ${ampm}`;
}

export function updateNotesWithDatesAndTimes(
  notes: string | undefined,
  updates: {
    checkInDate?: string;
    checkOutDate?: string;
    checkInTime?: string;
    checkOutTime?: string;
  }
): string {
  const meta = parseBookingMeta(notes);
  const cleanNotes = (notes || '').replace(/\[META:.*?\]/g, '').trim();
  const updatedMeta: Record<string, any> = {
    ...meta,
    group_id: meta.groupId,
    dispatch_no: meta.dispatchNo,
    rate_per_room: meta.ratePerRoom,
    food_amount: meta.foodAmount,
    expenditure: meta.expenditure,
    payment_mode: meta.paymentMode,
    bank_amount: meta.bankAmount,
    cash_amount: meta.cashAmount,
    collected_by: meta.collectedBy,
    collection_note: meta.collectionNote,
    booking_type: meta.bookingType,
    stay_hours: meta.stayHours,
    hourly_rate: meta.hourlyRate,
  };
  if (updates.checkInDate !== undefined) updatedMeta.check_in_date = updates.checkInDate;
  if (updates.checkOutDate !== undefined) updatedMeta.check_out_date = updates.checkOutDate;
  if (updates.checkInTime !== undefined) updatedMeta.check_in_time = updates.checkInTime;
  if (updates.checkOutTime !== undefined) updatedMeta.check_out_time = updates.checkOutTime;

  const metaTag = `[META:${JSON.stringify(updatedMeta)}]`;
  return cleanNotes ? `${cleanNotes} ${metaTag}` : metaTag;
}


