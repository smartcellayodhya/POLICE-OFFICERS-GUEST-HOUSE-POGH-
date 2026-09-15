'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Booking } from '@/lib/types';
import { formatMonthKey, formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import {
  calculateBookingRent,
  getBookingRoomsCount,
  getBookingSuitsList,
  extractDispatchNoFromNotes,
  calculateBookingFoodAmount,
  calculateBookingTotalCollection,
  calculateBookingExpenditure,
  calculateBookingNetCollection,
  extractPaymentModeFromNotes,
} from '@/lib/bookingUtils';
import { useLanguage } from '@/lib/languageContext';
import { printDocumentDirectly } from '@/lib/pdfUtils';
import * as XLSX from 'xlsx';
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

      const rent = calculateBookingRent(b);
      const food = calculateBookingFoodAmount(b);
      const exp = calculateBookingExpenditure(b);
      const rooms = getBookingRoomsCount(b);
      const gross = rent + food;
      // Free rooms with 0 rent and 0 food must never go negative
      const net = gross <= 0 ? 0 : Math.max(0, gross - exp);

      monthMap[monthKey].bookings.push(b);
      monthMap[monthKey].totalRent += rent;
      monthMap[monthKey].totalFood += food;
      monthMap[monthKey].totalExpenditure += exp;
      monthMap[monthKey].grandTotal += net;
      monthMap[monthKey].roomsCount += rooms;
    });

    // Convert to sorted array (latest month first)
    const list = Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // Also sort bookings within each month descending by date
    list.forEach((m) => {
      m.bookings.sort((a, b) => b.booking_date.localeCompare(a.booking_date));
    });

    return list;
  }, [bookings]);

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

  // Export to Excel
  const handleExportExcel = () => {
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

    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, language === 'hi' ? 'माह-वार सारांश' : 'Monthly Summary');

    // Sheet 2: All Active Bookings Details
    const detailRows: any[] = [];
    monthlyData.forEach((m) => {
      const monthLabel = formatMonthKey(m.monthKey, language === 'hi' ? 'hi' : 'en');
      m.bookings.forEach((b) => {
        const dispatchNo = b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';
        const suits = getBookingSuitsList(b).join(', ');
        const rent = calculateBookingRent(b);
        const food = calculateBookingFoodAmount(b);
        const exp = calculateBookingExpenditure(b);
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

    const detailWs = XLSX.utils.json_to_sheet(detailRows);
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

  // Filtered list if search query entered
  const filteredMonths = monthlyData.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const monthLabel = formatMonthKey(m.monthKey, 'hi').toLowerCase();
    const monthLabelEn = formatMonthKey(m.monthKey, 'en').toLowerCase();
    if (monthLabel.includes(q) || monthLabelEn.includes(q) || m.monthKey.includes(q)) return true;

    return m.bookings.some(
      (b) =>
        b.guest_name.toLowerCase().includes(q) ||
        (b.reference || '').toLowerCase().includes(q) ||
        (b.dispatch_no || '').includes(q)
    );
  });

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
                    title={`${monthHindi} की आधिकारिक स्टेटमेंट प्रिंट करें`}
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
                          const rent = calculateBookingRent(b);
                          const food = calculateBookingFoodAmount(b);
                          const exp = calculateBookingExpenditure(b);
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
                                {b.booking_date}
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
      {/* Supports: Specific Selected Month OR All Months Comprehensive Statement   */}
      {/* ========================================================================= */}
      <div ref={printRef} className="hidden">
        <div style={{ padding: '24px 30px', background: '#FFFFFF', color: '#0F172A', fontFamily: `'Noto Sans Devanagari', 'Inter', sans-serif`, fontSize: '12px', lineHeight: 1.5 }}>
          
          {/* 1. Official Letterhead Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '14px', marginBottom: '16px' }}>
            {/* Top Centered Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px', textAlign: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/up_police_logo.png"
                alt="UP Police"
                style={{ width: '56px', height: '56px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            </div>

            {/* Office & Guest House Text Below Logo */}
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>
                कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
              </h1>
              <h2 style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: 700, color: '#B45309', lineHeight: 1.4 }}>
                पुलिस ऑफिसर्स गेस्ट हाउस (POGH), सिविल लाइंस, अयोध्या (उ0प्र0)
              </h2>
            </div>
            
            {/* Report Title Badge Box */}
            <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 16px', borderRadius: '6px', display: 'inline-block', marginTop: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', letterSpacing: '0.5px' }}>
                {singleMonthPrintData
                  ? `★ माह ${formatMonthKey(singleMonthPrintData.monthKey, 'hi')} - किराया संग्रह एवं आवंटन विवरण आख्या ★`
                  : '★ माह-वार किराया संग्रह एवं आवंटन विवरण आख्या ★'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: '#475569' }}>
              <span>
                {singleMonthPrintData
                  ? `विवरण माह: ${formatMonthKey(singleMonthPrintData.monthKey, 'hi')} (${singleMonthPrintData.monthKey})`
                  : 'सत्र / अवधि: समस्त सक्रिय आवंटन (अप्रैल 2026 से सितम्बर 2026)'}
              </span>
              <span>आख्या मुद्रण दिनांक: {formatToHindiDate(new Date())}</span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* CASE A: SINGLE MONTH SPECIFIC PRINT (जब विशिष्ट माह चुना गया हो)    */}
          {/* =================================================================== */}
          {singleMonthPrintData ? (
            <div>
              {/* Month KPI Summary Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 8px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>माह</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{formatMonthKey(singleMonthPrintData.monthKey, 'hi')}</div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '1px' }}>कोड: {singleMonthPrintData.monthKey}</div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 8px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>कुल आवंटन / दिवस</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{singleMonthPrintData.bookings.length} पत्र</div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '1px' }}>{singleMonthPrintData.roomsCount} कक्ष दिवस</div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 8px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#4338CA', textTransform: 'uppercase' }}>कमरा किराया संग्रह</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#312E81', marginTop: '2px' }}>₹{singleMonthPrintData.totalRent.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '1px' }}>कमरों का किराया</div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 8px', background: '#EFF6FF' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>भोजन संग्रह</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#1E3A8A', marginTop: '2px' }}>₹{singleMonthPrintData.totalFood.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '1px' }}>मेस / खान-पान बिल</div>
                </div>

                <div style={{ border: '1px solid #FECDD3', borderRadius: '6px', padding: '6px 8px', background: '#FFF1F2' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#BE123C', textTransform: 'uppercase' }}>कुल व्यय / खर्च</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#9F1239', marginTop: '2px' }}>₹{singleMonthPrintData.totalExpenditure.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#BE123C', marginTop: '1px' }}>खर्च कटौती</div>
                </div>

                <div style={{ border: '1px solid #FCD34D', borderRadius: '6px', padding: '6px 8px', background: '#FEF3C7' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>सर्वकुल शुद्ध संग्रह</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#78350F', marginTop: '2px' }}>₹{singleMonthPrintData.grandTotal.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#92400E', marginTop: '1px' }}>(किराया+भोजन)-खर्च</div>
                </div>
              </div>

              {/* Single Month Allotment Table */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', borderLeft: '4px solid #B45309', paddingLeft: '8px', marginBottom: '8px' }}>
                  आवंटन, कमरा किराया, भोजन एवं व्यय विवरण तालिका (Revenue, Mess & Expenditure Log)
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '26px', textAlign: 'center' }}>क्र०</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '65px', textAlign: 'center' }}>दिनांक</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '55px', textAlign: 'center' }}>पत्र सं०</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', textAlign: 'left' }}>अधिकारी का नाम एवं पदनाम</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '60px', textAlign: 'center' }}>आवंटित सूट</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '65px', textAlign: 'right' }}>कमरा किराया (₹)</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '60px', textAlign: 'right' }}>भोजन संग्रह (₹)</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '65px', textAlign: 'right' }}>व्यय / खर्च (₹)</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '70px', textAlign: 'right' }}>शुद्ध संग्रह (₹)</th>
                      <th style={{ padding: '5px 6px', border: '1px solid #0F172A', width: '65px', textAlign: 'center' }}>स्थिति / माध्यम</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleMonthPrintData.bookings.map((b, idx) => {
                      const rent = calculateBookingRent(b);
                      const food = calculateBookingFoodAmount(b);
                      const exp = calculateBookingExpenditure(b);
                      const gross = rent + food;
                      const net = gross <= 0 ? 0 : Math.max(0, gross - exp);
                      const suits = getBookingSuitsList(b).join(', ');
                      const dispatchNo = b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';
                      const payMode = b.payment_mode || extractPaymentModeFromNotes(b.notes) || 'CASH';

                      return (
                        <tr key={`print-single-${b.id}`} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 600 }}>{b.booking_date}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 600 }}>{dispatchNo !== '-' ? `#${dispatchNo}` : '-'}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{b.guest_name}</div>
                            {b.reference && <div style={{ fontSize: '9px', color: '#64748B' }}>{b.reference}</div>}
                          </td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 600 }}>{suits}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 600 }}>₹{rent.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 600, color: '#1E40AF' }}>{food > 0 ? `₹${food.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 600, color: '#BE123C' }}>{exp > 0 ? `-₹${exp.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 800 }}>₹{net.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '5px 6px', border: '1px solid #CBD5E1', textAlign: 'center', fontSize: '9px' }}>
                            <div>{b.status || 'CONFIRMED'}</div>
                            <div style={{ color: '#64748B' }}>({payMode})</div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Row */}
                    <tr style={{ background: '#E2E8F0', fontWeight: 800, fontSize: '11px' }}>
                      <td colSpan={4} style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'center' }}>
                        कुल योग (TOTAL COLLECTION - {formatMonthKey(singleMonthPrintData.monthKey, 'hi')})
                      </td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'center' }}>
                        {singleMonthPrintData.roomsCount} कक्ष दिवस
                      </td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#0F172A' }}>
                        ₹{singleMonthPrintData.totalRent.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#1E40AF' }}>
                        ₹{singleMonthPrintData.totalFood.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#BE123C' }}>
                        -₹{singleMonthPrintData.totalExpenditure.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#0F172A' }}>
                        ₹{singleMonthPrintData.grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'center' }}>
                        {singleMonthPrintData.bookings.length} आवंटन
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* =================================================================== */
            /* CASE B: ALL MONTHS STATEMENT (जब समस्त माह चुना गया हो)            */
            /* =================================================================== */
            <div>
              {/* Key Highlights / Summary Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '18px' }}>
                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 10px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>कमरा किराया संग्रह</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>₹{overallStats.grandTotalRent.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>{overallStats.totalRoomsCount} कक्ष दिवस • {overallStats.totalBookingsCount} पत्र</div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 10px', background: '#EFF6FF' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>कुल भोजन संग्रह</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1E3A8A', marginTop: '2px' }}>₹{overallStats.grandTotalFood.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>मेस / खान-पान कुल आय</div>
                </div>

                <div style={{ border: '1px solid #FECDD3', borderRadius: '6px', padding: '8px 10px', background: '#FFF1F2' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#BE123C', textTransform: 'uppercase' }}>कुल व्यय / खर्च</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#9F1239', marginTop: '2px' }}>₹{overallStats.grandTotalExpenditure.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#BE123C', marginTop: '2px' }}>खर्च कटौती</div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 10px', background: '#FEF3C7' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>सर्वकुल शुद्ध राजस्व</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#78350F', marginTop: '2px' }}>₹{overallStats.grandTotalRevenue.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#92400E', marginTop: '2px' }}>(किराया+भोजन)-खर्च</div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 10px', background: '#F8FAFC' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>चालू माह शुद्ध संग्रह</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>₹{overallStats.currentMonthGrandTotal.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>{overallStats.currentMonthCount} आवंटन पत्र</div>
                </div>
              </div>

              {/* भाग 1: माह-वार राजस्व संग्रह सारांश तालिका (Summary Table) */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', borderLeft: '4px solid #B45309', paddingLeft: '8px', marginBottom: '8px' }}>
                  भाग 1: माह-वार किराया, भोजन एवं व्यय सारांश तालिका (Monthly Revenue Summary)
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#0F172A', color: '#FFFFFF', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', width: '35px', textAlign: 'center' }}>क्र०</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A' }}>माह एवं वर्ष (Month & Year)</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', textAlign: 'center' }}>कोड</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', textAlign: 'center' }}>आवंटन संख्या</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', textAlign: 'center' }}>कक्ष दिवस</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', textAlign: 'right' }}>कमरा किराया (₹)</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', textAlign: 'right' }}>भोजन संग्रह (₹)</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', textAlign: 'right' }}>व्यय / खर्च (₹)</th>
                      <th style={{ padding: '6px 8px', border: '1px solid #0F172A', textAlign: 'right' }}>शुद्ध संग्रह (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, idx) => {
                      const isCurrent = m.monthKey === currentMonthKey;
                      const isLast = m.monthKey === lastMonthKey;

                      return (
                        <tr key={m.monthKey} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', fontWeight: 700 }}>
                            {formatMonthKey(m.monthKey, 'hi')}
                            {isCurrent && <span style={{ marginLeft: '6px', fontSize: '9px', background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: '3px', border: '1px solid #FCD34D' }}>चालू माह</span>}
                            {isLast && <span style={{ marginLeft: '6px', fontSize: '9px', background: '#F3E8FF', color: '#6B21A8', padding: '1px 5px', borderRadius: '3px', border: '1px solid #D8B4FE' }}>गत माह</span>}
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', color: '#64748B' }}>{m.monthKey}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 700 }}>{m.bookings.length}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'center' }}>{m.roomsCount}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 600 }}>₹{m.totalRent.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 600, color: '#1E40AF' }}>{m.totalFood > 0 ? `₹${m.totalFood.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 600, color: '#BE123C' }}>{m.totalExpenditure > 0 ? `-₹${m.totalExpenditure.toLocaleString('en-IN')}` : '-'}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 800 }}>₹{m.grandTotal.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}

                    {/* Grand Total Row */}
                    <tr style={{ background: '#E2E8F0', fontWeight: 800, fontSize: '11px' }}>
                      <td colSpan={3} style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'center' }}>कुल महायोग (GRAND TOTAL)</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'center' }}>{overallStats.totalBookingsCount}</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'center' }}>{overallStats.totalRoomsCount}</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#0F172A' }}>₹{overallStats.grandTotalRent.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#1E40AF' }}>₹{overallStats.grandTotalFood.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#BE123C' }}>-₹{overallStats.grandTotalExpenditure.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #94A3B8', textAlign: 'right', color: '#0F172A' }}>₹{overallStats.grandTotalRevenue.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* भाग 2: विस्तृत आवंटन एवं किराया विवरण तालिका (Detailed Allotments Record) */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', borderLeft: '4px solid #B45309', paddingLeft: '8px', marginBottom: '8px' }}>
                  भाग 2: विस्तृत आवंटन, कमरा किराया, भोजन एवं व्यय विवरण (Detailed Allotments & Collection Record)
                </div>

                {monthlyData.map((m) => (
                  <div key={`print-detail-${m.monthKey}`} style={{ marginBottom: '14px' }}>
                    <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '4px 8px', fontWeight: 700, fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>माह: {formatMonthKey(m.monthKey, 'hi')} ({m.bookings.length} आवंटन)</span>
                      <span>कमरा: ₹{m.totalRent.toLocaleString('en-IN')} • भोजन: ₹{m.totalFood.toLocaleString('en-IN')} • खर्च: ₹{m.totalExpenditure.toLocaleString('en-IN')} • <strong>शुद्ध कुल: ₹{m.grandTotal.toLocaleString('en-IN')}</strong></span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', color: '#334155', borderBottom: '1px solid #CBD5E1' }}>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '25px', textAlign: 'center' }}>क्र०</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '65px' }}>दिनांक</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '55px' }}>पत्र संख्या</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0' }}>अधिकारी का नाम एवं पदनाम</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '60px' }}>आवंटित सूट</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '65px', textAlign: 'right' }}>कमरा किराया (₹)</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '60px', textAlign: 'right' }}>भोजन (₹)</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '60px', textAlign: 'right' }}>व्यय / खर्च (₹)</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '65px', textAlign: 'right' }}>शुद्ध कुल (₹)</th>
                          <th style={{ padding: '4px 5px', border: '1px solid #E2E8F0', width: '65px', textAlign: 'center' }}>स्थिति / माध्यम</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.bookings.map((b, bIdx) => {
                          const rent = calculateBookingRent(b);
                          const food = calculateBookingFoodAmount(b);
                          const exp = calculateBookingExpenditure(b);
                          const gross = rent + food;
                          const net = gross <= 0 ? 0 : Math.max(0, gross - exp);
                          const suits = getBookingSuitsList(b).join(', ');
                          const dispatchNo = b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';
                          const payMode = b.payment_mode || extractPaymentModeFromNotes(b.notes) || 'CASH';

                          return (
                            <tr key={`print-b-${b.id}`} style={{ background: bIdx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', textAlign: 'center' }}>{bIdx + 1}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', fontWeight: 600 }}>{b.booking_date}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', fontWeight: 600 }}>{dispatchNo !== '-' ? `#${dispatchNo}` : '-'}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0' }}>
                                <span style={{ fontWeight: 700 }}>{b.guest_name}</span>
                                {b.reference && <span style={{ color: '#64748B', display: 'block', fontSize: '8px' }}>{b.reference}</span>}
                              </td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0' }}>{suits}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', textAlign: 'right', fontWeight: 600 }}>₹{rent.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', textAlign: 'right', fontWeight: 600, color: '#1E40AF' }}>{food > 0 ? `₹${food.toLocaleString('en-IN')}` : '-'}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', textAlign: 'right', fontWeight: 600, color: '#BE123C' }}>{exp > 0 ? `-₹${exp.toLocaleString('en-IN')}` : '-'}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', textAlign: 'right', fontWeight: 700 }}>₹{net.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '4px 5px', border: '1px solid #E2E8F0', textAlign: 'center', fontSize: '8px' }}>
                                <span>{b.status || 'CONFIRMED'}</span>
                                <span style={{ color: '#64748B', display: 'block' }}>({payMode})</span>
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

          {/* 5. प्रमाणीकरण एवं आधिकारिक हस्ताक्षर ब्लॉक */}
          <div style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px dashed #94A3B8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px' }}>
            <div style={{ textAlign: 'center', width: '220px' }}>
              <div style={{ height: '35px' }}></div>
              <div style={{ fontWeight: 800, color: '#0F172A' }}>हस्ताक्षर प्रभारी</div>
              <div style={{ color: '#475569' }}>पुलिस ऑफिसर्स गेस्ट हाउस (POGH)</div>
              <div style={{ color: '#64748B', fontSize: '10px' }}>जनपद अयोध्या (उ0प्र0)</div>
            </div>

            <div style={{ textAlign: 'center', width: '240px' }}>
              <div style={{ height: '35px' }}></div>
              <div style={{ fontWeight: 800, color: '#0F172A' }}>प्रतिहस्ताक्षरित / अनुमोदित</div>
              <div style={{ color: '#475569' }}>वरिष्ठ पुलिस अधीक्षक</div>
              <div style={{ color: '#64748B', fontSize: '10px' }}>जनपद अयोध्या (उ0प्र0)</div>
            </div>
          </div>

          {/* Statement Verification Footer */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '9px', color: '#94A3B8', borderTop: '1px solid #E2E8F0', paddingTop: '6px' }}>
            यह विवरण कंप्यूटर आधारित पुलिस ऑफिसर्स गेस्ट हाउस (POGH) अयोध्या पोर्टल द्वारा स्वतः उत्पन्न किया गया आधिकारिक विवरण है।
          </div>

        </div>
      </div>

    </div>
  );
};
