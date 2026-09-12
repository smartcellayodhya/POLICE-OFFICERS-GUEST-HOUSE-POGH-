import { Booking } from './types';
import { formatToDisplayDate, calculateStayNights } from './dateUtils';
import {
  extractGroupIdFromNotes,
  cleanNotesText,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractRatePerRoomFromNotes,
} from './bookingUtils';

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
    'कुल देय किराया (₹)',
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

    const numRooms = suits.length || 1;
    const notesCin = extractCheckInDateFromNotes(b.notes);
    const notesCout = extractCheckOutDateFromNotes(b.notes);
    const checkIn = notesCin || b.booking_date;
    const checkOut = notesCout || b.booking_date;
    const stayNights = calculateStayNights(checkIn, checkOut);

    const metaRate = extractRatePerRoomFromNotes(b.notes);
    const suitRate = Math.max(Number(b.suit_1) || 0, Number(b.suit_2) || 0, Number(b.suit_3) || 0, Number(b.suit_4) || 0);
    const perRoomRent = metaRate > 0 ? metaRate : (suitRate > 1 ? suitRate : Number(b.total_amount) || 0);
    const totalPayable = perRoomRent > 0 ? perRoomRent * numRooms * stayNights : Number(b.total_amount) || 0;

    const cleanedNotes = cleanNotesText(b.notes);

    return [
      `"${refNo}"`,
      `"${formatToDisplayDate(checkIn)}"`,
      `"${formatToDisplayDate(checkOut)}"`,
      `"${stayNights} दिन"`,
      `"${b.guest_name}"`,
      `"${b.mobile_number}"`,
      `"${b.reference || '-'}"`,
      `"${suits.join(', ')}"`,
      `"${perRoomRent > 0 ? `₹${perRoomRent}` : 'लागू अनुसार'}"`,
      `"${totalPayable > 0 ? `₹${totalPayable}` : 'लागू अनुसार'}"`,
      `"${b.meal_type_status || 'PAID'}"`,
      `"${b.status || 'CONFIRMED'}"`,
      `"${cleanedNotes.replace(/"/g, '""')}"`,
    ].join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens Hindi / Devanagari characters cleanly without encoding errors
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
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
