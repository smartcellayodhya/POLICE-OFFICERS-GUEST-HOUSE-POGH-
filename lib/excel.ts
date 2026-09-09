import * as XLSX from 'xlsx';
import { Booking } from './types';
import { formatToDisplayDate } from './dateUtils';

export function exportBookingsToExcel(bookings: Booking[], fileName = 'POGH_Bookings.xlsx') {
  const rows = bookings.map((b) => ({
    'Date': formatToDisplayDate(b.booking_date),
    'Guest Name': b.guest_name,
    'Mobile Number': b.mobile_number,
    'Reference': b.reference,
    'Suit 1': b.suit_1 || 0,
    'Suit 2': b.suit_2 || 0,
    'Suit 3': b.suit_3 || 0,
    'Suit 4': b.suit_4 || 0,
    'TOTAL AMOUNT': b.total_amount || 0,
    'MEAL TYPE STATUS': b.meal_type_status || 'PAID',
    'STATUS': b.status || 'CONFIRMED',
    'NOTES': b.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 22 }, // Guest Name
    { wch: 15 }, // Mobile
    { wch: 16 }, // Reference
    { wch: 10 }, // Suit 1
    { wch: 10 }, // Suit 2
    { wch: 10 }, // Suit 3
    { wch: 10 }, // Suit 4
    { wch: 15 }, // Total
    { wch: 18 }, // Meal
    { wch: 14 }, // Status
    { wch: 25 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'POGH Bookings');

  XLSX.writeFile(workbook, fileName);
}
