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
  extractFoodAmountFromNotes,
  extractExpenditureFromNotes,
  extractPaymentModeFromNotes,
  extractCollectedByFromNotes,
  getBookingSuitsList,
} from './bookingUtils';

export function exportBookingsToExcel(
  bookings: Booking[],
  fileName = 'POGH_Ayodhya_Bookings.xlsx',
  lang: 'hi' | 'en' = 'en'
) {
  if (!bookings || bookings.length === 0) {
    alert(lang === 'hi' ? 'एक्सपोर्ट करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।' : 'No records available to export.');
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
    const totalRent = perRoomRent > 0 ? perRoomRent * numRooms * stayNights : Number(b.total_amount) || 0;

    const foodAmount = extractFoodAmountFromNotes(b.notes) || Number(b.food_amount) || 0;
    const expenditure = extractExpenditureFromNotes(b.notes) || Number(b.expenditure) || 0;
    const grossCollection = totalRent + foodAmount;
    // Free rooms with no room rent and no food charge must never go negative
    const netCollection = grossCollection <= 0 ? 0 : Math.max(0, grossCollection - expenditure);
    const paymentMode = extractPaymentModeFromNotes(b.notes) || b.payment_mode || (netCollection > 0 ? 'CASH' : '-');
    const collectedBy = extractCollectedByFromNotes(b.notes) || b.collected_by || '-';

    let mealLabel = lang === 'hi' ? 'सशुल्क' : 'Paid';
    if (b.meal_type_status === 'COMPLIMENTARY') mealLabel = lang === 'hi' ? 'शासकीय / वीआईपी' : 'Complimentary';
    else if (b.meal_type_status === 'FREE') mealLabel = lang === 'hi' ? 'निःशुल्क' : 'Free';
    else if (b.meal_type_status === 'NOT REQUIRED') mealLabel = lang === 'hi' ? 'लागू नहीं' : 'Not Required';
    else if (b.meal_type_status === 'AS PER APPLICABLE' || b.meal_type_status === 'AS_PER_APPLICABLE') mealLabel = lang === 'hi' ? 'नियमानुसार' : 'As per Applicable';

    let statusLabel = lang === 'hi' ? 'आरक्षित' : 'Confirmed';
    if (b.status === 'CHECKED_IN') statusLabel = lang === 'hi' ? 'उपस्थित' : 'In-House';
    else if (b.status === 'CHECKED_OUT') statusLabel = lang === 'hi' ? 'चेक-आउट' : 'Checked-Out';
    else if (b.status === 'CANCELLED') statusLabel = lang === 'hi' ? 'निरस्त' : 'Cancelled';
    else if (b.status === 'MAINTENANCE') statusLabel = lang === 'hi' ? 'मरम्मत ब्लॉक' : 'Maintenance';

    if (lang === 'hi') {
      return {
        'संदर्भ सं०': refNo,
        'पत्र क्रमांक': dispatchNo,
        'आगमन तिथि': formatToDisplayDate(checkIn),
        'प्रस्थान तिथि': formatToDisplayDate(checkOut),
        'अवधि': `${stayNights} रात्रि (${stayNights} दिन)`,
        'अतिथि का नाम': b.guest_name,
        'मोबाइल नंबर': b.mobile_number,
        'संदर्भ': b.reference || '-',
        'आवंटित सूट': suits.join(', ') || 'Suit 1',
        'कमरों की संख्या': numRooms,
        'दैनिक किराया (₹)': perRoomRent > 0 ? perRoomRent : 'नियमानुसार',
        'कमरा किराया (₹)': totalRent > 0 ? totalRent : 0,
        'खान-पान संग्रह (₹)': foodAmount > 0 ? foodAmount : 0,
        'व्यय / खर्च (₹)': expenditure > 0 ? expenditure : 0,
        'कुल शुद्ध संग्रह (₹)': netCollection > 0 ? netCollection : 0,
        'भुगतान माध्यम': paymentMode === 'CASH' ? 'नकद' : paymentMode,
        'कलेक्शन कर्ता': collectedBy,
        'भोजन व्यवस्था': mealLabel,
        'स्थिति': statusLabel,
        'टिप्पणी': cleanNotesText(b.notes) || '-',
      };
    }

    return {
      'Ref No': refNo,
      'Dispatch No': dispatchNo,
      'Check-In Date': formatToDisplayDate(checkIn),
      'Check-Out Date': formatToDisplayDate(checkOut),
      'Stay Duration': `${stayNights} Night(s)`,
      'Guest Name': b.guest_name,
      'Mobile Number': b.mobile_number,
      'Reference': b.reference || '-',
      'Allocated Suits': suits.join(', ') || 'Suit 1',
      'Number of Rooms': numRooms,
      'Daily Rate (₹)': perRoomRent > 0 ? perRoomRent : 'As per applicable',
      'Room Rent (₹)': totalRent > 0 ? totalRent : 0,
      'Food Bill (₹)': foodAmount > 0 ? foodAmount : 0,
      'Expenditure (₹)': expenditure > 0 ? expenditure : 0,
      'Net Collection (₹)': netCollection > 0 ? netCollection : 0,
      'Payment Mode': paymentMode,
      'Collected By': collectedBy,
      'Meal Status': mealLabel,
      'Status': statusLabel,
      'Remarks': cleanNotesText(b.notes) || '-',
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
    { wch: 16 }, // Room Rent
    { wch: 16 }, // Food Bill
    { wch: 16 }, // Expenditure
    { wch: 20 }, // Net Collection
    { wch: 14 }, // Mode
    { wch: 22 }, // Collected By
    { wch: 18 }, // Meal Status
    { wch: 20 }, // Status
    { wch: 26 }, // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, lang === 'hi' ? 'बुकिंग पंजिका' : 'Bookings Directory');

  XLSX.writeFile(workbook, fileName);
}

