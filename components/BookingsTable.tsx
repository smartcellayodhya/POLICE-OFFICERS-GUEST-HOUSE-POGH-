'use client';

import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { formatToDisplayDate, calculateStayNights, formatToISODate, formatToHindiDate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import {
  extractGroupIdFromNotes,
  extractDispatchNoFromNotes,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractFoodAmountFromNotes,
  extractExpenditureFromNotes,
  extractPaymentModeFromNotes,
  extractCollectedByFromNotes,
  formatGuestDisplayName,
  calculateBookingRent,
  isHourlyBooking,
  extractStayHoursFromNotes,
  extractHourlyRateFromNotes,
  getCurrentFormattedTime,
  updateNotesWithDatesAndTimes,
} from '@/lib/bookingUtils';
import { exportBookingsToExcel } from '@/lib/excel';
import { REFERENCES, SUITS } from '@/lib/constants';
import {
  Search,
  FileText,
  Share2,
  Trash2,
  LogIn,
  LogOut,
  XCircle,
  Phone,
  BedDouble,
  Clock,
  Tag,
  AlertCircle,
  RotateCcw,
  Filter,
  Edit3,
  Download,
  Receipt,
  MoreVertical,
  IndianRupee,
  X,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

import { useLanguage } from '@/lib/languageContext';

interface BookingsTableProps {
  bookings: Booking[];
  isAdmin: boolean;
  isOperator?: boolean;
  onOpenLetter: (booking: Booking) => void;
  onOpenReceipt: (booking: Booking) => void;
  onOpenRecordCollection?: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onDeleteBooking: (id: string, groupId?: string) => Promise<void>;
  onUpdateStatus: (booking: Booking, newStatus: BookingStatus, updateAllDates?: boolean, extraUpdates?: Partial<Booking>) => Promise<void>;
}

type StatusFilter = 'ALL' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

interface GroupedStay {
  id: string;
  groupId: string;
  primaryBooking: Booking;
  allBookings: Booking[];
  guestName: string;
  mobileNumber: string;
  reference: string;
  checkInDate: string;
  checkOutDate: string;
  stayNights: number;
  suits: string[];
  totalRent: number;
  foodAmount: number;
  expenditure: number;
  grossCollection: number;
  totalCollection: number;
  collectedBy: string;
  paymentMode: string;
  mealStatus: string;
  status: BookingStatus;
  notes: string;
  dispatchNo: string;
  isHourly: boolean;
  stayHours?: number;
  hourlyRate?: number;
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  bookings,
  isAdmin,
  isOperator = false,
  onOpenLetter,
  onOpenReceipt,
  onOpenRecordCollection,
  onEditBooking,
  onDeleteBooking,
  onUpdateStatus,
}) => {
  const { language, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [stayTypeFilter, setStayTypeFilter] = useState<'ALL' | 'STANDARD' | 'HOURLY'>('ALL');
  const [referenceFilter, setReferenceFilter] = useState('ALL');
  const [suitFilter, setSuitFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [visibleLimit, setVisibleLimit] = useState<number>(30);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [lifecycleModal, setLifecycleModal] = useState<{
    stay: GroupedStay;
    action: 'CHECK_IN' | 'CHECK_OUT';
    date: string;
    time: string;
    applyAll: boolean;
  } | null>(null);
  const deferredSearch = useDeferredValue(searchTerm);

  // Close card action menu when clicking outside - attached only when a menu is open
  useEffect(() => {
    if (!activeMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.card-action-menu')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  // 1. Group raw day-wise booking records into consolidated Stays
  const groupedStays: GroupedStay[] = useMemo(() => {
    const groupMap = new Map<string, Booking[]>();

    bookings.forEach((b) => {
      const gId = b.group_id || extractGroupIdFromNotes(b.notes);
      // Group by group_id if available, otherwise by unique guest + mobile combination
      const safeGuest = (b.guest_name || '').trim().toLowerCase();
      const safeMobile = (b.mobile_number || '').trim();
      const key = gId ? `ref-${gId}` : `guest-${safeGuest}-${safeMobile}-${b.booking_date}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(b);
    });

    const result: GroupedStay[] = [];

    groupMap.forEach((dayBookings) => {
      // Sort bookings chronologically
      dayBookings.sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || ''));
      const primary = dayBookings[0];
      const gId = primary.group_id || extractGroupIdFromNotes(primary.notes) || `POGH-${primary.id.slice(0, 4)}`;
      const dispNo = primary.dispatch_no || extractDispatchNoFromNotes(primary.notes) || '';

      const notesCin = extractCheckInDateFromNotes(primary.notes);
      const notesCout = extractCheckOutDateFromNotes(primary.notes);

      const checkInDate = notesCin || dayBookings[0].booking_date;
      let checkOutDate = notesCout || dayBookings[dayBookings.length - 1].booking_date;

      // If single day booking and no separate checkOut in notes, default checkout is same
      if (!notesCout && dayBookings.length === 1) {
        checkOutDate = checkInDate;
      }

      const stayNights = calculateStayNights(checkInDate, checkOutDate);

      // Collect all unique suits booked across this stay
      const suitSet = new Set<string>();
      dayBookings.forEach((b) => {
        if (Number(b.suit_1) > 0) suitSet.add('Suit 1');
        if (Number(b.suit_2) > 0) suitSet.add('Suit 2');
        if (Number(b.suit_3) > 0) suitSet.add('Suit 3');
        if (Number(b.suit_4) > 0) suitSet.add('Suit 4');
      });

      // Calculate total stay rent & collections across days
      let totalRent = 0;
      let foodAmount = 0;
      let expenditure = 0;
      let collectedBy = '';
      let paymentMode = '';

      dayBookings.forEach((b) => {
        totalRent += calculateBookingRent(b);
        const f = extractFoodAmountFromNotes(b.notes) || Number(b.food_amount) || 0;
        if (f > foodAmount) foodAmount = f;
        const exp = extractExpenditureFromNotes(b.notes) || Number(b.expenditure) || 0;
        if (exp > expenditure) expenditure = exp;
        const cb = extractCollectedByFromNotes(b.notes) || b.collected_by;
        if (cb && !collectedBy) collectedBy = cb;
        const pm = extractPaymentModeFromNotes(b.notes) || b.payment_mode;
        if (pm && !paymentMode) paymentMode = pm;
      });

      // If rent was stored only on primary record
      if (totalRent === 0 && Number(primary.total_amount) > 0) {
        totalRent = Number(primary.total_amount);
      }

      const grossCollection = totalRent + foodAmount;
      // If room rent + food charge is 0, expenditure must not turn total into negative
      const totalCollection = grossCollection <= 0 ? 0 : Math.max(0, grossCollection - expenditure);

      // Determine overall status
      let overallStatus: BookingStatus = primary.status || 'CONFIRMED';
      if (dayBookings.some((b) => b.status === 'CHECKED_IN')) {
        overallStatus = 'CHECKED_IN';
      } else if (dayBookings.every((b) => b.status === 'CHECKED_OUT')) {
        overallStatus = 'CHECKED_OUT';
      } else if (dayBookings.every((b) => b.status === 'CANCELLED')) {
        overallStatus = 'CANCELLED';
      }

      const isHourly = isHourlyBooking(primary);
      const stayHours = extractStayHoursFromNotes(primary.notes) || (primary.stay_hours ? Number(primary.stay_hours) : undefined);
      const hourlyRate = extractHourlyRateFromNotes(primary.notes) || (primary.hourly_rate ? Number(primary.hourly_rate) : undefined);

      result.push({
        id: primary.id,
        groupId: gId,
        primaryBooking: primary,
        allBookings: dayBookings,
        guestName: primary.guest_name,
        mobileNumber: primary.mobile_number,
        reference: primary.reference || '-',
        checkInDate,
        checkOutDate,
        stayNights: Math.max(stayNights, dayBookings.length),
        suits: Array.from(suitSet).sort(),
        totalRent,
        foodAmount,
        expenditure,
        grossCollection,
        totalCollection,
        collectedBy,
        paymentMode,
        mealStatus: primary.meal_type_status || 'PAID',
        status: overallStatus,
        notes: primary.notes || '',
        dispatchNo: dispNo,
        isHourly,
        stayHours,
        hourlyRate,
      });
    });

    // Sort newest check-in first
    result.sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
    return result;
  }, [bookings]);

  // 2. Filter grouped stays by search term, status, stay type, reference, suit, and date range
  const filteredStays = useMemo(() => {
    return groupedStays.filter((stay) => {
      // Stay type filter
      if (stayTypeFilter === 'HOURLY' && !stay.isHourly) return false;
      if (stayTypeFilter === 'STANDARD' && stay.isHourly) return false;

      // Status filter
      if (statusFilter !== 'ALL') {
        if (stay.status !== statusFilter) return false;
      }

      // Reference filter
      if (referenceFilter !== 'ALL' && stay.reference !== referenceFilter) {
        return false;
      }

      // Suit filter
      if (suitFilter !== 'ALL') {
        const suitName = suitFilter === 'suit_1' ? 'Suit 1' : suitFilter === 'suit_2' ? 'Suit 2' : suitFilter === 'suit_3' ? 'Suit 3' : 'Suit 4';
        if (!stay.suits.includes(suitName)) return false;
      }

      // Date range filter
      if (fromDate && stay.checkInDate < fromDate && stay.checkOutDate < fromDate) return false;
      if (toDate && stay.checkInDate > toDate) return false;

      // Search term filter (uses deferred value for 60fps typing)
      if (!deferredSearch.trim()) return true;
      const q = deferredSearch.toLowerCase().trim();

      return (
        (stay.guestName || '').toLowerCase().includes(q) ||
        (stay.mobileNumber || '').includes(q) ||
        (stay.groupId || '').toLowerCase().includes(q) ||
        (stay.dispatchNo || '').toLowerCase().includes(q) ||
        (stay.reference || '').toLowerCase().includes(q) ||
        (stay.checkInDate || '').includes(q) ||
        (stay.checkOutDate || '').includes(q)
      );
    });
  }, [groupedStays, deferredSearch, statusFilter, stayTypeFilter, referenceFilter, suitFilter, fromDate, toDate]);

  const setThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    setFromDate(`${y}-${m}-01`);
    setToDate(`${y}-${m}-${lastDay}`);
  };

  const setLastMonth = () => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prevMonthDate.getFullYear();
    const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, prevMonthDate.getMonth() + 1, 0).getDate();
    setFromDate(`${y}-${m}-01`);
    setToDate(`${y}-${m}-${lastDay}`);
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setSearchTerm('');
    setStatusFilter('ALL');
    setStayTypeFilter('ALL');
    setReferenceFilter('ALL');
    setSuitFilter('ALL');
  };

  // Synchronized Check-in / Check-out with Date & Time selection modal
  const handleLifecycleClick = (stay: GroupedStay) => {
    if (!isAdmin && !isOperator) return;
    const current = stay.status;
    const todayStr = formatToISODate(new Date());

    if (current === 'CONFIRMED' || !current) {
      setLifecycleModal({
        stay,
        action: 'CHECK_IN',
        date: stay.checkInDate || todayStr,
        time: stay.primaryBooking.check_in_time && stay.primaryBooking.check_in_time !== '12:00 PM'
          ? stay.primaryBooking.check_in_time
          : getCurrentFormattedTime(),
        applyAll: true,
      });
    } else if (current === 'CHECKED_IN') {
      setLifecycleModal({
        stay,
        action: 'CHECK_OUT',
        date: todayStr,
        time: getCurrentFormattedTime(),
        applyAll: true,
      });
    } else if (current === 'CHECKED_OUT') {
      const confirmReset = window.confirm(
        language === 'hi'
          ? `क्या आप ${stay.guestName} की स्थिति को पुनः आरक्षित (Confirmed) पर सेट करना चाहते हैं?`
          : `Do you want to reset status for ${stay.guestName} back to Confirmed?`
      );
      if (confirmReset) {
        onUpdateStatus(stay.primaryBooking, 'CONFIRMED', true);
      }
    }
  };

  const handleConfirmLifecycleModal = async () => {
    if (!lifecycleModal) return;
    const { stay, action, date, time, applyAll } = lifecycleModal;
    const isCheckIn = action === 'CHECK_IN';
    const newStatus: BookingStatus = isCheckIn ? 'CHECKED_IN' : 'CHECKED_OUT';

    const updatedNotes = updateNotesWithDatesAndTimes(stay.primaryBooking.notes, {
      ...(isCheckIn ? { checkInDate: date, checkInTime: time } : { checkOutDate: date, checkOutTime: time }),
    });

    await onUpdateStatus(
      stay.primaryBooking,
      newStatus,
      applyAll,
      {
        ...(isCheckIn ? { check_in_time: time } : { check_out_time: time }),
        notes: updatedNotes,
      }
    );

    setLifecycleModal(null);
  };

  const handleCancelClick = (stay: GroupedStay) => {
    if (!isAdmin && !isOperator) return;
    const isCurrentlyCancelled = stay.status === 'CANCELLED';
    const newStatus: BookingStatus = isCurrentlyCancelled ? 'CONFIRMED' : 'CANCELLED';
    const confirmMsg =
      language === 'hi'
        ? `क्या आप ${stay.guestName} की बुकिंग (${stay.groupId}) को ${isCurrentlyCancelled ? 'बहाल' : 'निरस्त'} करना चाहते हैं?`
        : `Are you sure you want to ${isCurrentlyCancelled ? 'restore' : 'cancel'} the booking (${stay.groupId}) for ${stay.guestName}?`;

    if (window.confirm(confirmMsg)) {
      onUpdateStatus(stay.primaryBooking, newStatus, true);
    }
  };

  const handleDeleteClick = (stay: GroupedStay) => {
    if (!isAdmin) return;
    const confirmMsg =
      language === 'hi'
        ? `क्या आप ${stay.guestName} का बुकिंग रिकॉर्ड (${stay.groupId}) स्थायी रूप से हटाना चाहते हैं?`
        : `Are you sure you want to permanently delete the booking record (${stay.groupId}) for ${stay.guestName}?`;
    if (window.confirm(confirmMsg)) {
      onDeleteBooking(stay.primaryBooking.id, stay.groupId);
    }
  };

  // Export filtered stays to genuine formatted Excel file (matching official PDF register format)
  const handleExportExcel = async () => {
    await exportBookingsToExcel(
      filteredStays,
      `POGH_Ayodhya_Bookings_Register_${formatToISODate(new Date())}.xlsx`,
      language
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8 font-sans max-w-full">
      
      {/* 1. Header Bar with Real Excel Export & Search Bar */}
      <div className="p-3.5 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 border-b border-amber-500/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {language === 'hi' ? 'अतिथि बुकिंग पंजिका' : 'Guest Booking Directory'}
            </h2>
            <p className="text-xs text-amber-300 font-medium mt-0.5">
              {language === 'hi' ? 'कुल प्रवास: ' : 'Total Stays: '}
              <strong>{filteredStays.length}</strong>
            </p>
          </div>
        </div>

        {/* Excel Export Button & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'hi' ? 'नाम, मोबाइल, संदर्भ या तिथि खोजें...' : 'Search by name, phone, ref...'}
              className="w-full pl-8 pr-3 py-2 sm:py-1.5 text-xs rounded-xl bg-slate-800 text-white placeholder-slate-400 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition"
            />
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-xs whitespace-nowrap active:scale-95 cursor-pointer shrink-0"
            title={language === 'hi' ? 'पूरी पंजिका Excel (.xlsx) में डाउनलोड करें' : 'Download Bookings in Excel (.xlsx)'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'एक्सेल (.xlsx)' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. Streamlined Filter Bar */}
      <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Status Filter Tabs (Horizontal smooth swipe on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none w-full lg:w-auto">
          <div className="flex items-center gap-1 text-slate-500 mr-1 font-semibold shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'स्थिति:' : 'Status:'}</span>
          </div>

          {[
            { id: 'ALL', label: t('all') },
            { id: 'CONFIRMED', label: t('confirmed') },
            { id: 'CHECKED_IN', label: t('checkedIn') },
            { id: 'CHECKED_OUT', label: t('checkedOut') },
            { id: 'CANCELLED', label: t('cancelled') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as StatusFilter)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer shrink-0 whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date, Reference, Suit Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Reference Selector */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <Tag className="w-3 h-3 text-slate-400" />
            <select
              value={referenceFilter}
              onChange={(e) => setReferenceFilter(e.target.value)}
              className="outline-none text-slate-800 text-xs bg-transparent cursor-pointer font-medium"
            >
              <option value="ALL">{language === 'hi' ? 'सभी संदर्भ' : 'All References'}</option>
              {REFERENCES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Suit Selector */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <BedDouble className="w-3 h-3 text-slate-400" />
            <select
              value={suitFilter}
              onChange={(e) => setSuitFilter(e.target.value)}
              className="outline-none text-slate-800 text-xs bg-transparent cursor-pointer font-medium"
            >
              <option value="ALL">{language === 'hi' ? 'सभी सूट' : 'All Suits'}</option>
              {SUITS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Stay Type Selector */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <Clock className="w-3 h-3 text-slate-400" />
            <select
              value={stayTypeFilter}
              onChange={(e) => setStayTypeFilter(e.target.value as any)}
              className="outline-none text-slate-800 text-xs bg-transparent cursor-pointer font-medium"
            >
              <option value="ALL">{language === 'hi' ? 'सभी प्रकार' : 'All Types'}</option>
              <option value="STANDARD">{language === 'hi' ? 'पूर्ण दिवस / रात्रि' : 'Full Day / Overnight'}</option>
              <option value="HOURLY">{language === 'hi' ? 'घंटे अनुसार (अल्पकालिक)' : 'Hourly (Short Stay)'}</option>
            </select>
          </div>

          {/* Quick Month Buttons */}
          <button
            onClick={setThisMonth}
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition text-[11px] cursor-pointer"
          >
            {language === 'hi' ? 'इस माह' : 'This Month'}
          </button>
          <button
            onClick={setLastMonth}
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition text-[11px] cursor-pointer"
          >
            {language === 'hi' ? 'गत माह' : 'Last Month'}
          </button>

          {(fromDate || toDate || searchTerm || referenceFilter !== 'ALL' || suitFilter !== 'ALL' || statusFilter !== 'ALL' || stayTypeFilter !== 'ALL') && (
            <button
              onClick={clearFilters}
              className="px-2 py-1 text-rose-600 hover:text-rose-700 font-bold text-[11px] hover:underline cursor-pointer"
            >
              {language === 'hi' ? 'रीसेट' : 'Reset'}
            </button>
          )}
        </div>
      </div>

      {/* 3. Consolidated Stay Records List */}
      <div className="p-3 sm:p-6">
        {filteredStays.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
            <p className="text-sm font-medium text-slate-500">
              {language === 'hi' ? 'कोई बुकिंग रिकॉर्ड नहीं मिला।' : 'No booking records found.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {filteredStays.slice(0, visibleLimit).map((stay) => {
                const isInHouse = stay.status === 'CHECKED_IN';
              const isCheckedOut = stay.status === 'CHECKED_OUT';
              const isCancelled = stay.status === 'CANCELLED';
              const isMenuOpen = activeMenuId === stay.id;

              const cleanGuestName = formatGuestDisplayName(stay.guestName);

              return (
                <div
                  key={stay.id}
                  className={`min-w-0 p-3.5 sm:p-5 rounded-2xl border transition shadow-xs flex flex-col justify-between ${
                    isMenuOpen ? 'relative z-30' : 'relative z-0'
                  } ${
                    isCancelled
                      ? 'bg-slate-50/70 border-slate-200 opacity-60'
                      : isInHouse
                      ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-200'
                      : isCheckedOut
                      ? 'bg-slate-50/90 border-slate-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header: Ref Code & Clean Stay Range */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {stay.groupId}
                        </span>
                        {stay.dispatchNo && stay.dispatchNo !== '-' && (
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                            #{stay.dispatchNo}
                          </span>
                        )}
                      </div>

                      {/* Stay Duration Display */}
                      {stay.isHourly ? (
                        <span className="text-[10.5px] sm:text-xs font-bold text-violet-900 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200 flex items-center gap-1 max-w-full break-words">
                          <Clock className="w-3 h-3 text-violet-600 shrink-0" />
                          <span>
                            {language === 'hi' ? formatToHindiDate(stay.checkInDate) : formatToDisplayDate(stay.checkInDate)}
                            {' '}• {stay.primaryBooking.check_in_time || '10:00'} - {stay.primaryBooking.check_out_time || '14:00'}
                            {' '}({language === 'hi' ? `${stay.stayHours || 2} घंटे` : `${stay.stayHours || 2}h`})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[10.5px] sm:text-xs font-bold text-slate-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 max-w-full break-words">
                          {stay.checkInDate === stay.checkOutDate
                            ? (language === 'hi'
                                ? `${formatToHindiDate(stay.checkInDate)} (1 दिन)`
                                : `${formatToDisplayDate(stay.checkInDate)} (1 Day)`)
                            : (language === 'hi'
                                ? `${formatToHindiDate(stay.checkInDate)} से ${formatToHindiDate(stay.checkOutDate)} (${stay.stayNights} रात्रि)`
                                : `${formatToDisplayDate(stay.checkInDate)} to ${formatToDisplayDate(stay.checkOutDate)} (${stay.stayNights} ${stay.stayNights > 1 ? 'Nights' : 'Night'})`)}
                        </span>
                      )}
                    </div>

                    {/* Guest Name, Mobile & Status Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight break-words">
                          {cleanGuestName}
                        </h3>
                        <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{stay.mobileNumber}</span>
                          </span>
                          {stay.reference && stay.reference !== '-' && (
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 text-[11px] font-sans font-medium">
                              {stay.reference}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Pill & Top-Right 3-Dots Action Menu */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 shadow-2xs ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isInHouse
                              ? 'bg-emerald-600 text-white'
                              : isCheckedOut
                              ? 'bg-slate-500 text-white'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {isCancelled
                            ? t('cancelled')
                            : isInHouse
                            ? t('checkedIn')
                            : isCheckedOut
                            ? t('checkedOut')
                            : t('confirmed')}
                        </span>

                        {/* Top-Right 3-Dots Dropdown Menu (Clean, Non-Duplicate Actions) */}
                        <div className="relative card-action-menu">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(isMenuOpen ? null : stay.id)}
                            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 flex items-center justify-center transition cursor-pointer"
                            title={language === 'hi' ? 'अधिक विकल्प' : 'More Options'}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                              {/* Receipt */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onOpenReceipt(stay.primaryBooking);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition text-left cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                                <span>{language === 'hi' ? 'किराया रसीद' : 'Payment Receipt'}</span>
                              </button>

                              {/* WhatsApp Share */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  const customIncharge = typeof window !== 'undefined' ? localStorage.getItem('pogh_contact_person') : null;
                                  const url = getWhatsAppUrl({
                                    guest_name: stay.guestName,
                                    mobile_number: stay.mobileNumber,
                                    reference: stay.reference,
                                    booking_ref_no: stay.groupId,
                                    dispatch_no: stay.dispatchNo,
                                    check_in_date: stay.checkInDate,
                                    check_out_date: stay.checkOutDate,
                                    check_in_time: stay.primaryBooking.check_in_time || '12:00 PM',
                                    check_out_time: stay.primaryBooking.check_out_time || '12:00 PM',
                                    suits: stay.suits,
                                    total_days: stay.stayNights,
                                    total_amount: stay.totalCollection,
                                    meal_type_status: stay.mealStatus,
                                    contact_person: customIncharge || undefined,
                                    dates: stay.allBookings.map((b) => b.booking_date),
                                  });
                                  window.open(url, '_blank');
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition text-left cursor-pointer"
                              >
                                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{language === 'hi' ? 'व्हाट्सएप भेजें' : 'Share WhatsApp'}</span>
                              </button>

                              {/* Cancel / Restore (Admin & Operator) */}
                              {(isAdmin || isOperator) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleCancelClick(stay);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition text-left cursor-pointer"
                                >
                                  {isCancelled ? (
                                    <>
                                      <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{language === 'hi' ? 'बुकिंग बहाल करें' : 'Restore Booking'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-amber-600" />
                                      <span>{language === 'hi' ? 'बुकिंग निरस्त करें' : 'Cancel Booking'}</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Delete Record (Admin Only) */}
                              {isAdmin && (
                                <>
                                  <div className="my-1 border-t border-slate-100" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleDeleteClick(stay);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>{language === 'hi' ? 'रिकॉर्ड हटाएं' : 'Delete Stay'}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Allocated Suits Badges */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {stay.suits.map((suit) => (
                        <span
                          key={suit}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200"
                        >
                          {suit}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Clean Footer: Amount Display & Standardized Action Bar */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    
                    {/* Amount Display */}
                    <div className="text-xs">
                      {stay.foodAmount > 0 || stay.expenditure > 0 ? (
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-emerald-700 text-sm tabular-nums">
                              ₹{stay.totalCollection.toLocaleString('en-IN')}/-
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                              {stay.expenditure > 0 ? (language === 'hi' ? 'शुद्ध' : 'Net') : (language === 'hi' ? 'कुल' : 'Total')}
                            </span>
                          </div>
                          <div className="text-[10.5px] sm:text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap leading-tight tabular-nums">
                            <span>{language === 'hi' ? 'किराया:' : 'Rent:'} ₹{stay.totalRent}</span>
                            {stay.foodAmount > 0 && <span className="text-blue-600 font-medium">+ {language === 'hi' ? 'भोजन:' : 'Food:'} ₹{stay.foodAmount}</span>}
                            {stay.expenditure > 0 && <span className="text-rose-600 font-medium">- {language === 'hi' ? 'खर्च:' : 'Exp:'} ₹{stay.expenditure}</span>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900 text-sm tabular-nums">
                            {stay.totalRent > 0 ? (
                              `₹${stay.totalRent.toLocaleString('en-IN')}/-`
                            ) : (
                              <span className="text-slate-500 font-medium text-xs">
                                {language === 'hi' ? 'निःशुल्क / शासकीय' : 'Complimentary / Official'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Standardized Responsive Action Strip: 100% Inside Card, Zero Overflow */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                      
                      {/* 1. Quick Status / Lifecycle Action (Full width on mobile for easy tap, auto on desktop) */}
                      {(isAdmin || isOperator) && (
                        <button
                          type="button"
                          onClick={() => handleLifecycleClick(stay)}
                          className={`h-9 px-3.5 rounded-lg text-xs sm:text-[13px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs whitespace-nowrap w-full sm:w-auto ${
                            isInHouse
                              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                              : isCheckedOut
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                          title={
                            isInHouse
                              ? (language === 'hi' ? 'चेक-आउट दर्ज करें' : 'Record Check-Out')
                              : isCheckedOut
                              ? (language === 'hi' ? 'पुनः सक्रिय करें' : 'Reactivate Stay')
                              : (language === 'hi' ? 'चेक-इन दर्ज करें' : 'Record Check-In')
                          }
                        >
                          {isInHouse ? (
                            <>
                              <LogOut className="w-4 h-4" />
                              <span>{language === 'hi' ? 'चेक-आउट' : 'Check-Out'}</span>
                            </>
                          ) : (
                            <>
                              <LogIn className="w-4 h-4" />
                              <span>{language === 'hi' ? 'चेक-इन' : 'Check-In'}</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* 2. Secondary Actions Row: Clean 3-column equal grid on Mobile, Inline flex on Desktop */}
                      <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                        {/* Collection Action */}
                        {(isAdmin || isOperator) && onOpenRecordCollection && (
                          <button
                            type="button"
                            onClick={() => onOpenRecordCollection(stay.primaryBooking)}
                            className="h-9 px-1.5 sm:px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
                            title={language === 'hi' ? 'किराया व भोजन कलेक्शन दर्ज करें' : 'Record Collection'}
                          >
                            <IndianRupee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>{language === 'hi' ? 'कलेक्शन' : 'Collection'}</span>
                          </button>
                        )}

                        {/* Allotment Letter */}
                        <button
                          type="button"
                          onClick={() => onOpenLetter(stay.primaryBooking)}
                          className="h-9 px-1.5 sm:px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
                          title={language === 'hi' ? 'आवंटन पत्र देखें' : 'View Letter'}
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{language === 'hi' ? 'पत्र' : 'Letter'}</span>
                        </button>

                        {/* Edit / Extend Button (Admin Only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onEditBooking(stay.primaryBooking)}
                            className="h-9 px-1.5 sm:px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
                            title={language === 'hi' ? 'विवरण संशोधित करें अथवा समय बढ़ाएं' : 'Edit Booking or Extend Time'}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span>{stay.isHourly ? (language === 'hi' ? 'समय बढ़ाएं' : 'Extend') : (language === 'hi' ? 'संशोधित' : 'Edit')}</span>
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Progressive Rendering Pagination Bar */}
          {filteredStays.length > visibleLimit && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl animate-in fade-in duration-150">
              <div className="text-xs text-slate-600 font-medium">
                {language === 'hi'
                  ? `कुल ${filteredStays.length} में से ${Math.min(visibleLimit, filteredStays.length)} रिकॉर्ड्स प्रदर्शित हैं।`
                  : `Showing ${Math.min(visibleLimit, filteredStays.length)} of ${filteredStays.length} records.`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVisibleLimit((prev) => prev + 30)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                >
                  {language === 'hi'
                    ? `+${Math.min(30, filteredStays.length - visibleLimit)} और रिकॉर्ड्स देखें`
                    : `Load +${Math.min(30, filteredStays.length - visibleLimit)} More`}
                </button>
                <button
                  onClick={() => setVisibleLimit(filteredStays.length)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  {language === 'hi' ? 'सभी देखें' : 'Show All'}
                </button>
              </div>
            </div>
          )}
        </>
        )}
      </div>

      {/* Interactive Lifecycle Modal: Check-In / Check-Out with Date & Time Selection */}
      {lifecycleModal && (
        <div 
          onClick={() => setLifecycleModal(null)}
          className="fixed inset-0 z-50 p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className={`px-5 py-3.5 text-white flex items-center justify-between border-b ${
              lifecycleModal.action === 'CHECK_IN' ? 'bg-emerald-700 border-emerald-800' : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                {lifecycleModal.action === 'CHECK_IN' ? (
                  <LogIn className="w-5 h-5 text-emerald-300" />
                ) : (
                  <LogOut className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    {lifecycleModal.action === 'CHECK_IN'
                      ? (language === 'hi' ? 'अतिथि चेक-इन दर्ज करें' : 'Record Guest Check-In')
                      : (language === 'hi' ? 'अतिथि चेक-आउट दर्ज करें' : 'Record Guest Check-Out')}
                  </h3>
                  <div className="text-[11px] text-slate-200">
                    {lifecycleModal.stay.groupId} {lifecycleModal.stay.dispatchNo ? `(#${lifecycleModal.stay.dispatchNo})` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLifecycleModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Guest Summary Info */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="font-bold text-slate-900 text-sm">
                {lifecycleModal.stay.guestName}
              </div>
              <div className="text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                <span>{lifecycleModal.stay.reference}</span>
                <span>•</span>
                <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  {lifecycleModal.stay.suits.join(', ')}
                </span>
                <span>•</span>
                <span>{lifecycleModal.stay.stayNights} {language === 'hi' ? 'दिन का ठहराव' : 'Day Stay'}</span>
              </div>
            </div>

            {/* Form Fields: Date & Time */}
            <div className="p-5 space-y-4">
              {/* Date Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  {lifecycleModal.action === 'CHECK_IN'
                    ? (language === 'hi' ? 'चेक-इन तारीख (Check-In Date)' : 'Check-In Date')
                    : (language === 'hi' ? 'चेक-आउट तारीख (Check-Out Date)' : 'Check-Out Date')}
                </label>
                <input
                  type="date"
                  value={lifecycleModal.date}
                  onChange={(e) => setLifecycleModal({ ...lifecycleModal, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white font-medium"
                />
              </div>

              {/* Time Input with Quick Buttons */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {lifecycleModal.action === 'CHECK_IN'
                      ? (language === 'hi' ? 'चेक-इन समय (Check-In Time)' : 'Check-In Time')
                      : (language === 'hi' ? 'चेक-आउट समय (Check-Out Time)' : 'Check-Out Time')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setLifecycleModal({ ...lifecycleModal, time: getCurrentFormattedTime() })}
                    className="text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded cursor-pointer transition"
                  >
                    ⚡ {language === 'hi' ? 'अभी का समय (Now)' : 'Now'}
                  </button>
                </div>
                <input
                  type="text"
                  value={lifecycleModal.time}
                  onChange={(e) => setLifecycleModal({ ...lifecycleModal, time: e.target.value })}
                  placeholder="12:00 PM"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white font-mono font-medium"
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  {['10:00 AM', '12:00 PM', '02:00 PM', '06:00 PM'].map((tVal) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setLifecycleModal({ ...lifecycleModal, time: tVal })}
                      className={`text-[10px] px-2 py-0.5 rounded border transition cursor-pointer ${
                        lifecycleModal.time === tVal
                          ? 'bg-amber-500 text-white border-amber-600 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {tVal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply to All Dates Checkbox */}
              {lifecycleModal.stay.stayNights > 1 && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={lifecycleModal.applyAll}
                      onChange={(e) => setLifecycleModal({ ...lifecycleModal, applyAll: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span>{language === 'hi' ? 'इस प्रवास के सभी दिनों पर लागू करें' : 'Apply to all dates of this stay'}</span>
                  </label>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLifecycleModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmLifecycleModal}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5 ${
                  lifecycleModal.action === 'CHECK_IN'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {lifecycleModal.action === 'CHECK_IN'
                    ? (language === 'hi' ? 'चेक-इन दर्ज करें (Confirm)' : 'Confirm Check-In')
                    : (language === 'hi' ? 'चेक-आउट दर्ज करें (Confirm)' : 'Confirm Check-Out')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
