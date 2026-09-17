'use client';

import React, { useState, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { Booking } from '@/lib/types';
import { formatMonthKey, formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import {
  calculateBookingRent,
  getBookingRoomsCount,
  getBookingSuitsList,
  extractDispatchNoFromNotes,
  extractGroupIdFromNotes,
  calculateBookingFoodAmount,
  calculateBookingTotalCollection,
  calculateBookingExpenditure,
  calculateBookingNetCollection,
  extractPaymentModeFromNotes,
  isHourlyBooking,
} from '@/lib/bookingUtils';
import { useLanguage } from '@/lib/languageContext';
import { printDocumentDirectly } from '@/lib/pdfUtils';
import { sanitizeExcelCell } from '@/lib/excel';
import {
  Calendar,
  IndianRupee,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  Building2,
  TrendingUp,
  TrendingDown,
  History,
  FileText,
  Award,
  CheckCircle2,
  BarChart3,
  Utensils,
} from 'lucide-react';

interface MonthlyCollectionPageProps {
  bookings: Booking[];
  onSelectBooking?: (booking: Booking) => void;
}

export const MonthlyCollectionPage: React.FC<MonthlyCollectionPageProps> = ({
  bookings,
  onSelectBooking,
}) => {
  const { language } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedPrintMonth, setSelectedPrintMonth] = useState<string>('ALL');
  const [activePrintingMonth, setActivePrintingMonth] = useState<string>('ALL');

  // Determine current and last month keys dynamically
  const { currentMonthKey, lastMonthKey } = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;
    const currentKey = `${currYear}-${String(currMonth).padStart(2, '0')}`;

    const lastMonthDate = new Date(currYear, currMonth - 2, 1);
    const lastKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    return { currentMonthKey: currentKey, lastMonthKey: lastKey };
  }, []);

  // Map of groupId -> primary bookingId that carries the food & expenditure for the stay
  const primaryGroupMap = useMemo(() => {
    const map: Record<string, string> = {};
    const sorted = [...bookings].sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || ''));
    for (const b of sorted) {
      const ref = b.group_id || extractGroupIdFromNotes(b.notes);
      if (ref && !map[ref]) {
        map[ref] = b.id;
      }
    }
    return map;
  }, [bookings]);

  const isPrimaryForStayCharges = useCallback(
    (b: Booking) => {
      const ref = b.group_id || extractGroupIdFromNotes(b.notes);
      if (!ref) return true;
      return primaryGroupMap[ref] === b.id;
    },
    [primaryGroupMap]
  );

  // Aggregate active bookings by month (YYYY-MM)
  const monthlyData = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'CANCELLED');
    const monthMap: Record<
      string,
      {
        monthKey: string;
        bookings: Booking[];
        totalRent: number;
        totalFood: number;
        totalExpenditure: number;
        grandTotal: number;
        roomsCount: number;
      }
    > = {};

    active.forEach((b) => {
      const monthKey = (b.booking_date || '').slice(0, 7);
      if (!monthKey || monthKey.length < 7) return;

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          monthKey,
          bookings: [],
          totalRent: 0,
          totalFood: 0,
          totalExpenditure: 0,
          grandTotal: 0,
          roomsCount: 0,
        };
      }

      const isPrimary = isPrimaryForStayCharges(b);
      const rent = calculateBookingRent(b);
      const food = isPrimary ? calculateBookingFoodAmount(b) : 0;
      const exp = isPrimary ? calculateBookingExpenditure(b) : 0;
      const rooms = getBookingRoomsCount(b);
      const gross = rent + food;
      // Free rooms with 0 rent and 0 food must never go negative
      const net = gross <= 0 ? 0 : Math.max(0, gross - exp);

      monthMap[monthKey].bookings.push(b);
      monthMap[monthKey].totalRent += rent;
      monthMap[monthKey].totalFood += food;
      monthMap[monthKey].totalExpenditure += exp;
      monthMap[monthKey].roomsCount += rooms;
    });

    // Convert to sorted array (latest month first)
    const list = Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // Compute consistent monthly net grand total: Math.max(0, (totalRent + totalFood) - totalExpenditure)
    // and sort bookings within each month descending by date
    list.forEach((m) => {
      const monthGross = m.totalRent + m.totalFood;
      m.grandTotal = Math.max(0, monthGross - m.totalExpenditure);
      m.bookings.sort((a, b) => b.booking_date.localeCompare(a.booking_date));
    });

    return list;
  }, [bookings, isPrimaryForStayCharges]);

  // Overall KPIs
  const overallStats = useMemo(() => {
    let grandTotalRent = 0;
    let grandTotalFood = 0;
    let grandTotalExpenditure = 0;
    let grandTotalRevenue = 0;
    let totalBookingsCount = 0;
    let totalRoomsCount = 0;
    let peakRent = 0;
    let peakMonthKey = '';
    let currentMonthRent = 0;
    let currentMonthFood = 0;
    let currentMonthExpenditure = 0;
    let currentMonthGrandTotal = 0;
    let lastMonthRent = 0;
    let lastMonthFood = 0;
    let lastMonthExpenditure = 0;
    let lastMonthGrandTotal = 0;
    let currentMonthCount = 0;
    let lastMonthCount = 0;

    monthlyData.forEach((m) => {
      grandTotalRent += m.totalRent;
      grandTotalFood += m.totalFood;
      grandTotalExpenditure += m.totalExpenditure;
      grandTotalRevenue += m.grandTotal;
      totalBookingsCount += m.bookings.length;
      totalRoomsCount += m.roomsCount;

      if (m.grandTotal > peakRent) {
        peakRent = m.grandTotal;
        peakMonthKey = m.monthKey;
      }

      if (m.monthKey === currentMonthKey) {
        currentMonthRent = m.totalRent;
        currentMonthFood = m.totalFood;
        currentMonthExpenditure = m.totalExpenditure;
        currentMonthGrandTotal = m.grandTotal;
        currentMonthCount = m.bookings.length;
      } else if (m.monthKey === lastMonthKey) {
        lastMonthRent = m.totalRent;
        lastMonthFood = m.totalFood;
        lastMonthExpenditure = m.totalExpenditure;
        lastMonthGrandTotal = m.grandTotal;
        lastMonthCount = m.bookings.length;
      }
    });

    return {
      grandTotal: grandTotalRevenue,
      grandTotalRent,
      grandTotalFood,
      grandTotalExpenditure,
      grandTotalRevenue,
      totalBookingsCount,
      totalRoomsCount,
      peakRent,
      peakMonthKey,
      currentMonthRent,
      currentMonthFood,
      currentMonthExpenditure,
      currentMonthGrandTotal,
      lastMonthRent,
      lastMonthFood,
      lastMonthExpenditure,
      lastMonthGrandTotal,
      currentMonthCount,
      lastMonthCount,
      activeMonthsCount: monthlyData.length,
    };
  }, [monthlyData, currentMonthKey, lastMonthKey]);

  // Toggle month expansion
  const toggleExpand = (monthKey: string) => {
    setExpandedMonth((prev) => (prev === monthKey ? null : monthKey));
  };

  // Export to Excel (Dynamically loaded on-demand)
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Sheet 1: Monthly Summary
    const summaryRows = monthlyData.map((m) => {
      const monthLabel =
        language === 'hi' ? formatMonthKey(m.monthKey, 'hi') : formatMonthKey(m.monthKey, 'en');
      return language === 'hi'
        ? {
            'माह / वर्ष': monthLabel,
            'माह कोड': m.monthKey,
            'कुल आवंटन संख्या': m.bookings.length,
            'कुल कक्ष दिवस': m.roomsCount,
            'कमरा किराया संग्रह (₹)': m.totalRent,
            'भोजन संग्रह (₹)': m.totalFood,
            'व्यय / खर्च (₹)': m.totalExpenditure,
            'कुल शुद्ध संग्रह (₹)': m.grandTotal,
            'औसत संग्रह प्रति आवंटन (₹)':
              m.bookings.length > 0 ? Math.round(m.grandTotal / m.bookings.length) : 0,
          }
        : {
            'Month / Year': monthLabel,
            'Month Code': m.monthKey,
            'Total Bookings': m.bookings.length,
            'Room Days': m.roomsCount,
            'Room Rent Collection (₹)': m.totalRent,
            'Food Collection (₹)': m.totalFood,
            'Expenditure (₹)': m.totalExpenditure,
            'Net Collection (₹)': m.grandTotal,
            'Avg Collection per Booking (₹)':
              m.bookings.length > 0 ? Math.round(m.grandTotal / m.bookings.length) : 0,
          };
    });

    // Add Grand Total row to summary
    if (language === 'hi') {
      summaryRows.push({
        'माह / वर्ष': 'कुल महायोग',
        'माह कोड': '-',
        'कुल आवंटन संख्या': overallStats.totalBookingsCount,
        'कुल कक्ष दिवस': overallStats.totalRoomsCount,
        'कमरा किराया संग्रह (₹)': overallStats.grandTotalRent,
        'भोजन संग्रह (₹)': overallStats.grandTotalFood,
        'व्यय / खर्च (₹)': overallStats.grandTotalExpenditure,
        'कुल शुद्ध संग्रह (₹)': overallStats.grandTotalRevenue,
        'औसत संग्रह प्रति आवंटन (₹)':
          overallStats.totalBookingsCount > 0
            ? Math.round(overallStats.grandTotalRevenue / overallStats.totalBookingsCount)
            : 0,
      });
    } else {
      summaryRows.push({
        'Month / Year': 'GRAND TOTAL',
        'Month Code': '-',
        'Total Bookings': overallStats.totalBookingsCount,
        'Room Days': overallStats.totalRoomsCount,
        'Room Rent Collection (₹)': overallStats.grandTotalRent,
        'Food Collection (₹)': overallStats.grandTotalFood,
        'Expenditure (₹)': overallStats.grandTotalExpenditure,
        'Net Collection (₹)': overallStats.grandTotalRevenue,
        'Avg Collection per Booking (₹)':
          overallStats.totalBookingsCount > 0
            ? Math.round(overallStats.grandTotalRevenue / overallStats.totalBookingsCount)
            : 0,
      });
    }

    const sanitizedSummaryRows = summaryRows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, sanitizeExcelCell(v)]))
    );
    const summaryWs = XLSX.utils.json_to_sheet(sanitizedSummaryRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, language === 'hi' ? 'माह-वार सारांश' : 'Monthly Summary');

    // Sheet 2: All Active Bookings Details
    const detailRows: any[] = [];
    monthlyData.forEach((m) => {
      const monthLabel = formatMonthKey(m.monthKey, language === 'hi' ? 'hi' : 'en');
      m.bookings.forEach((b) => {
        const dispatchNo = b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';
        const suits = getBookingSuitsList(b).join(', ');
        const isPrimary = isPrimaryForStayCharges(b);
        const rent = calculateBookingRent(b);
        const food = isPrimary ? calculateBookingFoodAmount(b) : 0;
        const exp = isPrimary ? calculateBookingExpenditure(b) : 0;
        const gross = rent + food;
        const net = gross <= 0 ? 0 : Math.max(0, gross - exp);
        const payMode = b.payment_mode || extractPaymentModeFromNotes(b.notes) || 'CASH';

        if (language === 'hi') {
          detailRows.push({
            'माह': monthLabel,
            'दिनांक': b.booking_date,
            'पत्र क्रमांक': dispatchNo,
            'अतिथि/अधिकारी का नाम': b.guest_name,
            'पदनाम/संदर्भ': b.reference || '-',
            'आवंटित सूट': suits,
            'कमरे': getBookingRoomsCount(b),
            'कमरा किराया (₹)': rent,
            'भोजन संग्रह (₹)': food,
            'व्यय / खर्च (₹)': exp,
            'कुल शुद्ध संग्रह (₹)': net,
            'भुगतान माध्यम': payMode === 'CASH' ? 'नकद' : payMode,
            'स्थिति': b.status === 'CHECKED_IN' ? 'उपस्थित' : (b.status === 'CHECKED_OUT' ? 'चेक-आउट' : (b.status === 'CANCELLED' ? 'निरस्त' : 'आरक्षित')),
          });
        } else {
          detailRows.push({
            'Month': monthLabel,
            'Stay Date': b.booking_date,
            'Dispatch No': dispatchNo,
            'Officer / Guest Name': b.guest_name,
            'Reference / Designation': b.reference || '-',
            'Allocated Suits': suits,
            'Room Count': getBookingRoomsCount(b),
            'Room Rent (₹)': rent,
            'Food Amount (₹)': food,
            'Expenditure (₹)': exp,
            'Net Collection (₹)': net,
            'Payment Mode': payMode,
            'Status': b.status || 'CONFIRMED',
          });
        }
      });
    });

    const sanitizedDetailRows = detailRows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, sanitizeExcelCell(v)]))
    );
    const detailWs = XLSX.utils.json_to_sheet(sanitizedDetailRows);
    XLSX.utils.book_append_sheet(wb, detailWs, language === 'hi' ? 'विस्तृत आवंटन विवरण' : 'Allotment Details');

    // Write file
    XLSX.writeFile(
      wb,
      `POGH_Ayodhya_Monthly_Collection_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Dedicated Print Handler: prints either a specific month or all months
  const handlePrint = (targetMonth: string = selectedPrintMonth) => {
    setActivePrintingMonth(targetMonth);
    // Allow state to render into printRef before capturing iframe
    setTimeout(() => {
      if (printRef.current) {
        const title =
          targetMonth === 'ALL'
            ? 'POGH_Ayodhya_All_Months_Collection_Statement'
            : `POGH_Ayodhya_${targetMonth}_Collection_Statement`;
        printDocumentDirectly(printRef.current, title, true);
      } else {
        window.print();
      }
    }, 60);
  };

  // Filtered list if search query entered (memoized with deferredSearch for 60fps typing)
  const filteredMonths = useMemo(() => {
    if (!deferredSearch.trim()) return monthlyData;
    const q = deferredSearch.toLowerCase().trim();
    return monthlyData.filter((m) => {
      const monthLabel = formatMonthKey(m.monthKey, 'hi').toLowerCase();
      const monthLabelEn = formatMonthKey(m.monthKey, 'en').toLowerCase();
      if (monthLabel.includes(q) || monthLabelEn.includes(q) || m.monthKey.includes(q)) return true;

      return m.bookings.some(
        (b) =>
          (b.guest_name || '').toLowerCase().includes(q) ||
          (b.reference || '').toLowerCase().includes(q) ||
          (b.dispatch_no || '').includes(q)
      );
    });
  }, [monthlyData, deferredSearch]);

  // Current month being printed for single-month print mode
  const singleMonthPrintData = useMemo(() => {
    if (activePrintingMonth === 'ALL') return null;
    return monthlyData.find((m) => m.monthKey === activePrintingMonth) || null;
  }, [monthlyData, activePrintingMonth]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Banner / Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 p-2.5 shadow-sm flex items-center justify-center shrink-0">
            <BarChart3 className="w-full h-full text-slate-950 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {language === 'hi' ? 'माह-वार किराया संग्रह आख्या' : 'Monthly Revenue & Collection Record'}
              </h2>
              <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                POGH AYODHYA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'hi'
                ? 'पुलिस कार्यालय, जनपद अयोध्या • सम्पूर्ण माह-वार वित्तीय लेखा-जोखा'
                : 'Police Office Ayodhya • Complete month-by-month financial statement'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Excel Download & Month Specific Print Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            onClick={handleExportExcel}
            className="h-9 flex items-center justify-center gap-1.5 px-3.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer"
            title={language === 'hi' ? 'सम्पूर्ण एक्सेल आख्या डाउनलोड करें' : 'Download Full Excel Statement'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'एक्सेल डाउनलोड' : 'Export Excel'}</span>
          </button>

          {/* Month Print Selector Dropdown & Button */}
          <div className="h-9 flex items-center gap-1 bg-slate-100 px-1 rounded-xl border border-slate-200">
            <select
              value={selectedPrintMonth}
              onChange={(e) => setSelectedPrintMonth(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 py-1 px-2 focus:outline-hidden cursor-pointer"
              title={language === 'hi' ? 'प्रिंट हेतु माह चुनें' : 'Select Month to Print'}
            >
              <option value="ALL">{language === 'hi' ? 'समस्त माह' : 'All Months'}</option>
              {monthlyData.map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  {formatMonthKey(m.monthKey, language === 'hi' ? 'hi' : 'en')}
                </option>
              ))}
            </select>

            <button
              onClick={() => handlePrint(selectedPrintMonth)}
              className="h-7 flex items-center justify-center gap-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer"
              title={language === 'hi' ? 'चयनित माह की स्टेटमेंट प्रिंट करें' : 'Print Statement for Selected Month'}
            >
              <Printer className="w-3 h-3 text-amber-400" />
              <span>{language === 'hi' ? 'प्रिंट' : 'Print'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* 1. Room Rent Total Tile */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'hi' ? 'कमरा किराया संग्रह' : 'Room Rent Collection'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              ₹{overallStats.grandTotalRent.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {overallStats.totalRoomsCount} {language === 'hi' ? 'कक्ष दिवस' : 'Room days'} • {overallStats.totalBookingsCount} {language === 'hi' ? 'आवंटन' : 'Allotments'}
          </p>
        </div>

        {/* 2. Food Collection Tile */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'hi' ? 'भोजन संग्रह' : 'Food Collection'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              ₹{overallStats.grandTotalFood.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {language === 'hi' ? 'मेस / खान-पान कुल संग्रह' : 'Total Mess & Food collection'}
          </p>
        </div>

        {/* 3. Total Expenditure Tile */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'hi' ? 'व्यय / खर्च कटौती' : 'Total Expenditure'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-rose-700 font-mono">
              ₹{overallStats.grandTotalExpenditure.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {language === 'hi' ? 'कलेक्शन से घटाई गई धनराशि' : 'Deducted from gross collection'}
          </p>
        </div>

        {/* 4. Grand Total Revenue Tile */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              {language === 'hi' ? 'सर्वकुल शुद्ध संग्रह' : 'Net Grand Total'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
              ₹{overallStats.grandTotalRevenue.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {language === 'hi' ? 'शुद्ध शासकीय राजस्व प्राप्ति' : 'Net official revenue recorded'}
          </p>
        </div>

      </div>

      {/* Search Bar & Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'hi'
                ? 'माह, अधिकारी के नाम या पत्र संख्या से खोजें...'
                : 'Search by month, officer name or dispatch no...'
            }
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:bg-white transition"
          />
        </div>

        <span className="text-xs text-slate-500 font-semibold self-end sm:self-center">
          {filteredMonths.length} {language === 'hi' ? 'माह प्रदर्शित' : 'Months displayed'}
        </span>
      </div>

      {/* Month-Wise Breakdown List (On-Screen Interactive Accordions) */}
      <div className="space-y-3.5">
        {filteredMonths.map((m) => {
          const isExpanded = expandedMonth === m.monthKey;
          const isCurrent = m.monthKey === currentMonthKey;
          const isLast = m.monthKey === lastMonthKey;
          const monthHindi = formatMonthKey(m.monthKey, 'hi');
          const monthEnglish = formatMonthKey(m.monthKey, 'en');

          // Percentage of peak rent
          const peakPct =
            overallStats.peakRent > 0
              ? Math.round((m.totalRent / overallStats.peakRent) * 100)
              : 0;

          return (
            <div
              key={m.monthKey}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                isCurrent
                  ? 'border-amber-400/80 ring-1 ring-amber-400/30'
                  : isLast
                  ? 'border-purple-300'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Row Summary Bar */}
              <div
                onClick={() => toggleExpand(m.monthKey)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 cursor-pointer select-none hover:bg-slate-50/80 transition"
              >
                {/* Left: Month Name & Badges */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                      isCurrent
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : isLast
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {m.monthKey.slice(5)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                        {language === 'hi' ? monthHindi : monthEnglish}
                      </h3>

                      {isCurrent && (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          {language === 'hi' ? 'चालू माह' : 'Current Month'}
                        </span>
                      )}

                      {isLast && (
                        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                          {language === 'hi' ? 'गत माह' : 'Last Month'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      {m.bookings.length}{' '}
                      {language === 'hi' ? 'आवंटन पत्र / बुकिंग्स' : 'Allotments'} •{' '}
                      {m.roomsCount} {language === 'hi' ? 'कक्ष दिवस' : 'Room Days'}
                    </p>
                  </div>
                </div>

                {/* Right: Rent & Progress & Actions (Print Specific Month + Expand Trigger) */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t border-slate-100 sm:border-0 shrink-0">
                  {/* Visual Bar Indicator */}
                  <div className="hidden md:flex flex-col items-end w-28">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <span>{peakPct}% {language === 'hi' ? 'चरम का' : 'of peak'}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCurrent
                            ? 'bg-amber-500'
                            : isLast
                            ? 'bg-purple-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${peakPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Revenue Amount */}
                  <div className="text-right">
                    <div className="text-lg sm:text-xl font-black text-slate-900">
                      ₹{m.grandTotal.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500 font-semibold">
                      {language === 'hi' ? 'कमरा' : 'Rent'}: ₹{m.totalRent.toLocaleString('en-IN')} • {language === 'hi' ? 'भोजन' : 'Food'}: ₹{m.totalFood.toLocaleString('en-IN')}
                      {m.totalExpenditure > 0 && (
                        <span className="text-rose-600 font-bold"> • {language === 'hi' ? 'खर्च' : 'Exp'}: -₹{m.totalExpenditure.toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  </div>

                  {/* Direct Print Button for THIS Specific Month */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrint(m.monthKey);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border border-slate-200 text-xs font-bold transition shadow-2xs active:scale-95"
                    title={language === 'hi' ? `${monthHindi} की आधिकारिक स्टेटमेंट प्रिंट करें` : `Print official statement for ${monthEnglish}`}
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden xs:inline sm:inline">{language === 'hi' ? 'प्रिंट' : 'Print'}</span>
                  </button>

                  {/* Expand Accordion Button */}
                  <button
                    type="button"
                    className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    aria-label="Expand Month Details"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expandable Allotment Letters Table for this Month */}
              {isExpanded && (
                <div className="border-t border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs sm:text-sm font-bold text-slate-800">
                      {language === 'hi'
                        ? `${monthHindi} के सभी आवंटन विवरण (${m.bookings.length}) • कुल संग्रह: ₹${m.grandTotal.toLocaleString('en-IN')}`
                        : `All Bookings for ${monthEnglish} (${m.bookings.length}) • Total: ₹${m.grandTotal.toLocaleString('en-IN')}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePrint(m.monthKey)}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>{language === 'hi' ? `केवल ${monthHindi} का विवरण प्रिंट करें` : `Print only ${monthEnglish}`}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold">
                          <th className="py-3 px-3.5 whitespace-nowrap">
                            {language === 'hi' ? 'दिनांक' : 'Date'}
                          </th>
                          <th className="py-3 px-2.5 whitespace-nowrap">
                            {language === 'hi' ? 'पत्र सं०' : 'Dispatch'}
                          </th>
                          <th className="py-3 px-3.5">
                            {language === 'hi' ? 'अतिथि / अधिकारी' : 'Officer / Guest'}
                          </th>
                          <th className="py-3 px-2.5 whitespace-nowrap">
                            {language === 'hi' ? 'आवंटित सूट' : 'Suits'}
                          </th>
                          <th className="py-3 px-2.5 text-right whitespace-nowrap">
                            {language === 'hi' ? 'कमरा किराया' : 'Room Rent'}
                          </th>
                          <th className="py-3 px-2.5 text-right whitespace-nowrap">
                            {language === 'hi' ? 'भोजन संग्रह' : 'Food'}
                          </th>
                          <th className="py-3 px-2.5 text-right whitespace-nowrap text-rose-700">
                            {language === 'hi' ? 'व्यय कटौती' : 'Expenditure'}
                          </th>
                          <th className="py-3 px-3 text-right whitespace-nowrap">
                            {language === 'hi' ? 'शुद्ध संग्रह' : 'Net Total'}
                          </th>
                          <th className="py-3 px-2.5 text-center whitespace-nowrap">
                            {language === 'hi' ? 'स्थिति' : 'Status'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {m.bookings.map((b) => {
                          const isPrimary = isPrimaryForStayCharges(b);
                          const rent = calculateBookingRent(b);
                          const food = isPrimary ? calculateBookingFoodAmount(b) : 0;
                          const exp = isPrimary ? calculateBookingExpenditure(b) : 0;
                          const gross = rent + food;
                          const net = gross <= 0 ? 0 : Math.max(0, gross - exp);
                          const suits = getBookingSuitsList(b).join(', ');
                          const dispatchNo =
                            b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';
                          const payMode = b.payment_mode || extractPaymentModeFromNotes(b.notes) || 'CASH';

                          return (
                            <tr
                              key={b.id}
                              onClick={() => onSelectBooking && onSelectBooking(b)}
                              className="hover:bg-amber-50/50 transition cursor-pointer group"
                            >
                              <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                <div>{b.booking_date}</div>
                                {isHourlyBooking(b) && (
                                  <div className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block">
                                    {b.check_in_time || '10:00'} - {b.check_out_time || '14:00'} ({b.stay_hours || 2}h)
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2.5 font-bold text-slate-600 whitespace-nowrap">
                                {dispatchNo !== '-' ? `#${dispatchNo}` : '-'}
                              </td>
                              <td className="py-3 px-3.5">
                                <div className="font-bold text-slate-900 group-hover:text-amber-900 transition">
                                  {b.guest_name}
                                </div>
                                {b.reference && (
                                  <div className="text-[11px] text-slate-500 truncate max-w-md">
                                    {b.reference}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2.5 font-medium text-slate-700 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200">
                                  {suits}
                                </span>
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                                ₹{rent.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono font-semibold text-blue-700 whitespace-nowrap">
                                {food > 0 ? `₹${food.toLocaleString('en-IN')}` : '-'}
                              </td>
                              <td className="py-3 px-2.5 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">
                                {exp > 0 ? `-₹${exp.toLocaleString('en-IN')}` : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-black font-mono text-slate-900 whitespace-nowrap">
                                ₹{net.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-2.5 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <span>{language === 'hi' ? (b.status === 'CHECKED_IN' ? 'उपस्थित' : (b.status === 'CHECKED_OUT' ? 'चेक-आउट' : (b.status === 'CANCELLED' ? 'निरस्त' : 'आरक्षित'))) : (b.status || 'CONFIRMED')}</span>
                                  <span className="text-[9px] text-slate-500">({payMode === 'CASH' ? (language === 'hi' ? 'नकद' : 'CASH') : payMode})</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredMonths.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">{language === 'hi' ? 'कोई रिकॉर्ड नहीं मिला' : 'No records found'}</p>
            <p className="text-xs text-slate-500 mt-1">{language === 'hi' ? 'खोज शब्द बदल कर पुनः प्रयास करें' : 'Try adjusting your search criteria'}</p>
          </div>
        )}
      </div>

      {/* Page Footer Note */}
      <div className="text-center text-xs text-slate-400 py-3">
        {language === 'hi' ? 'पुलिस ऑफिसर्स गेस्ट हाउस (POGH), अयोध्या • सम्पूर्ण संकलित किराया:' : 'Police Officers Guest House (POGH), Ayodhya • Total Collected Rent:'} ₹{overallStats.grandTotal.toLocaleString('en-IN')}
      </div>

      {/* ========================================================================= */}
      {/* DYNAMIC PRINTABLE STATEMENT CONTAINER (Captured by printDocumentDirectly) */}
      {/* Redesigned: 100% Ink-Saver, Pure White, Official UP Police Register Format */}
      {/* ========================================================================= */}
      <div ref={printRef} className="hidden">
        <div style={{ padding: '16px 20px', background: '#FFFFFF', color: '#000000', fontFamily: `'Noto Sans Devanagari', 'Inter', sans-serif`, fontSize: '11px', lineHeight: 1.4 }}>
          
          {/* 1. Official Letterhead Header (Symmetrical: Logos at Extreme Sides, Heading in Dead Center) */}
          <div style={{ borderBottom: '2px solid #000000', paddingBottom: '10px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
              {/* Left Logo (Extreme Left) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/up_police_logo.png"
                alt="UP Police"
                style={{ width: '50px', height: '50px', objectFit: 'contain', display: 'block', flexShrink: 0 }}
              />

              {/* Center Heading (Exactly Centered) */}
              <div style={{ textAlign: 'center', flex: 1, padding: '0 16px' }}>
                <div style={{ fontSize: '17px', fontWeight: 900, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>
                  कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#000000', marginTop: '2px', lineHeight: 1.3 }}>
                  पुलिस ऑफिसर्स गेस्ट हाउस (POGH), सिविल लाइंस, अयोध्या (उ0प्र0)
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#000000', marginTop: '2px', textDecoration: 'underline' }}>
                  {singleMonthPrintData
                    ? `मासिक किराया संग्रह, मेस एवं व्यय विवरण आख्या — माह: ${formatMonthKey(singleMonthPrintData.monthKey, 'hi')}`
                    : 'माह-वार किराया संग्रह, मेस एवं व्यय विवरण आख्या (समस्त सत्र)'}
                </div>
              </div>

              {/* Right Logo (Extreme Right) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/up_police_logo.png"
                alt="UP Police"
                style={{ width: '50px', height: '50px', objectFit: 'contain', display: 'block', flexShrink: 0 }}
              />
            </div>

            {/* Sub-bar: Reference & Dates */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '10px', fontWeight: 600, color: '#000000' }}>
              <span>
                विवरण माह: <strong>{singleMonthPrintData ? `${formatMonthKey(singleMonthPrintData.monthKey, 'hi')} (${singleMonthPrintData.monthKey})` : 'समस्त सक्रिय आवंटन'}</strong>
              </span>
              <span>पत्रांक: POGH/लेखा-{singleMonthPrintData ? singleMonthPrintData.monthKey : 'समस्त'}</span>
              <span>आख्या मुद्रण दिनांक: {formatToHindiDate(new Date())}</span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* CASE A: SINGLE MONTH SPECIFIC PRINT (विशिष्ट माह आख्या)              */}
          {/* =================================================================== */}
          {singleMonthPrintData ? (
            <div>
              {/* Ink-Saver Official Summary Strip (Zero background fill, crisp black border) */}
              <div style={{ border: '1.5px solid #000000', padding: '6px 10px', marginBottom: '10px', background: '#FFFFFF', fontSize: '10.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>कुल आवंटन:</strong> {singleMonthPrintData.bookings.length} पत्र ({singleMonthPrintData.roomsCount} कक्ष दिवस)</span>
                <span>|</span>
                <span><strong>कमरा किराया:</strong> ₹{singleMonthPrintData.totalRent.toLocaleString('en-IN')}</span>
                <span>|</span>
                <span><strong>भोजन संग्रह:</strong> ₹{singleMonthPrintData.totalFood.toLocaleString('en-IN')}</span>
                <span>|</span>
                <span><strong>कुल व्यय/खर्च:</strong> ₹{singleMonthPrintData.totalExpenditure.toLocaleString('en-IN')}</span>
                <span>|</span>
                <span style={{ fontSize: '11px', fontWeight: 900 }}><strong>शुद्ध राजकीय संग्रह: ₹{singleMonthPrintData.grandTotal.toLocaleString('en-IN')}</strong></span>
              </div>

              {/* Single Month Allotment Table */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#000000', marginBottom: '4px', textTransform: 'uppercase' }}>
                  दैनिक आवंटन, कमरा किराया, मेस भोजन एवं व्यय विवरण तालिका:
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', background: '#FFFFFF' }}>
                  <thead>
                    <tr style={{ background: '#FFFFFF', color: '#000000' }}>
                      <th style={{ padding: '4px 3px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderLeft: '1px solid #000000', borderRight: '1px solid #000000', width: '28px', textAlign: 'center', fontWeight: 800 }}>क्र०</th>
                      <th style={{ padding: '4px 4px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '62px', textAlign: 'center', fontWeight: 800 }}>दिनांक</th>
                      <th style={{ padding: '4px 8px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', textAlign: 'left', fontWeight: 800 }}>अधिकारी का नाम एवं संदर्भ/पदनाम</th>
                      <th style={{ padding: '4px 4px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '70px', textAlign: 'center', fontWeight: 800 }}>आवंटित सूट</th>
                      <th style={{ padding: '4px 5px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '68px', textAlign: 'right', fontWeight: 800 }}>कमरा किराया (₹)</th>
                      <th style={{ padding: '4px 5px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '60px', textAlign: 'right', fontWeight: 800 }}>भोजन (₹)</th>
                      <th style={{ padding: '4px 5px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '60px', textAlign: 'right', fontWeight: 800 }}>व्यय (₹)</th>
                      <th style={{ padding: '4px 6px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '72px', textAlign: 'right', fontWeight: 800 }}>शुद्ध संग्रह (₹)</th>
                      <th style={{ padding: '4px 4px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '56px', textAlign: 'center', fontWeight: 800 }}>माध्यम</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleMonthPrintData.bookings.map((b, idx) => {
                      const isPrimary = isPrimaryForStayCharges(b);
                      const rent = calculateBookingRent(b);
                      const food = isPrimary ? calculateBookingFoodAmount(b) : 0;
                      const exp = isPrimary ? calculateBookingExpenditure(b) : 0;
                      const gross = rent + food;
                      const net = gross <= 0 ? 0 : Math.max(0, gross - exp);
                      const suits = getBookingSuitsList(b).join(', ');
                      const rawPayMode = (b.payment_mode || extractPaymentModeFromNotes(b.notes) || 'CASH').toUpperCase();
                      const payModeHindi = rawPayMode === 'ONLINE' || rawPayMode === 'UPI' ? 'ऑनलाइन' : rawPayMode === 'CHEQUE' ? 'चेक' : 'नकद';

                      // Compact date format: DD/MM/YY
                      const dateParts = (b.booking_date || '').split('-');
                      const shortDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}` : b.booking_date;

                      return (
                        <tr key={`print-single-${b.id}`} style={{ background: '#FFFFFF' }}>
                          <td style={{ padding: '3.5px 3px', border: '1px solid #000000', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '3.5px 4px', border: '1px solid #000000', textAlign: 'center', whiteSpace: 'nowrap' }}>{shortDate}</td>
                          <td style={{ padding: '3.5px 8px', border: '1px solid #000000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ fontWeight: 700, color: '#000000' }}>{b.guest_name}</span>
                            {b.reference && <span style={{ color: '#334155', fontWeight: 500 }}> ({b.reference})</span>}
                          </td>
                          <td style={{ padding: '3.5px 4px', border: '1px solid #000000', textAlign: 'center', whiteSpace: 'nowrap' }}>{suits}</td>
                          <td style={{ padding: '3.5px 5px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>₹{rent.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '3.5px 5px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{food > 0 ? `₹${food.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '3.5px 5px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{exp > 0 ? `-₹${exp.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '3.5px 6px', border: '1px solid #000000', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>₹{net.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '3.5px 4px', border: '1px solid #000000', textAlign: 'center', fontSize: '9px', whiteSpace: 'nowrap' }}>
                            {payModeHindi}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Official Total Row (Double bottom border, bold black text) */}
                    <tr style={{ background: '#FFFFFF', fontWeight: 900, fontSize: '10.5px' }}>
                      <td colSpan={3} style={{ padding: '5px 8px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderLeft: '1px solid #000000', borderRight: '1px solid #000000', textAlign: 'center' }}>
                        कुल योग (TOTAL COLLECTION — {formatMonthKey(singleMonthPrintData.monthKey, 'hi')})
                      </td>
                      <td style={{ padding: '5px 4px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'center' }}>
                        {singleMonthPrintData.roomsCount} कक्ष
                      </td>
                      <td style={{ padding: '5px 5px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right', color: '#000000' }}>
                        ₹{singleMonthPrintData.totalRent.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '5px 5px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right', color: '#000000' }}>
                        ₹{singleMonthPrintData.totalFood.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '5px 5px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right', color: '#000000' }}>
                        -₹{singleMonthPrintData.totalExpenditure.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '5px 6px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right', color: '#000000' }}>
                        ₹{singleMonthPrintData.grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '5px 4px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'center' }}>
                        {singleMonthPrintData.bookings.length} पत्र
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* =================================================================== */
            /* CASE B: ALL MONTHS STATEMENT (समस्त माह आख्या)                     */
            /* =================================================================== */
            <div>
              {/* Ink-Saver Official Summary Strip */}
              <div style={{ border: '1.5px solid #000000', padding: '6px 10px', marginBottom: '10px', background: '#FFFFFF', fontSize: '10.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>कुल आवंटन:</strong> {overallStats.totalBookingsCount} पत्र ({overallStats.totalRoomsCount} कक्ष दिवस)</span>
                <span>|</span>
                <span><strong>कमरा किराया:</strong> ₹{overallStats.grandTotalRent.toLocaleString('en-IN')}</span>
                <span>|</span>
                <span><strong>भोजन संग्रह:</strong> ₹{overallStats.grandTotalFood.toLocaleString('en-IN')}</span>
                <span>|</span>
                <span><strong>कुल व्यय/खर्च:</strong> ₹{overallStats.grandTotalExpenditure.toLocaleString('en-IN')}</span>
                <span>|</span>
                <span style={{ fontSize: '11px', fontWeight: 900 }}><strong>सर्वकुल शुद्ध संग्रह: ₹{overallStats.grandTotalRevenue.toLocaleString('en-IN')}</strong></span>
              </div>

              {/* भाग 1: माह-वार राजस्व संग्रह सारांश तालिका */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#000000', marginBottom: '4px', textTransform: 'uppercase' }}>
                  भाग 1: माह-वार किराया, भोजन एवं व्यय सारांश तालिका:
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', background: '#FFFFFF' }}>
                  <thead>
                    <tr style={{ background: '#FFFFFF', color: '#000000' }}>
                      <th style={{ padding: '4px 4px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderLeft: '1px solid #000000', borderRight: '1px solid #000000', width: '30px', textAlign: 'center', fontWeight: 800 }}>क्र०</th>
                      <th style={{ padding: '4px 6px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', textAlign: 'left', fontWeight: 800 }}>माह एवं वर्ष (Month & Year)</th>
                      <th style={{ padding: '4px 4px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '55px', textAlign: 'center', fontWeight: 800 }}>कोड</th>
                      <th style={{ padding: '4px 4px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '60px', textAlign: 'center', fontWeight: 800 }}>आवंटन पत्र</th>
                      <th style={{ padding: '4px 4px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '55px', textAlign: 'center', fontWeight: 800 }}>कक्ष दिवस</th>
                      <th style={{ padding: '4px 6px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '75px', textAlign: 'right', fontWeight: 800 }}>कमरा किराया (₹)</th>
                      <th style={{ padding: '4px 6px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '70px', textAlign: 'right', fontWeight: 800 }}>भोजन संग्रह (₹)</th>
                      <th style={{ padding: '4px 6px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '70px', textAlign: 'right', fontWeight: 800 }}>व्यय / खर्च (₹)</th>
                      <th style={{ padding: '4px 8px', borderTop: '2px solid #000000', borderBottom: '2px solid #000000', borderRight: '1px solid #000000', width: '85px', textAlign: 'right', fontWeight: 800 }}>शुद्ध संग्रह (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, idx) => {
                      const isCurrent = m.monthKey === currentMonthKey;

                      return (
                        <tr key={m.monthKey} style={{ background: '#FFFFFF' }}>
                          <td style={{ padding: '4px 4px', border: '1px solid #000000', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '4px 6px', border: '1px solid #000000', fontWeight: 700 }}>
                            {formatMonthKey(m.monthKey, 'hi')}
                            {isCurrent && <span style={{ marginLeft: '6px', fontSize: '8.5px', fontWeight: 600 }}>[चालू माह]</span>}
                          </td>
                          <td style={{ padding: '4px 4px', border: '1px solid #000000', textAlign: 'center' }}>{m.monthKey}</td>
                          <td style={{ padding: '4px 4px', border: '1px solid #000000', textAlign: 'center', fontWeight: 700 }}>{m.bookings.length}</td>
                          <td style={{ padding: '4px 4px', border: '1px solid #000000', textAlign: 'center' }}>{m.roomsCount}</td>
                          <td style={{ padding: '4px 6px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600 }}>₹{m.totalRent.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '4px 6px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600 }}>{m.totalFood > 0 ? `₹${m.totalFood.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '4px 6px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600 }}>{m.totalExpenditure > 0 ? `-₹${m.totalExpenditure.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '4px 8px', border: '1px solid #000000', textAlign: 'right', fontWeight: 800 }}>₹{m.grandTotal.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}

                    {/* Grand Total Row */}
                    <tr style={{ background: '#FFFFFF', fontWeight: 900, fontSize: '10.5px' }}>
                      <td colSpan={3} style={{ padding: '5px 8px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderLeft: '1px solid #000000', borderRight: '1px solid #000000', textAlign: 'center' }}>कुल महायोग (GRAND TOTAL)</td>
                      <td style={{ padding: '5px 4px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'center' }}>{overallStats.totalBookingsCount}</td>
                      <td style={{ padding: '5px 4px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'center' }}>{overallStats.totalRoomsCount}</td>
                      <td style={{ padding: '5px 6px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right' }}>₹{overallStats.grandTotalRent.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '5px 6px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right' }}>₹{overallStats.grandTotalFood.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '5px 6px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right' }}>-₹{overallStats.grandTotalExpenditure.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '5px 8px', borderTop: '2px solid #000000', borderBottom: '3px double #000000', borderRight: '1px solid #000000', textAlign: 'right' }}>₹{overallStats.grandTotalRevenue.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* भाग 2: विस्तृत आवंटन एवं किराया विवरण तालिका */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#000000', marginBottom: '4px', textTransform: 'uppercase' }}>
                  भाग 2: विस्तृत आवंटन, कमरा किराया, भोजन एवं व्यय विवरण (माह-वार):
                </div>

                {monthlyData.map((m) => (
                  <div key={`print-detail-${m.monthKey}`} style={{ marginBottom: '12px' }}>
                    <div style={{ border: '1px solid #000000', padding: '3px 6px', fontWeight: 800, fontSize: '9.5px', display: 'flex', justifyContent: 'space-between', background: '#FFFFFF' }}>
                      <span>माह: {formatMonthKey(m.monthKey, 'hi')} ({m.bookings.length} आवंटन)</span>
                      <span>कमरा: ₹{m.totalRent.toLocaleString('en-IN')} • भोजन: ₹{m.totalFood.toLocaleString('en-IN')} • व्यय: ₹{m.totalExpenditure.toLocaleString('en-IN')} • <strong>शुद्ध कुल: ₹{m.grandTotal.toLocaleString('en-IN')}</strong></span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', background: '#FFFFFF' }}>
                      <thead>
                        <tr style={{ background: '#FFFFFF', color: '#000000' }}>
                          <th style={{ padding: '3px 3px', border: '1px solid #000000', width: '24px', textAlign: 'center' }}>क्र०</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000000', width: '58px' }}>दिनांक</th>
                          <th style={{ padding: '3px 6px', border: '1px solid #000000', textAlign: 'left' }}>अधिकारी का नाम एवं संदर्भ</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000000', width: '65px' }}>सूट</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000000', width: '60px', textAlign: 'right' }}>किराया (₹)</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000000', width: '55px', textAlign: 'right' }}>भोजन (₹)</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000000', width: '55px', textAlign: 'right' }}>व्यय (₹)</th>
                          <th style={{ padding: '3px 5px', border: '1px solid #000000', width: '65px', textAlign: 'right' }}>शुद्ध कुल (₹)</th>
                          <th style={{ padding: '3px 4px', border: '1px solid #000000', width: '50px', textAlign: 'center' }}>माध्यम</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.bookings.map((b, bIdx) => {
                          const isPrimary = isPrimaryForStayCharges(b);
                          const rent = calculateBookingRent(b);
                          const food = isPrimary ? calculateBookingFoodAmount(b) : 0;
                          const exp = isPrimary ? calculateBookingExpenditure(b) : 0;
                          const gross = rent + food;
                          const net = gross <= 0 ? 0 : Math.max(0, gross - exp);
                          const suits = getBookingSuitsList(b).join(', ');
                          const rawPayMode = (b.payment_mode || extractPaymentModeFromNotes(b.notes) || 'CASH').toUpperCase();
                          const payModeHindi = rawPayMode === 'ONLINE' || rawPayMode === 'UPI' ? 'ऑनलाइन' : rawPayMode === 'CHEQUE' ? 'चेक' : 'नकद';

                          const dateParts = (b.booking_date || '').split('-');
                          const shortDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(2)}` : b.booking_date;

                          return (
                            <tr key={`print-b-${b.id}`} style={{ background: '#FFFFFF' }}>
                              <td style={{ padding: '3px 3px', border: '1px solid #000000', textAlign: 'center' }}>{bIdx + 1}</td>
                              <td style={{ padding: '3px 4px', border: '1px solid #000000', whiteSpace: 'nowrap' }}>{shortDate}</td>
                              <td style={{ padding: '3px 6px', border: '1px solid #000000', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 700 }}>{b.guest_name}</span>
                                {b.reference && <span style={{ color: '#334155' }}> ({b.reference})</span>}
                              </td>
                              <td style={{ padding: '3px 4px', border: '1px solid #000000', whiteSpace: 'nowrap' }}>{suits}</td>
                              <td style={{ padding: '3px 4px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>₹{rent.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '3px 4px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{food > 0 ? `₹${food.toLocaleString('en-IN')}` : '-'}</td>
                              <td style={{ padding: '3px 4px', border: '1px solid #000000', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{exp > 0 ? `-₹${exp.toLocaleString('en-IN')}` : '-'}</td>
                              <td style={{ padding: '3px 5px', border: '1px solid #000000', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>₹{net.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '3px 4px', border: '1px solid #000000', textAlign: 'center', fontSize: '8.5px', whiteSpace: 'nowrap' }}>
                                {payModeHindi}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. आधिकारिक प्रमाणीकरण एवं प्रतिहस्ताक्षर ब्लॉक (For SSP Sir submission) */}
          <div style={{ marginTop: '28px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '10.5px', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: '220px' }}>
              <div style={{ height: '36px' }}></div>
              <div style={{ fontWeight: 800, color: '#000000' }}>( हस्ताक्षर केयरटेकर / प्रभारी )</div>
              <div style={{ color: '#000000', fontSize: '10px' }}>पुलिस ऑफिसर्स गेस्ट हाउस (POGH)</div>
              <div style={{ color: '#000000', fontSize: '9px' }}>सिविल लाइंस, जनपद अयोध्या (उ0प्र0)</div>
            </div>

            <div style={{ textAlign: 'center', width: '240px' }}>
              <div style={{ height: '36px' }}></div>
              <div style={{ fontWeight: 800, color: '#000000' }}>प्रतिहस्ताक्षरित / अनुमोदित</div>
              <div style={{ fontWeight: 800, color: '#000000', marginTop: '1px' }}>वरिष्ठ पुलिस अधीक्षक</div>
              <div style={{ color: '#000000', fontSize: '9.5px' }}>जनपद अयोध्या (उ0प्र0)</div>
            </div>
          </div>

          {/* Statement Verification Footer */}
          <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '8.5px', color: '#475569', borderTop: '1px solid #94A3B8', paddingTop: '4px' }}>
            यह विवरण कंप्यूटर आधारित पुलिस ऑफिसर्स गेस्ट हाउस (POGH) अयोध्या पोर्टल द्वारा मुद्रित आधिकारिक मासिक लेखा आख्या है।
          </div>

        </div>
      </div>

    </div>
  );
};
