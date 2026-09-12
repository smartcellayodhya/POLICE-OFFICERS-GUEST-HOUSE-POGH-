import * as XLSX from 'xlsx';
import { Booking } from './types';
import { formatToDisplayDate, calculateStayNights } from './dateUtils';
import {
  extractGroupIdFromNotes,
  cleanNotesText,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractRatePerRoomFromNotes,
} from './bookingUtils';

export function exportBookingsToExcel(bookings: Booking[], fileName = 'POGH_Bookings.xlsx') {
  const rows = bookings.map((b) => {
    const notesCin = extractCheckInDateFromNotes(b.notes);
    const notesCout = extractCheckOutDateFromNotes(b.notes);
    const checkIn = notesCin || b.booking_date;
    const checkOut = notesCout || b.booking_date;
    const stayNights = calculateStayNights(checkIn, checkOut);
    const refNo = b.group_id || extractGroupIdFromNotes(b.notes) || `POGH-${b.id.slice(0, 4)}`;

    return {
      'Booking Ref': refNo,
      'Check-In Date': formatToDisplayDate(checkIn),
      'Check-Out Date': formatToDisplayDate(checkOut),
      'Stay Days': `${stayNights} Night(s)`,
      'Guest Name': b.guest_name,
      'Mobile Number': b.mobile_number,
      'Reference': b.reference,
      'Suit 1': b.suit_1 || 0,
      'Suit 2': b.suit_2 || 0,
      'Suit 3': b.suit_3 || 0,
      'Suit 4': b.suit_4 || 0,
      'Total Amount': b.total_amount || 0,
      'Meal Status': b.meal_type_status || 'PAID',
      'Status': b.status || 'CONFIRMED',
      'Remarks': cleanNotesText(b.notes),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Ref
    { wch: 14 }, // Check-In
    { wch: 14 }, // Check-Out
    { wch: 12 }, // Stay Days
    { wch: 22 }, // Guest Name
    { wch: 15 }, // Mobile
    { wch: 16 }, // Reference
    { wch: 10 }, // Suit 1
    { wch: 10 }, // Suit 2
    { wch: 10 }, // Suit 3
    { wch: 10 }, // Suit 4
    { wch: 15 }, // Total
    { wch: 16 }, // Meal
    { wch: 14 }, // Status
    { wch: 25 }, // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'POGH Bookings');

  XLSX.writeFile(workbook, fileName);
}
