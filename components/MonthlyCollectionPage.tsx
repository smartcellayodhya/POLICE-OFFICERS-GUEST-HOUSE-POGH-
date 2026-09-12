'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '@/lib/types';
import { formatMonthKey } from '@/lib/dateUtils';
import {
  calculateBookingRent,
  getBookingRoomsCount,
  getBookingSuitsList,
  extractDispatchNoFromNotes,
} from '@/lib/bookingUtils';
import { useLanguage } from '@/lib/languageContext';
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
  History,
  FileText,
  Award,
  CheckCircle2,
  BarChart3,
  CalendarCheck,
  BedDouble,
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
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
          roomsCount: 0,
        };
      }

      const rent = calculateBookingRent(b);
      const rooms = getBookingRoomsCount(b);

      monthMap[monthKey].bookings.push(b);
      monthMap[monthKey].totalRent += rent;
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
    let grandTotal = 0;
    let totalBookingsCount = 0;
    let totalRoomsCount = 0;
    let peakRent = 0;
    let peakMonthKey = '';
    let currentMonthRent = 0;
    let lastMonthRent = 0;
    let currentMonthCount = 0;
    let lastMonthCount = 0;

    monthlyData.forEach((m) => {
      grandTotal += m.totalRent;
      totalBookingsCount += m.bookings.length;
      totalRoomsCount += m.roomsCount;

      if (m.totalRent > peakRent) {
        peakRent = m.totalRent;
        peakMonthKey = m.monthKey;
      }

      if (m.monthKey === currentMonthKey) {
        currentMonthRent = m.totalRent;
        currentMonthCount = m.bookings.length;
      } else if (m.monthKey === lastMonthKey) {
        lastMonthRent = m.totalRent;
        lastMonthCount = m.bookings.length;
      }
    });

    return {
      grandTotal,
      totalBookingsCount,
      totalRoomsCount,
      peakRent,
      peakMonthKey,
      currentMonthRent,
      lastMonthRent,
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
      return {
        'माह / वर्ष (Month)': monthLabel,
        'माह कोड (Code)': m.monthKey,
        'कुल बुकिंग संख्या (Bookings)': m.bookings.length,
        'कुल कक्ष दिवस (Room Days)': m.roomsCount,
        'कुल निर्धारित किराया (Total Collection ₹)': m.totalRent,
        'औसत किराया प्रति बुकिंग (Avg Rent ₹)':
          m.bookings.length > 0 ? Math.round(m.totalRent / m.bookings.length) : 0,
      };
    });

    // Add Grand Total row to summary
    summaryRows.push({
      'माह / वर्ष (Month)': 'कुल योग (GRAND TOTAL)',
      'माह कोड (Code)': '-',
      'कुल बुकिंग संख्या (Bookings)': overallStats.totalBookingsCount,
      'कुल कक्ष दिवस (Room Days)': overallStats.totalRoomsCount,
      'कुल निर्धारित किराया (Total Collection ₹)': overallStats.grandTotal,
      'औसत किराया प्रति बुकिंग (Avg Rent ₹)':
        overallStats.totalBookingsCount > 0
          ? Math.round(overallStats.grandTotal / overallStats.totalBookingsCount)
          : 0,
    });

    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'माह-वार सारांश');

    // Sheet 2: All Active Bookings Details
    const detailRows: any[] = [];
    monthlyData.forEach((m) => {
      const monthLabel = formatMonthKey(m.monthKey, language === 'hi' ? 'hi' : 'en');
      m.bookings.forEach((b) => {
        const dispatchNo = b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';
        const suits = getBookingSuitsList(b).join(', ');
        const rent = calculateBookingRent(b);

        detailRows.push({
          'माह (Month)': monthLabel,
          'दिनांक (Stay Date)': b.booking_date,
          'पत्र क्रमांक (Dispatch No)': dispatchNo,
          'अतिथि/अधिकारी का नाम (Officer Name)': b.guest_name,
          'पदनाम/संदर्भ (Reference)': b.reference || '-',
          'आवंटित सूट (Suits)': suits,
          'कमरे (Room Count)': getBookingRoomsCount(b),
          'निर्धारित किराया (Rent ₹)': rent,
          'स्थिति (Status)': b.status,
        });
      });
    });

    const detailWs = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, detailWs, 'विस्तृत आवंटन विवरण');

    // Write file
    XLSX.writeFile(
      wb,
      `POGH_Ayodhya_Monthly_Collection_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  // Filtered list if search query entered
  const filteredMonths = monthlyData.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const monthLabel = formatMonthKey(m.monthKey, 'hi').toLowerCase();
    const monthLabelEn = formatMonthKey(m.monthKey, 'en').toLowerCase();
    if (monthLabel.includes(q) || monthLabelEn.includes(q) || m.monthKey.includes(q)) return true;

    // Check if any booking inside matches officer or dispatch no
    return m.bookings.some(
      (b) =>
        b.guest_name.toLowerCase().includes(q) ||
        (b.reference || '').toLowerCase().includes(q) ||
        (b.dispatch_no || '').includes(q)
    );
  });

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

        {/* Action Buttons: Excel Download & Print */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 whitespace-nowrap"
            title="Download Full Excel Statement"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'hi' ? 'एक्सेल डाउनलोड (.xlsx)' : 'Download Excel'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 whitespace-nowrap"
            title="Print Official Statement"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'hi' ? 'प्रिंट' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Revenue Tile */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'hi' ? 'कुल संकलित किराया' : 'Total Revenue'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              ₹{overallStats.grandTotal.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {overallStats.totalBookingsCount} {language === 'hi' ? 'कुल बुकिंग्स' : 'Total Bookings'} • {overallStats.totalRoomsCount} {language === 'hi' ? 'कक्ष दिवस' : 'Room days'}
          </p>
        </div>

        {/* Last Month Collection Tile */}
        <div className="bg-gradient-to-br from-purple-50/70 via-white to-purple-50/40 rounded-2xl p-4 sm:p-5 border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
              <span>{language === 'hi' ? 'गत माह कलेक्शन' : 'Last Month'}</span>
              <span className="text-[10px] font-semibold text-purple-700">
                ({formatMonthKey(lastMonthKey, language === 'hi' ? 'hi' : 'en')})
              </span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-purple-950">
              ₹{overallStats.lastMonthRent.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-purple-700 font-medium">
            {overallStats.lastMonthCount} {language === 'hi' ? 'आवंटन दर्ज' : 'Bookings recorded'}
          </p>
        </div>

        {/* Current Month Collection Tile */}
        <div className="bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40 rounded-2xl p-4 sm:p-5 border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
              <span>{language === 'hi' ? 'चालू माह संग्रह' : 'Current Month'}</span>
              <span className="text-[10px] font-semibold text-amber-700">
                ({formatMonthKey(currentMonthKey, language === 'hi' ? 'hi' : 'en')})
              </span>
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-amber-950">
              ₹{overallStats.currentMonthRent.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-800 font-medium">
            {overallStats.currentMonthCount} {language === 'hi' ? 'आवंटन दर्ज' : 'Bookings recorded'}
          </p>
        </div>

        {/* Peak Month Collection Tile */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {language === 'hi' ? 'सर्वाधिक संग्रह माह' : 'Peak Month'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-900">
              ₹{overallStats.peakRent.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-700 font-medium truncate">
            {formatMonthKey(overallStats.peakMonthKey, language === 'hi' ? 'hi' : 'en')}
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

      {/* Month-Wise Breakdown List */}
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

                {/* Right: Rent & Progress & Accordion Trigger */}
                <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                  {/* Visual Bar Indicator */}
                  <div className="hidden md:flex flex-col items-end w-32">
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
                      ₹{m.totalRent.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500 font-semibold">
                      {language === 'hi' ? 'कुल किराया संग्रह' : 'Total Collection'}
                    </div>
                  </div>

                  {/* Expand Button */}
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
                        ? `${monthHindi} के सभी आवंटन विवरण (${m.bookings.length})`
                        : `All Bookings for ${monthEnglish} (${m.bookings.length})`}
                    </span>
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      {language === 'hi'
                        ? 'आवंटन पत्र देखने हेतु किसी भी पंक्ति पर क्लिक करें'
                        : 'Click on any booking to view allotment letter'}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold">
                          <th className="py-3 px-3.5 whitespace-nowrap">
                            {language === 'hi' ? 'दिनांक' : 'Date'}
                          </th>
                          <th className="py-3 px-3.5 whitespace-nowrap">
                            {language === 'hi' ? 'पत्र संख्या' : 'Dispatch'}
                          </th>
                          <th className="py-3 px-3.5">
                            {language === 'hi' ? 'अधिकारी का नाम व पदनाम' : 'Officer & Rank'}
                          </th>
                          <th className="py-3 px-3.5 whitespace-nowrap">
                            {language === 'hi' ? 'आवंटित सूट' : 'Suits'}
                          </th>
                          <th className="py-3 px-3.5 text-right whitespace-nowrap">
                            {language === 'hi' ? 'किराया' : 'Rent'}
                          </th>
                          <th className="py-3 px-3.5 text-center whitespace-nowrap">
                            {language === 'hi' ? 'स्थिति' : 'Status'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {m.bookings.map((b) => {
                          const rent = calculateBookingRent(b);
                          const suits = getBookingSuitsList(b).join(', ');
                          const dispatchNo =
                            b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';

                          return (
                            <tr
                              key={b.id}
                              onClick={() => onSelectBooking && onSelectBooking(b)}
                              className="hover:bg-amber-50/50 transition cursor-pointer group"
                            >
                              <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                {b.booking_date}
                              </td>
                              <td className="py-3 px-3.5 font-bold text-slate-600 whitespace-nowrap">
                                {dispatchNo !== '-' ? `पत्र #${dispatchNo}` : '-'}
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
                              <td className="py-3 px-3.5 font-medium text-slate-700 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200">
                                  {suits}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                                ₹{rent.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{b.status || 'CONFIRMED'}</span>
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
            <p className="text-base font-bold text-slate-700">कोई रिकॉर्ड नहीं मिला</p>
            <p className="text-xs text-slate-500 mt-1">खोज शब्द बदल कर पुनः प्रयास करें</p>
          </div>
        )}
      </div>

      {/* Page Footer Note */}
      <div className="text-center text-xs text-slate-400 py-3">
        पुलिस ऑफिसर्स गेस्ट हाउस (POGH), अयोध्या • सम्पूर्ण संकलित किराया: ₹{overallStats.grandTotal.toLocaleString('en-IN')}
      </div>

    </div>
  );
};
