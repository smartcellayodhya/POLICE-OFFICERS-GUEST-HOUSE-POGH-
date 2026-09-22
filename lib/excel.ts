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
  calculateBookingRent,
  getBookingSuitsList,
  isHourlyBooking,
  extractStayHoursFromNotes,
  extractHourlyRateFromNotes,
} from './bookingUtils';

/**
 * Neutralizes CSV/Excel Formula Injection (CWE-1236).
 * Prepend single quote (') if string starts with dangerous formula characters (=, +, -, @, \t, \r).
 */
export function sanitizeExcelCell(val: any): any {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${val}`;
  }
  return val;
}

export interface StayExportItem {
  id: string;
  groupId: string;
  dispatchNo: string;
  checkInDate: string;
  checkOutDate: string;
  stayNights: number;
  guestName: string;
  mobileNumber: string;
  reference: string;
  suits: string[];
  roomsCount: number;
  perRoomRent: number;
  totalRent: number;
  foodAmount: number;
  expenditure: number;
  netCollection: number;
  paymentMode: string;
  collectedBy: string;
  mealStatus: string;
  status: string;
  notes: string;
  isHourly: boolean;
  stayHours?: number;
}

/**
 * Normalizes either raw Bookings[] or pre-grouped Stays into unique, deduplicated StayExportItem[].
 * Guarantees zero duplicate rows and zero duplicate billing in Excel.
 */
function normalizeToStayExportItems(input: any[]): StayExportItem[] {
  if (!input || input.length === 0) return [];

  // If input already contains pre-grouped stays (from BookingsTable)
  if (input[0] && ('primaryBooking' in input[0] || 'stayNights' in input[0])) {
    return input.map((stay: any) => {
      const primary: Booking = stay.primaryBooking || stay;
      const suits: string[] = Array.isArray(stay.suits) ? stay.suits : getBookingSuitsList(primary);
      const roomsCount = suits.length || 1;
      const stayNights = Number(stay.stayNights) || 1;
      const totalRent = Number(stay.totalRent) || 0;
      const foodAmount = Number(stay.foodAmount) || 0;
      const expenditure = Number(stay.expenditure) || 0;
      const gross = totalRent + foodAmount;
      const netCollection = gross <= 0 ? 0 : Math.max(0, gross - expenditure);

      return {
        id: primary.id,
        groupId: stay.groupId || primary.group_id || extractGroupIdFromNotes(primary.notes) || `POGH-${primary.id.slice(0, 4)}`,
        dispatchNo: stay.dispatchNo || primary.dispatch_no || extractDispatchNoFromNotes(primary.notes) || '-',
        checkInDate: stay.checkInDate || extractCheckInDateFromNotes(primary.notes) || primary.booking_date,
        checkOutDate: stay.checkOutDate || extractCheckOutDateFromNotes(primary.notes) || primary.booking_date,
        stayNights,
        guestName: stay.guestName || primary.guest_name,
        mobileNumber: stay.mobileNumber || primary.mobile_number,
        reference: stay.reference || primary.reference || '-',
        suits,
        roomsCount,
        perRoomRent: roomsCount > 0 && stayNights > 0 ? Math.round(totalRent / (roomsCount * stayNights)) : totalRent,
        totalRent,
        foodAmount,
        expenditure,
        netCollection,
        paymentMode: stay.paymentMode || primary.payment_mode || (netCollection > 0 ? 'CASH' : '-'),
        collectedBy: stay.collectedBy || primary.collected_by || '-',
        mealStatus: stay.mealStatus || primary.meal_type_status || 'PAID',
        status: stay.status || primary.status || 'CONFIRMED',
        notes: stay.notes || primary.notes || '',
        isHourly: Boolean(stay.isHourly || isHourlyBooking(primary)),
        stayHours: stay.stayHours || extractStayHoursFromNotes(primary.notes) || (primary.stay_hours ? Number(primary.stay_hours) : undefined),
      };
    });
  }

  // Otherwise, group raw Booking[] by stay group/reference
  const groupMap = new Map<string, Booking[]>();
  input.forEach((b: Booking) => {
    const gKey = b.group_id || extractGroupIdFromNotes(b.notes) || `ID-${b.id}`;
    if (!groupMap.has(gKey)) {
      groupMap.set(gKey, []);
    }
    groupMap.get(gKey)!.push(b);
  });

  const items: StayExportItem[] = [];

  groupMap.forEach((dayBookings, gKey) => {
    dayBookings.sort((a, b) => a.booking_date.localeCompare(b.booking_date));
    const primary = dayBookings[0];
    const isHourly = isHourlyBooking(primary);

    const notesCin = extractCheckInDateFromNotes(primary.notes);
    const notesCout = extractCheckOutDateFromNotes(primary.notes);
    const checkInDate = notesCin || dayBookings[0].booking_date;
    const checkOutDate = notesCout || dayBookings[dayBookings.length - 1].booking_date;
    const stayNights = isHourly ? 1 : Math.max(dayBookings.length, calculateStayNights(checkInDate, checkOutDate));

    const suitSet = new Set<string>();
    let totalRent = 0;
    let foodAmount = extractFoodAmountFromNotes(primary.notes) || Number(primary.food_amount) || 0;
    let expenditure = extractExpenditureFromNotes(primary.notes) || Number(primary.expenditure) || 0;
    let paymentMode = primary.payment_mode || extractPaymentModeFromNotes(primary.notes) || '';
    let collectedBy = primary.collected_by || extractCollectedByFromNotes(primary.notes) || '';

    dayBookings.forEach((b) => {
      getBookingSuitsList(b).forEach((s) => suitSet.add(s));
      totalRent += calculateBookingRent(b);
      if (!paymentMode && (b.payment_mode || extractPaymentModeFromNotes(b.notes))) {
        paymentMode = b.payment_mode || extractPaymentModeFromNotes(b.notes) || '';
      }
      if (!collectedBy && (b.collected_by || extractCollectedByFromNotes(b.notes))) {
        collectedBy = b.collected_by || extractCollectedByFromNotes(b.notes) || '';
      }
    });

    const suits = Array.from(suitSet).sort();
    const roomsCount = suits.length || 1;
    const gross = totalRent + foodAmount;
    const netCollection = gross <= 0 ? 0 : Math.max(0, gross - expenditure);

    items.push({
      id: primary.id,
      groupId: primary.group_id || extractGroupIdFromNotes(primary.notes) || `POGH-${primary.id.slice(0, 4)}`,
      dispatchNo: primary.dispatch_no || extractDispatchNoFromNotes(primary.notes) || '-',
      checkInDate,
      checkOutDate,
      stayNights,
      guestName: primary.guest_name,
      mobileNumber: primary.mobile_number,
      reference: primary.reference || '-',
      suits: suits.length > 0 ? suits : ['Suit 1'],
      roomsCount,
      perRoomRent: roomsCount > 0 && stayNights > 0 ? Math.round(totalRent / (roomsCount * stayNights)) : totalRent,
      totalRent,
      foodAmount,
      expenditure,
      netCollection,
      paymentMode: paymentMode || (netCollection > 0 ? 'CASH' : '-'),
      collectedBy: collectedBy || '-',
      mealStatus: primary.meal_type_status || 'PAID',
      status: primary.status || 'CONFIRMED',
      notes: primary.notes || '',
      isHourly,
      stayHours: extractStayHoursFromNotes(primary.notes) || (primary.stay_hours ? Number(primary.stay_hours) : undefined),
    });
  });

  return items;
}

/**
 * Exports bookings / stays to formatted Excel spreadsheet.
 * Matches the official Police Officers Guest House (POGH) PDF register format with summary totals.
 */
export async function exportBookingsToExcel(
  bookingsOrStays: any[],
  fileName = 'POGH_Ayodhya_Bookings_Register.xlsx',
  lang: 'hi' | 'en' = 'en'
) {
  if (!bookingsOrStays || bookingsOrStays.length === 0) {
    alert(lang === 'hi' ? 'एक्सपोर्ट करने के लिए कोई रिकॉर्ड उपलब्ध नहीं है।' : 'No records available to export.');
    return;
  }

  const XLSX = await import('xlsx');
  const items = normalizeToStayExportItems(bookingsOrStays);

  let grandTotalRent = 0;
  let grandTotalFood = 0;
  let grandTotalExp = 0;
  let grandTotalNet = 0;
  let grandTotalNights = 0;
  let grandTotalRooms = 0;

  const rows: Record<string, any>[] = items.map((item, idx) => {
    grandTotalRent += item.totalRent;
    grandTotalFood += item.foodAmount;
    grandTotalExp += item.expenditure;
    grandTotalNet += item.netCollection;
    grandTotalNights += item.stayNights;
    grandTotalRooms += item.roomsCount;

    let mealLabel = lang === 'hi' ? 'सशुल्क' : 'Paid';
    if (item.mealStatus === 'COMPLIMENTARY') mealLabel = lang === 'hi' ? 'शासकीय / वीआईपी' : 'Complimentary';
    else if (item.mealStatus === 'FREE') mealLabel = lang === 'hi' ? 'निःशुल्क' : 'Free';
    else if (item.mealStatus === 'NOT REQUIRED') mealLabel = lang === 'hi' ? 'लागू नहीं' : 'Not Required';
    else if (item.mealStatus === 'AS PER APPLICABLE' || item.mealStatus === 'AS_PER_APPLICABLE') mealLabel = lang === 'hi' ? 'नियमानुसार' : 'As per Applicable';

    let statusLabel = lang === 'hi' ? 'आरक्षित' : 'Confirmed';
    if (item.status === 'CHECKED_IN') statusLabel = lang === 'hi' ? 'उपस्थित' : 'In-House';
    else if (item.status === 'CHECKED_OUT') statusLabel = lang === 'hi' ? 'चेक-आउट' : 'Checked-Out';
    else if (item.status === 'CANCELLED') statusLabel = lang === 'hi' ? 'निरस्त' : 'Cancelled';
    else if (item.status === 'MAINTENANCE') statusLabel = lang === 'hi' ? 'मरम्मत ब्लॉक' : 'Maintenance';

    const payModeHindi = item.paymentMode === 'CASH' ? 'नकद' : (item.paymentMode === 'ONLINE' || item.paymentMode === 'UPI' ? 'ऑनलाइन/यूपीआई' : item.paymentMode);

    if (lang === 'hi') {
      return {
        'क्र०': idx + 1,
        'पत्र क्रमांक': item.dispatchNo,
        'संदर्भ सं०': item.groupId,
        'आगमन तिथि': formatToDisplayDate(item.checkInDate),
        'प्रस्थान तिथि': formatToDisplayDate(item.checkOutDate),
        'अवधि': item.isHourly
          ? `अल्पकालिक (${item.stayHours || 2} घंटे)`
          : `${item.stayNights} रात्रि (${item.stayNights} दिन)`,
        'अधिकारी / अतिथि का नाम': item.guestName,
        'पदनाम / संदर्भ': item.reference || '-',
        'मोबाइल नंबर': item.mobileNumber,
        'आवंटित सूट': item.suits.join(', ') || 'Suit 1',
        'कक्ष संख्या': item.roomsCount,
        'कमरा किराया (₹)': item.totalRent > 0 ? item.totalRent : 0,
        'भोजन संग्रह (₹)': item.foodAmount > 0 ? item.foodAmount : 0,
        'व्यय / खर्च (₹)': item.expenditure > 0 ? item.expenditure : 0,
        'शुद्ध राजकीय संग्रह (₹)': item.netCollection > 0 ? item.netCollection : 0,
        'भुगतान माध्यम': payModeHindi,
        'कलेक्शन कर्ता': item.collectedBy,
        'भोजन व्यवस्था': mealLabel,
        'स्थिति': statusLabel,
        'टिप्पणी': cleanNotesText(item.notes) || '-',
      };
    }

    return {
      'S.No.': idx + 1,
      'Dispatch No': item.dispatchNo,
      'Ref No': item.groupId,
      'Check-In Date': formatToDisplayDate(item.checkInDate),
      'Check-Out Date': formatToDisplayDate(item.checkOutDate),
      'Stay Duration': item.isHourly
        ? `Hourly (${item.stayHours || 2} hrs)`
        : `${item.stayNights} Night(s)`,
      'Officer / Guest Name': item.guestName,
      'Reference / Designation': item.reference || '-',
      'Mobile Number': item.mobileNumber,
      'Allocated Suits': item.suits.join(', ') || 'Suit 1',
      'Rooms Count': item.roomsCount,
      'Room Rent (₹)': item.totalRent > 0 ? item.totalRent : 0,
      'Food Bill (₹)': item.foodAmount > 0 ? item.foodAmount : 0,
      'Expenditure (₹)': item.expenditure > 0 ? item.expenditure : 0,
      'Net Collection (₹)': item.netCollection > 0 ? item.netCollection : 0,
      'Payment Mode': item.paymentMode,
      'Collected By': item.collectedBy,
      'Meal Status': mealLabel,
      'Status': statusLabel,
      'Remarks': cleanNotesText(item.notes) || '-',
    };
  });

  // Official Total Summary Row (Identical to PDF Statement Summary)
  if (lang === 'hi') {
    rows.push({
      'क्र०': 'कुल योग',
      'पत्र क्रमांक': '-',
      'संदर्भ सं०': `${items.length} आवंटन`,
      'आगमन तिथि': '-',
      'प्रस्थान तिथि': '-',
      'अवधि': `${grandTotalNights} कक्ष-रात्रि`,
      'अधिकारी / अतिथि का नाम': 'समस्त आवंटन कुल योग',
      'पदनाम / संदर्भ': '-',
      'मोबाइल नंबर': '-',
      'आवंटित सूट': '-',
      'कक्ष संख्या': grandTotalRooms,
      'कमरा किराया (₹)': grandTotalRent,
      'भोजन संग्रह (₹)': grandTotalFood,
      'व्यय / खर्च (₹)': grandTotalExp,
      'शुद्ध राजकीय संग्रह (₹)': grandTotalNet,
      'भुगतान माध्यम': '-',
      'कलेक्शन कर्ता': '-',
      'भोजन व्यवस्था': '-',
      'स्थिति': '-',
      'टिप्पणी': 'पंजीकृत शासकीय लेखा',
    });
  } else {
    rows.push({
      'S.No.': 'TOTAL',
      'Dispatch No': '-',
      'Ref No': `${items.length} Bookings`,
      'Check-In Date': '-',
      'Check-Out Date': '-',
      'Stay Duration': `${grandTotalNights} Room-Nights`,
      'Officer / Guest Name': 'Grand Total Summary',
      'Reference / Designation': '-',
      'Mobile Number': '-',
      'Allocated Suits': '-',
      'Rooms Count': grandTotalRooms,
      'Room Rent (₹)': grandTotalRent,
      'Food Bill (₹)': grandTotalFood,
      'Expenditure (₹)': grandTotalExp,
      'Net Collection (₹)': grandTotalNet,
      'Payment Mode': '-',
      'Collected By': '-',
      'Meal Status': '-',
      'Status': '-',
      'Remarks': 'Official Total Statement',
    });
  }

  const sanitizedRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, sanitizeExcelCell(v)]))
  );

  const worksheet = XLSX.utils.json_to_sheet(sanitizedRows);

  // Set optimized official column widths
  worksheet['!cols'] = [
    { wch: 8 },  // S.No.
    { wch: 16 }, // Dispatch No
    { wch: 18 }, // Ref No
    { wch: 14 }, // Check-In
    { wch: 14 }, // Check-Out
    { wch: 16 }, // Stay Duration
    { wch: 26 }, // Officer / Guest Name
    { wch: 20 }, // Reference / Designation
    { wch: 14 }, // Mobile
    { wch: 16 }, // Allocated Suits
    { wch: 12 }, // Rooms Count
    { wch: 16 }, // Room Rent
    { wch: 16 }, // Food Bill
    { wch: 16 }, // Expenditure
    { wch: 22 }, // Net Collection
    { wch: 16 }, // Payment Mode
    { wch: 22 }, // Collected By
    { wch: 18 }, // Meal Status
    { wch: 16 }, // Status
    { wch: 24 }, // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    lang === 'hi' ? 'शासकीय पंजिका आख्या' : 'POGH Official Register'
  );

  XLSX.writeFile(workbook, fileName);
}
