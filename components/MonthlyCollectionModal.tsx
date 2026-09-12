'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '@/lib/types';
import { formatMonthKey, formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import { calculateBookingRent, getBookingRoomsCount, getBookingSuitsList, extractDispatchNoFromNotes } from '@/lib/bookingUtils';
import { useLanguage } from '@/lib/languageContext';
import * as XLSX from 'xlsx';
import {
  X,
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
  CheckCircle2
} from 'lucide-react';

interface MonthlyCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  onSelectBooking?: (booking: Booking) => void;
}

export const MonthlyCollectionModal: React.FC<MonthlyCollectionModalProps> = ({
  isOpen,
  onClose,
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

  if (!isOpen) return null;

  // Toggle month expansion
  const toggleExpand = (monthKey: string) => {
    setExpandedMonth((prev) => (prev === monthKey ? null : monthKey));
  };

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Monthly Summary
    const summaryRows = monthlyData.map((m) => {
      const monthLabel = language === 'hi' ? formatMonthKey(m.monthKey, 'hi') : formatMonthKey(m.monthKey, 'en');
      return {
        'माह / वर्ष (Month)': monthLabel,
        'माह कोड (Code)': m.monthKey,
        'कुल बुकिंग संख्या (Bookings)': m.bookings.length,
        'कुल कक्ष दिवस (Room Days)': m.roomsCount,
        'कुल निर्धारित किराया (Total Collection ₹)': m.totalRent,
        'औसत किराया प्रति बुकिंग (Avg Rent ₹)': m.bookings.length > 0 ? Math.round(m.totalRent / m.bookings.length) : 0,
      };
    });

    // Add Grand Total row to summary
    summaryRows.push({
      'माह / वर्ष (Month)': 'कुल योग (GRAND TOTAL)',
      'माह कोड (Code)': '-',
      'कुल बुकिंग संख्या (Bookings)': overallStats.totalBookingsCount,
      'कुल कक्ष दिवस (Room Days)': overallStats.totalRoomsCount,
      'कुल निर्धारित किराया (Total Collection ₹)': overallStats.grandTotal,
      'औसत किराया प्रति बुकिंग (Avg Rent ₹)': overallStats.totalBookingsCount > 0 ? Math.round(overallStats.grandTotal / overallStats.totalBookingsCount) : 0,
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
    XLSX.writeFile(wb, `POGH_Ayodhya_Monthly_Collection_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-amber-500/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-amber-400/40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/up_police_logo.png" alt="UP Police" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide text-white">
                  {language === 'hi' ? 'माह-वार किराया संग्रह आख्या' : 'Month-Wise Revenue Breakdown'}
                </h2>
                <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  POGH AYODHYA
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {language === 'hi' ? 'पुलिस कार्यालय, जनपद अयोध्या • सम्पूर्ण वित्तीय आख्या' : 'Police Office Ayodhya • Complete Financial Report'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
              title="Download Excel Report"
            >
              <Download className="w-4 h-4" />
              <span>एक्सेल डाउनलोड</span>
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
              title="Print Official Statement"
            >
              <Printer className="w-4 h-4" />
              <span>प्रिंट</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/60">
          
          {/* Top 4 KPI Summary Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Total Revenue Tile */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'hi' ? 'कुल संकलित किराया' : 'Total Revenue'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  ₹{overallStats.grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {overallStats.totalBookingsCount} {language === 'hi' ? 'बुकिंग्स' : 'Bookings'} • {overallStats.totalRoomsCount} {language === 'hi' ? 'कक्ष दिवस' : 'Room days'}
              </p>
            </div>

            {/* Last Month Collection Tile */}
            <div className="bg-gradient-to-br from-purple-50/80 to-white rounded-xl p-3.5 sm:p-4 border border-purple-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                  <span>{language === 'hi' ? 'गत माह कलेक्शन' : 'Last Month'}</span>
                  <span className="text-[10px] font-semibold text-purple-700">({formatMonthKey(lastMonthKey, language === 'hi' ? 'hi' : 'en')})</span>
                </span>
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-purple-950">
                  ₹{overallStats.lastMonthRent.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-purple-700 font-medium">
                {overallStats.lastMonthCount} {language === 'hi' ? 'बुकिंग्स दर्ज' : 'Bookings recorded'}
              </p>
            </div>

            {/* Current Month Collection Tile */}
            <div className="bg-gradient-to-br from-amber-50/80 to-white rounded-xl p-3.5 sm:p-4 border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                  <span>{language === 'hi' ? 'चालू माह संग्रह' : 'Current Month'}</span>
                  <span className="text-[10px] font-semibold text-amber-700">({formatMonthKey(currentMonthKey, language === 'hi' ? 'hi' : 'en')})</span>
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-amber-950">
                  ₹{overallStats.currentMonthRent.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-amber-800 font-medium">
                {overallStats.currentMonthCount} {language === 'hi' ? 'बुकिंग्स दर्ज' : 'Bookings recorded'}
              </p>
            </div>

            {/* Peak Month Collection Tile */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'hi' ? 'सर्वाधिक संग्रह माह' : 'Peak Month'}
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-900">
                  ₹{overallStats.peakRent.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-700 font-medium truncate">
                {formatMonthKey(overallStats.peakMonthKey, language === 'hi' ? 'hi' : 'en')}
              </p>
            </div>

          </div>

          {/* Search Bar & Mobile Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'hi' ? 'माह या अधिकारी के नाम से खोजें...' : 'Search by month or officer name...'}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto sm:hidden">
              <button
                onClick={handleExportExcel}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>एक्सेल</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>प्रिंट</span>
              </button>
            </div>
          </div>

          {/* Monthly Breakdown List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>{language === 'hi' ? 'माह-वार किराया संग्रह विवरण' : 'Month-By-Month Revenue Record'}</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                {filteredMonths.length} {language === 'hi' ? 'माह प्रदर्शित' : 'Months displayed'}
              </span>
            </div>

            {filteredMonths.map((m) => {
              const isExpanded = expandedMonth === m.monthKey;
              const isCurrent = m.monthKey === currentMonthKey;
              const isLast = m.monthKey === lastMonthKey;
              const monthHindi = formatMonthKey(m.monthKey, 'hi');
              const monthEnglish = formatMonthKey(m.monthKey, 'en');

              // Percentage of peak rent
              const peakPct = overallStats.peakRent > 0 ? Math.round((m.totalRent / overallStats.peakRent) * 100) : 0;

              return (
                <div
                  key={m.monthKey}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                    isCurrent
                      ? 'border-amber-400/80 ring-1 ring-amber-400/40'
                      : isLast
                      ? 'border-purple-300'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Row Summary Bar */}
                  <div
                    onClick={() => toggleExpand(m.monthKey)}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition"
                  >
                    {/* Left: Month Name & Badges */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                          isCurrent
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : isLast
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {m.monthKey.slice(5)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                            {language === 'hi' ? monthHindi : monthEnglish}
                          </h4>

                          {isCurrent && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              {language === 'hi' ? 'चालू माह' : 'Current Month'}
                            </span>
                          )}

                          {isLast && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                              {language === 'hi' ? 'गत माह' : 'Last Month'}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {m.bookings.length} {language === 'hi' ? 'आवंटन पत्र / बुकिंग्स' : 'Allotments'} • {m.roomsCount} {language === 'hi' ? 'कक्ष दिवस' : 'Room Days'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Rent & Progress & Accordion Trigger */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      
                      {/* Visual Bar Indicator */}
                      <div className="hidden md:flex flex-col items-end w-28">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                          <span>{peakPct}% {language === 'hi' ? 'चरम का' : 'of peak'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              isCurrent ? 'bg-amber-500' : isLast ? 'bg-purple-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${peakPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Revenue Amount */}
                      <div className="text-right">
                        <div className="text-base sm:text-lg font-black text-slate-900">
                          ₹{m.totalRent.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold">
                          {language === 'hi' ? 'कुल संग्रह' : 'Total Collection'}
                        </div>
                      </div>

                      {/* Expand Button */}
                      <button
                        type="button"
                        className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                        aria-label="Expand Month Details"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Allotment Letters Table for this Month */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/90 bg-slate-50/50 p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2.5 px-1">
                        <span className="text-xs font-bold text-slate-700">
                          {language === 'hi' ? `${monthHindi} के सभी आवंटन विवरण (${m.bookings.length})` : `All Bookings for ${monthEnglish} (${m.bookings.length})`}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {language === 'hi' ? 'विवरण देखने हेतु किसी भी पत्र पर क्लिक करें' : 'Click on any booking to view details'}
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                              <th className="py-2.5 px-3">{language === 'hi' ? 'दिनांक' : 'Date'}</th>
                              <th className="py-2.5 px-3">{language === 'hi' ? 'पत्र संख्या' : 'Dispatch'}</th>
                              <th className="py-2.5 px-3">{language === 'hi' ? 'अधिकारी का नाम व पदनाम' : 'Officer & Rank'}</th>
                              <th className="py-2.5 px-3">{language === 'hi' ? 'आवंटित सूट' : 'Suits'}</th>
                              <th className="py-2.5 px-3 text-right">{language === 'hi' ? 'किराया' : 'Rent'}</th>
                              <th className="py-2.5 px-3 text-center">{language === 'hi' ? 'स्थिति' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {m.bookings.map((b) => {
                              const rent = calculateBookingRent(b);
                              const suits = getBookingSuitsList(b).join(', ');
                              const dispatchNo = b.dispatch_no || extractDispatchNoFromNotes(b.notes) || '-';

                              return (
                                <tr
                                  key={b.id}
                                  onClick={() => onSelectBooking && onSelectBooking(b)}
                                  className="hover:bg-amber-50/40 transition cursor-pointer"
                                >
                                  <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                    {b.booking_date}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-600 whitespace-nowrap">
                                    {dispatchNo !== '-' ? `पत्र #${dispatchNo}` : '-'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-900">{b.guest_name}</div>
                                    {b.reference && (
                                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{b.reference}</div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold border border-slate-200">
                                      {suits}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                                    ₹{rent.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
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
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">कोई रिकॉर्ड नहीं मिला</p>
                <p className="text-xs text-slate-500 mt-1">खोज शब्द बदल कर पुनः प्रयास करें</p>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100/90 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 text-center sm:text-left">
            <Building2 className="w-3.5 h-3.5 text-amber-600" />
            <span>पुलिस ऑफिसर्स गेस्ट हाउस (POGH), जनपद अयोध्या • कुल संग्रह: ₹{overallStats.grandTotal.toLocaleString('en-IN')}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            {language === 'hi' ? 'बंद करें' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
