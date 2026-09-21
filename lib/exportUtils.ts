import { Booking } from './types';
import { formatToDisplayDate, calculateStayNights } from './dateUtils';
import {
  extractGroupIdFromNotes,
  cleanNotesText,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractRatePerRoomFromNotes,
  extractPaymentModeFromNotes,
  extractCollectedByFromNotes,
  isHourlyBooking,
  extractStayHoursFromNotes,
  extractHourlyRateFromNotes,
  calculateBookingRent,
  calculateBookingFoodAmount,
  calculateBookingExpenditure,
  calculateBookingNetCollection,
} from './bookingUtils';
import { sanitizeExcelCell } from './excel';

/**
 * Neutralizes CSV Formula Injection (CWE-1236) and safely escapes quotes.
 */
function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const sanitized = sanitizeExcelCell(val);
  const str = String(sanitized);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function exportBookingsToCSV(bookings: Booking[], filename = 'POGH_Ayodhya_Bookings.csv') {
  if (!bookings || bookings.length === 0) {
    alert('एक्सपोर्ट करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।');
    return;
  }

  // Column Headers in Hindi
  const headers = [
    'पत्रांक / संदर्भ सं०',
    'आगमन तिथि (Check-In)',
    'प्रस्थान तिथि (Check-Out)',
    'कुल दिवस / रात्रि',
    'गेस्ट का नाम',
    'मोबाइल नंबर',
    'संदर्भ (रेफरेंस)',
    'आरक्षित सूट',
    'प्रति रूम किराया (₹)',
    'कमरा किराया (₹)',
    'खान-पान संग्रह (₹)',
    'व्यय / खर्च (₹)',
    'कुल शुद्ध संग्रह (₹)',
    'भुगतान माध्यम',
    'कलेक्शन कर्ता',
    'भोजन व्यवस्था',
    'बुकिंग स्थिति',
    'विशेष विवरण (रिमार्क्स)',
  ];

  const rows = bookings.map((b) => {
    const refNo = b.group_id || extractGroupIdFromNotes(b.notes) || `POGH-${b.id.slice(0, 4)}`;
    const suits: string[] = [];
    if (b.suit_1 > 0) suits.push('Suit 1');
    if (b.suit_2 > 0) suits.push('Suit 2');
    if (b.suit_3 > 0) suits.push('Suit 3');
    if (b.suit_4 > 0) suits.push('Suit 4');

    const isHourly = isHourlyBooking(b);
    const stayHours = extractStayHoursFromNotes(b.notes) || (b.stay_hours ? Number(b.stay_hours) : 2);
    const hourlyRate = extractHourlyRateFromNotes(b.notes) || (b.hourly_rate ? Number(b.hourly_rate) : undefined);

    const numRooms = suits.length || 1;
    const notesCin = extractCheckInDateFromNotes(b.notes);
    const notesCout = extractCheckOutDateFromNotes(b.notes);
    const checkIn = notesCin || b.booking_date;
    const checkOut = notesCout || b.booking_date;
    const stayNights = isHourly ? 1 : calculateStayNights(checkIn, checkOut);

    const metaRate = extractRatePerRoomFromNotes(b.notes);
    const suitRate = Math.max(Number(b.suit_1) || 0, Number(b.suit_2) || 0, Number(b.suit_3) || 0, Number(b.suit_4) || 0);
    const perRoomRent = metaRate > 0 ? metaRate : (suitRate > 1 ? suitRate : Number(b.total_amount) || 0);
    
    // Authoritative consistent financial calculation
    const totalRent = calculateBookingRent(b);
    const foodAmount = calculateBookingFoodAmount(b);
    const expenditure = calculateBookingExpenditure(b);
    const netCollection = calculateBookingNetCollection(b);
    const paymentMode = extractPaymentModeFromNotes(b.notes) || b.payment_mode || (netCollection > 0 ? 'CASH' : '-');
    const collectedBy = extractCollectedByFromNotes(b.notes) || b.collected_by || '-';
    const cleanedNotes = cleanNotesText(b.notes);

    return [
      formatCsvCell(refNo),
      formatCsvCell(formatToDisplayDate(checkIn)),
      formatCsvCell(formatToDisplayDate(checkOut)),
      formatCsvCell(
        isHourly
          ? `अल्पकालिक (${stayHours} घंटे: ${b.check_in_time || '10:00'}-${b.check_out_time || '14:00'})`
          : `${stayNights} दिन`
      ),
      formatCsvCell(b.guest_name),
      formatCsvCell(b.mobile_number),
      formatCsvCell(b.reference || '-'),
      formatCsvCell(suits.join(', ')),
      formatCsvCell(
        isHourly && hourlyRate
          ? `₹${hourlyRate}/घंटा`
          : (perRoomRent > 0 ? `₹${perRoomRent}` : 'As per applicable')
      ),
      formatCsvCell(totalRent > 0 ? `₹${totalRent}` : 'As per applicable'),
      formatCsvCell(foodAmount > 0 ? `₹${foodAmount}` : 0),
      formatCsvCell(expenditure > 0 ? `₹${expenditure}` : 0),
      formatCsvCell(netCollection > 0 ? `₹${netCollection}` : 0),
      formatCsvCell(paymentMode),
      formatCsvCell(collectedBy),
      formatCsvCell(b.meal_type_status || 'PAID'),
      formatCsvCell(b.status || 'CONFIRMED'),
      formatCsvCell(cleanedNotes),
    ].join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens Hindi / Devanagari characters cleanly without encoding errors
  const csvContent = '\uFEFF' + [headers.map(formatCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
