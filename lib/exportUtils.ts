import { Booking } from './types';
import { formatToDisplayDate } from './dateUtils';
import { extractGroupIdFromNotes } from './bookingUtils';

export function exportBookingsToCSV(bookings: Booking[], filename = 'POGH_Ayodhya_Bookings.csv') {
  if (!bookings || bookings.length === 0) {
    alert('एक्सपोर्ट करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।');
    return;
  }

  // Column Headers in Hindi
  const headers = [
    'पत्रांक / संदर्भ सं०',
    'बुकिंग दिनांक',
    'गेस्ट का नाम',
    'मोबाइल नंबर',
    'संदर्भ (रेफरेंस)',
    'आरक्षित सूट',
    'प्रति रूम किराया (₹)',
    'भोजन व्यवस्था',
    'बुकिंग स्थिति',
    'विशेष विवरण (रिमार्क्स)',
  ];

  const rows = bookings.map((b) => {
    const refNo = b.group_id || extractGroupIdFromNotes(b.notes) || `POGH-${b.id.slice(0, 4)}`;
    const suits: string[] = [];
    if (b.suit_1 > 0) suits.push('Suit 1 (भू-तल)');
    if (b.suit_2 > 0) suits.push('Suit 2 (भू-तल)');
    if (b.suit_3 > 0) suits.push('Suit 3 (प्रथम तल)');
    if (b.suit_4 > 0) suits.push('Suit 4 (प्रथम तल)');

    const rent = Number(b.total_amount) > 0 ? `₹${Number(b.total_amount)}` : 'As Per Applicable';

    return [
      `"${refNo}"`,
      `"${formatToDisplayDate(b.booking_date)}"`,
      `"${b.guest_name}"`,
      `"${b.mobile_number}"`,
      `"${b.reference || '-'}"`,
      `"${suits.join(', ')}"`,
      `"${rent}"`,
      `"${b.meal_type_status || 'PAID'}"`,
      `"${b.status || 'CONFIRMED'}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`,
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
