'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Booking } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import {
  formatToDisplayDate,
  formatToHindiDate,
  formatToISODate,
  getDayOfWeekName,
} from '@/lib/dateUtils';
import {
  Calendar,
  CheckCircle2,
  FileText,
  BedDouble,
  Plus,
  Search,
  History,
  Sparkles,
  ArrowUpDown,
  Filter,
  ChevronDown,
  Wrench,
  Clock,
  CalendarCheck,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface DateWiseRoomScheduleProps {
  bookings: Booking[];
  isAdmin: boolean;
  onSelectBooking: (booking: Booking) => void;
  onQuickBook?: (dateStr: string, suitKey: string) => void;
}

type TabFilter = 'upcoming' | 'past' | 'all' | 'booked_only';

export const DateWiseRoomSchedule: React.FC<DateWiseRoomScheduleProps> = ({
  bookings,
  isAdmin,
  onSelectBooking,
  onQuickBook,
}) => {
  const { language } = useLanguage();
  const todayStr = formatToISODate(new Date());

  // Filter & Search states
  const [activeFilter, setActiveFilter] = useState<TabFilter>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSuitFilter, setSelectedSuitFilter] = useState<string>('all');
  const [sortAscending, setSortAscending] = useState<boolean>(true);
  const [jumpDate, setJumpDate] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(20);

  const datePickerRef = useRef<HTMLInputElement>(null);

  // Helper to find booking for a suit on a specific date
  const getBookingForSuitOnDate = (suitKey: string, dateStr: string): Booking | undefined => {
    return bookings.find(
      (b) =>
        b.booking_date === dateStr &&
        b.status !== 'CANCELLED' &&
        Number(b[suitKey as keyof Booking]) > 0
    );
  };

  // Group suites for a date with comma separation (e.g. "Suit 2, Suit 3") to eliminate duplicacy
  const getDateOccupancyGroups = (dateStr: string, allBookings: Booking[]) => {
    const dayBookings = allBookings.filter(
      (b) => b.booking_date === dateStr && b.status !== 'CANCELLED'
    );

    const occupiedSuitIds = new Set<string>();

    interface GuestGroup {
      primaryBooking: Booking;
      suitIds: string[];
      isMaintenance: boolean;
      isInHouse: boolean;
    }

    const guestGroups: GuestGroup[] = [];

    dayBookings.forEach((b) => {
      const bSuits: string[] = [];
      SUITS.forEach((s) => {
        if (Number(b[s.id as keyof Booking]) > 0) {
          bSuits.push(s.id);
        }
      });

      if (bSuits.length === 0) return;

      const guestKey = `${b.guest_name.trim().toLowerCase()}_${b.mobile_number.trim()}`;
      const existing = guestGroups.find((g) => {
        const gKey = `${g.primaryBooking.guest_name.trim().toLowerCase()}_${g.primaryBooking.mobile_number.trim()}`;
        return gKey === guestKey;
      });

      if (existing) {
        bSuits.forEach((sid) => {
          if (!existing.suitIds.includes(sid)) {
            existing.suitIds.push(sid);
          }
        });
        bSuits.forEach((sid) => occupiedSuitIds.add(sid));
      } else {
        bSuits.forEach((sid) => occupiedSuitIds.add(sid));
        guestGroups.push({
          primaryBooking: b,
          suitIds: bSuits,
          isMaintenance: b.status === 'MAINTENANCE' || b.is_maintenance,
          isInHouse: b.status === 'CHECKED_IN',
        });
      }
    });

    const result: Array<{
      id: string;
      isAvailable: boolean;
      isMaintenance: boolean;
      isInHouse: boolean;
      suitIds: string[];
      suitNames: string;
      booking?: Booking;
    }> = [];

    // Add occupied groups
    guestGroups.forEach((g) => {
      g.suitIds.sort((a, b) => a.localeCompare(b));
      const suitNameList = g.suitIds.map((sid) => {
        const found = SUITS.find((s) => s.id === sid);
        return found ? found.name : sid;
      });

      result.push({
        id: `booked-${g.primaryBooking.id}-${g.suitIds.join('-')}`,
        isAvailable: false,
        isMaintenance: g.isMaintenance,
        isInHouse: g.isInHouse,
        suitIds: g.suitIds,
        suitNames: suitNameList.join(', '),
        booking: g.primaryBooking,
      });
    });

    // Add available suits grouped with comma
    const availableSuits = SUITS.filter((s) => !occupiedSuitIds.has(s.id));
    if (availableSuits.length > 0) {
      const suitNames = availableSuits.map((s) => s.name).join(', ');
      result.push({
        id: `available-${dateStr}-${availableSuits.map((s) => s.id).join('-')}`,
        isAvailable: true,
        isMaintenance: false,
        isInHouse: false,
        suitIds: availableSuits.map((s) => s.id),
        suitNames: suitNames,
      });
    }

    return result;
  };

  // Find range of dates with existing bookings
  const { minBookedDate, maxBookedDate, bookedDatesSet } = useMemo(() => {
    const dates: string[] = [];
    const set = new Set<string>();

    bookings.forEach((b) => {
      if (b.status !== 'CANCELLED' && b.booking_date) {
        dates.push(b.booking_date);
        set.add(b.booking_date);
      }
    });

    dates.sort();
    return {
      minBookedDate: dates.length > 0 ? dates[0] : todayStr,
      maxBookedDate: dates.length > 0 ? dates[dates.length - 1] : todayStr,
      bookedDatesSet: set,
    };
  }, [bookings, todayStr]);

  // Generate master date sequence covering past history and future forecast
  const masterDates = useMemo(() => {
    const list: string[] = [];

    // Calculate start date: 30 days before today OR earliest booking date, whichever is earlier
    const start = new Date(todayStr + 'T00:00:00');
    start.setDate(start.getDate() - 30);
    const minBooked = new Date(minBookedDate + 'T00:00:00');
    const actualStart = minBooked < start ? minBooked : start;

    // Calculate end date: 60 days after today OR latest booking date, whichever is later
    const end = new Date(todayStr + 'T00:00:00');
    end.setDate(end.getDate() + 60);
    const maxBooked = new Date(maxBookedDate + 'T00:00:00');
    const actualEnd = maxBooked > end ? maxBooked : end;

    const curr = new Date(actualStart);
    while (curr <= actualEnd) {
      list.push(formatToISODate(curr));
      curr.setDate(curr.getDate() + 1);
    }

    return list;
  }, [minBookedDate, maxBookedDate, todayStr]);

  // Filter and sort the dates based on user selection
  const filteredDates = useMemo(() => {
    let result = masterDates;

    // 1. Primary Tab Filter
    if (activeFilter === 'upcoming') {
      result = result.filter((d) => d >= todayStr);
    } else if (activeFilter === 'past') {
      result = result.filter((d) => d < todayStr);
    } else if (activeFilter === 'booked_only') {
      result = result.filter((d) => bookedDatesSet.has(d));
    }

    // 2. Search query filter (search in date, guest name, mobile, reference)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        // Match date string
        if (d.includes(q)) return true;
        const displayDate = formatToDisplayDate(d).toLowerCase();
        if (displayDate.includes(q)) return true;
        const hindiDate = formatToHindiDate(d).toLowerCase();
        if (hindiDate.includes(q)) return true;

        // Match any booking on this date
        const dayBookings = bookings.filter(
          (b) => b.booking_date === d && b.status !== 'CANCELLED'
        );
        return dayBookings.some(
          (b) =>
            b.guest_name.toLowerCase().includes(q) ||
            b.mobile_number.includes(q) ||
            b.reference.toLowerCase().includes(q) ||
            (b.dispatch_no && b.dispatch_no.toLowerCase().includes(q))
        );
      });
    }

    // 3. Suit filter (if specific suit selected)
    if (selectedSuitFilter !== 'all') {
      // Keep dates where that suit has status or user searched
    }

    // 4. Sort order
    const sorted = [...result];
    if (activeFilter === 'past') {
      // Past dates default to newest-first (yesterday down to earlier)
      sorted.sort((a, b) => (sortAscending ? a.localeCompare(b) : b.localeCompare(a)));
    } else {
      // Upcoming and all dates default to chronological (today -> tomorrow -> future)
      sorted.sort((a, b) => (sortAscending ? a.localeCompare(b) : b.localeCompare(a)));
    }

    return sorted;
  }, [
    masterDates,
    activeFilter,
    todayStr,
    bookedDatesSet,
    searchQuery,
    selectedSuitFilter,
    sortAscending,
    bookings,
  ]);

  // Key stats for summary banner
  const stats = useMemo(() => {
    let todayOccupied = 0;
    SUITS.forEach((s) => {
      if (getBookingForSuitOnDate(s.id, todayStr)) todayOccupied++;
    });

    const upcomingBookedDaysCount = Array.from(bookedDatesSet).filter((d) => d >= todayStr).length;
    const pastBookedDaysCount = Array.from(bookedDatesSet).filter((d) => d < todayStr).length;

    return {
      todayOccupied,
      todayAvailable: 4 - todayOccupied,
      upcomingBookedDaysCount,
      pastBookedDaysCount,
    };
  }, [bookings, todayStr, bookedDatesSet]);

  // Visible subset for smooth performance
  const visibleDates = useMemo(() => {
    return filteredDates.slice(0, visibleCount);
  }, [filteredDates, visibleCount]);

  const handleOpenCalendarPicker = () => {
    try {
      if (datePickerRef.current && 'showPicker' in datePickerRef.current) {
        datePickerRef.current.showPicker();
      } else {
        datePickerRef.current?.focus();
      }
    } catch {
      datePickerRef.current?.focus();
    }
  };

  const handleDateJump = (val: string) => {
    setJumpDate(val);
    if (!val) return;
    setSearchQuery(val);
    setActiveFilter('all');
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Header & Filter Command Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border-t-2 border-amber-500">
        
        {/* Top Title & Live Summary Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 p-2 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Calendar className="w-full h-full stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">
                  {language === 'hi'
                    ? 'दैनिक कमरा स्थिति व उपलब्धता'
                    : 'Daily Room Status & Availability'}
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  {language === 'hi'
                    ? 'प्रत्येक तारीख के अनुसार चारों कमरों (Suit 1 से 4) की बुकिंग एवं खाली स्थिति (भूतकाल एवं भविष्य)'
                    : 'Occupancy and vacancy schedule for all 4 suits date-by-date (Past & Future)'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Realtime Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/80 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400">आज खाली:</span>
              <span className="font-black text-emerald-400">{stats.todayAvailable} कमरा</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/80 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span className="text-slate-400">आज बुक:</span>
              <span className="font-black text-rose-400">{stats.todayOccupied} कमरा</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-200">आगामी आरक्षित दिन:</span>
              <span className="font-black text-amber-400">{stats.upcomingBookedDaysCount}</span>
            </div>
          </div>
        </div>

        {/* Filter Navigation Tabs + Search + Date Jump Bar */}
        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Main Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 overflow-x-auto">
            <button
              onClick={() => {
                setActiveFilter('upcoming');
                setSortAscending(true);
                setVisibleCount(20);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeFilter === 'upcoming'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'आगामी व आज' : 'Upcoming & Today'}</span>
            </button>

            <button
              onClick={() => {
                setActiveFilter('past');
                setSortAscending(false); // Newest past first
                setVisibleCount(20);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeFilter === 'past'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'पिछली तारीखें' : 'Past Dates'}</span>
              <span className="text-[10px] opacity-75 font-mono">({stats.pastBookedDaysCount})</span>
            </button>

            <button
              onClick={() => {
                setActiveFilter('booked_only');
                setSortAscending(false);
                setVisibleCount(20);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeFilter === 'booked_only'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'केवल आरक्षित' : 'Booked Only'}</span>
            </button>

            <button
              onClick={() => {
                setActiveFilter('all');
                setSortAscending(true);
                setVisibleCount(20);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span>{language === 'hi' ? 'सभी तारीखें' : 'All Dates'}</span>
            </button>
          </div>

          {/* Search, Date Jump & Sort Toggle Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            
            {/* Live Search Input */}
            <div className="relative flex-1 sm:w-48 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={language === 'hi' ? 'अतिथि, फोन, तारीख...' : 'Search guest, phone...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Jump to Specific Date Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={handleOpenCalendarPicker}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-amber-500/40 hover:border-amber-400 text-amber-300 rounded-xl text-xs font-bold transition shadow-xs"
                title="सीधे किसी तारीख पर जाएं"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">तारीख चुनें</span>
              </button>
              <input
                ref={datePickerRef}
                type="date"
                value={jumpDate}
                onChange={(e) => handleDateJump(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                aria-label="Jump to date"
              />
            </div>

            {/* Sort Order Toggle */}
            <button
              onClick={() => setSortAscending(!sortAscending)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
              title={sortAscending ? 'क्रम: पुराना से नया' : 'क्रम: नया से पुराना'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono">{sortAscending ? 'ASC' : 'DESC'}</span>
            </button>
          </div>

        </div>

      </div>

      {/* 2. Date-Wise List of Days (Showing which room is booked or available) */}
      <div className="space-y-4">
        {visibleDates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">
              {language === 'hi' ? 'कोई तारीख नहीं मिली' : 'No dates found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `"${searchQuery}" के लिए कोई रिकॉर्ड उपलब्ध नहीं है। खोज फ़िल्टर रीसेट करें।`
                : 'चयनित फ़िल्टर के लिए कोई तारीख उपलब्ध नहीं है।'}
            </p>
            {(searchQuery || activeFilter !== 'upcoming') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('upcoming');
                  setSortAscending(true);
                }}
                className="mt-4 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition shadow-xs"
              >
                डिफ़ॉल्ट फ़िल्टर पर लौटें
              </button>
            )}
          </div>
        ) : (
          visibleDates.map((dateStr) => {
            const isToday = dateStr === todayStr;
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const isTomorrow = dateStr === formatToISODate(tomorrow);
            const isPast = dateStr < todayStr;

            const dayHindi = getDayOfWeekName(dateStr, 'hi');
            const dayEnglish = getDayOfWeekName(dateStr, 'en');
            const dayLabel = language === 'hi' ? dayHindi : dayEnglish;

            // Calculate occupancy for this date
            let occupiedCount = 0;
            SUITS.forEach((s) => {
              if (getBookingForSuitOnDate(s.id, dateStr)) occupiedCount++;
            });
            const availableCount = 4 - occupiedCount;

            return (
              <div
                key={dateStr}
                className={`bg-white rounded-2xl border transition shadow-xs hover:shadow-md overflow-hidden ${
                  isToday
                    ? 'border-amber-400 ring-2 ring-amber-400/30'
                    : isPast
                    ? 'border-slate-200/90'
                    : 'border-slate-200'
                }`}
              >
                {/* Date Row Header */}
                <div
                  className={`px-4 sm:px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isToday
                      ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-amber-200'
                      : isPast
                      ? 'bg-slate-50/80 border-slate-200'
                      : 'bg-slate-50/50 border-slate-200'
                  }`}
                >
                  {/* Left: Date, Day of Week, and Status Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    
                    {/* Date Pill */}
                    <div
                      className={`px-3 py-1 rounded-xl font-mono text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-2xs ${
                        isToday
                          ? 'bg-amber-400 text-slate-950'
                          : isPast
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-900 text-white'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatToDisplayDate(dateStr)}</span>
                    </div>

                    {/* Day of Week */}
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                      {dayLabel}
                    </span>

                    {/* Hindi Date Text */}
                    <span className="text-xs text-slate-500 font-medium hidden md:inline">
                      ({formatToHindiDate(dateStr)})
                    </span>

                    {/* Relative Date Tags */}
                    {isToday && (
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-400 text-slate-950 shadow-xs uppercase tracking-wider">
                        आज (Today)
                      </span>
                    )}

                    {isTomorrow && (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                        कल (Tomorrow)
                      </span>
                    )}

                    {isPast && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        बीती तारीख (Past)
                      </span>
                    )}
                  </div>

                  {/* Right: Occupancy Ratio Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 ${
                        occupiedCount === 4
                          ? 'bg-rose-50 text-rose-800 border-rose-200 font-black'
                          : occupiedCount > 0
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <BedDouble className="w-3.5 h-3.5" />
                      <span>
                        {occupiedCount}/4 {language === 'hi' ? 'आरक्षित' : 'Booked'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-extrabold">
                        {occupiedCount === 4
                          ? 'सभी कमरे बुक (Full)'
                          : `${availableCount} खाली (Available)`}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Suits Grid for this Date (Grouped with comma to eliminate duplicacy) */}
                <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {getDateOccupancyGroups(dateStr, bookings).map((group) => {
                    // CASE 1: AVAILABLE (खाली)
                    if (group.isAvailable) {
                      const allFourEmpty = group.suitIds.length === 4;
                      return (
                        <div
                          key={group.id}
                          className={`rounded-xl border p-3 sm:p-3.5 flex flex-col justify-between transition ${
                            isPast
                              ? 'border-slate-200 bg-slate-50/60'
                              : 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50/70'
                          } ${
                            allFourEmpty ? 'sm:col-span-2 lg:col-span-3 xl:col-span-4' : ''
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                <span>{group.suitNames}</span>
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 font-mono">
                                {isPast
                                  ? `${group.suitIds.length} कमरे खाली रहे`
                                  : group.suitIds.length === 1
                                  ? `₹${SUITS.find((s) => s.id === group.suitIds[0])?.rate || 800}/रात`
                                  : `${group.suitIds.length} कमरे`}
                              </span>
                            </div>

                            <div className={`my-2.5 flex items-center gap-1.5 ${isPast ? 'text-slate-500' : 'text-emerald-700'}`}>
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-extrabold">
                                {language === 'hi'
                                  ? isPast
                                    ? allFourEmpty
                                      ? 'सभी 4 कमरे खाली रहे थे (कोई बुकिंग नहीं)'
                                      : `${group.suitNames} खाली रहे थे`
                                    : allFourEmpty
                                    ? 'सभी 4 कमरे खाली (उपलब्ध)'
                                    : `${group.suitNames} खाली (उपलब्ध)`
                                  : isPast
                                  ? `${group.suitNames} was unoccupied`
                                  : `${group.suitNames} Available`}
                              </span>
                            </div>
                          </div>

                          {/* Quick booking button: ONLY FOR TODAY & FUTURE (Never in the past!) */}
                          {!isPast ? (
                            isAdmin && onQuickBook ? (
                              <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center gap-1.5 flex-wrap">
                                {group.suitIds.length === 1 ? (
                                  <button
                                    onClick={() => onQuickBook(dateStr, group.suitIds[0])}
                                    className="w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs active:scale-95"
                                    title={`${formatToDisplayDate(dateStr)} के लिए ${group.suitNames} बुक करें`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{language === 'hi' ? '+ बुक करें' : '+ Quick Book'}</span>
                                  </button>
                                ) : (
                                  group.suitIds.map((sid) => {
                                    const sObj = SUITS.find((s) => s.id === sid);
                                    return (
                                      <button
                                        key={sid}
                                        onClick={() => onQuickBook(dateStr, sid)}
                                        className="flex-1 min-w-[75px] py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-2xs active:scale-95"
                                        title={`${formatToDisplayDate(dateStr)} के लिए ${sObj?.name || sid} बुक करें`}
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                        <span>{sObj?.name || sid}</span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            ) : null
                          ) : (
                            <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                              <span>बीती तारीख (Past Date)</span>
                              <span>अनावंटित</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // CASE 2: MAINTENANCE
                    if (group.isMaintenance) {
                      return (
                        <div
                          key={group.id}
                          onClick={() => group.booking && onSelectBooking(group.booking)}
                          className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 sm:p-3.5 flex flex-col justify-between transition cursor-pointer hover:border-purple-300 shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-purple-100">
                              <span className="text-xs font-black text-purple-950">
                                {group.suitNames}
                              </span>
                              <span className="text-[10px] font-bold text-purple-700">
                                ब्लॉक
                              </span>
                            </div>
                            <div className="my-2 flex items-center gap-1.5 text-purple-800">
                              <Wrench className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-xs font-bold">मरम्मत / रखरखाव</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-purple-600 truncate mt-1">
                            {group.booking?.notes || 'कमरा मरम्मत कार्य हेतु बंद है'}
                          </p>
                        </div>
                      );
                    }

                    // CASE 3: BOOKED OR IN-HOUSE (With Comma separated suits e.g. "Suit 2, Suit 3")
                    return (
                      <div
                        key={group.id}
                        className={`rounded-xl border p-3 sm:p-3.5 flex flex-col justify-between transition ${
                          group.isInHouse
                            ? 'border-blue-200 bg-blue-50/50 hover:border-blue-300'
                            : 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                        }`}
                      >
                        <div>
                          {/* Suite Title with Comma & Status Badge */}
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-900 tracking-wide">
                                {group.suitNames}
                              </span>
                              {group.suitIds.length > 1 && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                                  {group.suitIds.length} कमरे
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                group.isInHouse
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {group.isInHouse
                                ? language === 'hi'
                                  ? 'इन-हाउस'
                                  : 'In House'
                                : language === 'hi'
                                ? 'आरक्षित'
                                : 'Confirmed'}
                            </span>
                          </div>

                          {/* Guest Name & Reference */}
                          <div className="my-2">
                            <h4 className="text-xs font-black text-slate-900 truncate leading-snug">
                              {group.booking?.guest_name}
                            </h4>
                            <div className="flex items-center justify-between text-[11px] text-slate-600 mt-0.5 font-medium">
                              <span className="font-mono">{group.booking?.mobile_number}</span>
                              <span className="text-slate-400">•</span>
                              <span className="font-bold text-amber-700 truncate max-w-[110px]">
                                {group.booking?.reference}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action: Open Official Letter Modal */}
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1">
                          <button
                            onClick={() => group.booking && onSelectBooking(group.booking)}
                            className="w-full py-1.5 px-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs hover:text-amber-700 active:scale-95"
                            title="आधिकारिक पत्र देखें एवं प्रिंट करें"
                          >
                            <FileText className="w-3 h-3 text-amber-600" />
                            <span>{language === 'hi' ? 'पत्र देखें' : 'View Letter'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Load More Dates Button (If there are more dates) */}
      {filteredDates.length > visibleCount && (
        <div className="text-center pt-2 pb-6">
          <button
            onClick={() => setVisibleCount((prev) => prev + 25)}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition shadow-md border border-slate-700 flex items-center gap-2 mx-auto active:scale-95"
          >
            <ChevronDown className="w-4 h-4 text-amber-400" />
            <span>
              {language === 'hi'
                ? `और 25 तारीखें देखें (शेष: ${filteredDates.length - visibleCount})`
                : `Load 25 More Dates (${filteredDates.length - visibleCount} remaining)`}
            </span>
          </button>
        </div>
      )}

      {/* 4. Legend Footer */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-slate-800">संकेतक (Legend):</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>खाली / उपलब्ध (Available)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>आरक्षित (Confirmed Booked)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>इन-हाउस (In-House)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            <span>मरम्मत (Maintenance)</span>
          </div>
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          पुलिस ऑफिसर्स गेस्ट हाउस (POGH) • अयोध्या
        </span>
      </div>

    </div>
  );
};
