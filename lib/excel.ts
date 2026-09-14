import * as XLSX from 'xlsx';
import { Booking } from './types';
import { formatToDisplayDate, calculateStayNights } from './dateUtils';
import {
  extractGroupIdFromNotes,
  extractDispatchNoFromNotes,
  cleanNotesText,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractRatePerRoomFromNotes,
  getBookingSuitsList,
} from './bookingUtils';

export function exportBookingsToExcel(bookings: Booking[], fileName = 'POGH_Ayodhya_Bookings.xlsx') {
  if (!bookings || bookings.length === 0) {
    alert('एक्सपोर्ट करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।');
    return;
  }

  const rows = bookings.map((b) => {
    const notesCin = extractCheckInDateFromNotes(b.notes);
    const notesCout = extractCheckOutDateFromNotes(b.notes);
    const checkIn = notesCin || b.booking_date;
    const checkOut = notesCout || b.booking_date;
    const stayNights = calculateStayNights(checkIn, checkOut);
    const refNo = b.group_id || extractGroupIdFromNotes(b.notes) || `POGH-${b.id.slice(0, 4)}`;
    const dispatchNo = b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';

    const suits = getBookingSuitsList(b);
    const numRooms = suits.length || 1;
    const metaRate = extractRatePerRoomFromNotes(b.notes);
    const suitRate = Math.max(Number(b.suit_1) || 0, Number(b.suit_2) || 0, Number(b.suit_3) || 0, Number(b.suit_4) || 0);
    const perRoomRent = metaRate > 0 ? metaRate : (suitRate > 1 ? suitRate : Number(b.total_amount) || 0);
    const totalPayable = perRoomRent > 0 ? perRoomRent * numRooms * stayNights : Number(b.total_amount) || 0;

    let mealLabel = 'सशुल्क (PAID)';
    if (b.meal_type_status === 'COMPLIMENTARY') mealLabel = 'शासकीय / वीआईपी';
    else if (b.meal_type_status === 'FREE') mealLabel = 'निःशुल्क (FREE)';
    else if (b.meal_type_status === 'NOT REQUIRED') mealLabel = 'लागू नहीं';

    let statusLabel = 'कन्फर्म (CONFIRMED)';
    if (b.status === 'CHECKED_IN') statusLabel = 'इन-हाउस (CHECKED-IN)';
    else if (b.status === 'CHECKED_OUT') statusLabel = 'चेक-आउट (CHECKED-OUT)';
    else if (b.status === 'CANCELLED') statusLabel = 'निरस्त (CANCELLED)';
    else if (b.status === 'MAINTENANCE') statusLabel = 'मरम्मत ब्लॉक (MAINTENANCE)';

    return {
      'संदर्भ सं० (Ref No)': refNo,
      'पत्र क्रमांक (Dispatch No)': dispatchNo,
      'आगमन तिथि (Check-In)': formatToDisplayDate(checkIn),
      'प्रस्थान तिथि (Check-Out)': formatToDisplayDate(checkOut),
      'अवधि (Stay Duration)': `${stayNights} रात्रि (${stayNights} दिन)`,
      'अतिथि का नाम (Guest Name)': b.guest_name,
      'मोबाइल नंबर (Mobile)': b.mobile_number,
      'संदर्भ (Reference)': b.reference || '-',
      'आवंटित सूट (Suits)': suits.join(', ') || 'Suit 1',
      'कमरों की संख्या (Rooms)': numRooms,
      'दैनिक किराया ₹ (Room Rate)': perRoomRent > 0 ? perRoomRent : 'लागू अनुसार',
      'कुल किराया ₹ (Total Rent)': totalPayable > 0 ? totalPayable : 'लागू अनुसार',
      'भोजन व्यवस्था (Meal Status)': mealLabel,
      'स्थिति (Status)': statusLabel,
      'विवरण / रिमार्क्स (Remarks)': cleanNotesText(b.notes) || '-',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set optimized column widths
  worksheet['!cols'] = [
    { wch: 18 }, // Ref No
    { wch: 16 }, // Dispatch No
    { wch: 15 }, // Check-In
    { wch: 15 }, // Check-Out
    { wch: 16 }, // Stay Duration
    { wch: 24 }, // Guest Name
    { wch: 15 }, // Mobile
    { wch: 18 }, // Reference
    { wch: 16 }, // Suits
    { wch: 10 }, // Rooms
    { wch: 16 }, // Room Rate
    { wch: 16 }, // Total Rent
    { wch: 18 }, // Meal Status
    { wch: 20 }, // Status
    { wch: 26 }, // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'POGH Bookings');

  XLSX.writeFile(workbook, fileName);
}

