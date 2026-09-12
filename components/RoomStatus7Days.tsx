'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import {
  formatToDisplayDate,
  formatToHindiDate,
  formatToISODate,
  getDayOfWeekName,
} from '@/lib/dateUtils';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  BedDouble,
  Plus,
  CalendarCheck,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface RoomStatus7DaysProps {
  bookings: Booking[];
  isAdmin: boolean;
  onSelectBooking: (booking: Booking) => void;
  onQuickBook?: (dateStr: string, suitKey: string) => void;
}

export const RoomStatus7Days: React.FC<RoomStatus7DaysProps> = ({
  bookings,
  isAdmin,
  onSelectBooking,
  onQuickBook,
}) => {
  const { language, t } = useLanguage();
  const todayStr = formatToISODate(new Date());

  // Starting date for the 7-day window (default: today)
  const [startDateStr, setStartDateStr] = useState<string>(todayStr);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Generate the 7 consecutive days starting from startDateStr
  const sevenDays = useMemo(() => {
    const list: string[] = [];
    const base = new Date(startDateStr + 'T00:00:00');
    if (isNaN(base.getTime())) {
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        list.push(formatToISODate(d));
      }
      return list;
    }

    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(formatToISODate(d));
    }
    return list;
  }, [startDateStr]);

  // Navigation handlers
  const handlePrev7Days = () => {
    const current = new Date(startDateStr + 'T00:00:00');
    current.setDate(current.getDate() - 7);
    setStartDateStr(formatToISODate(current));
  };

  const handleNext7Days = () => {
    const current = new Date(startDateStr + 'T00:00:00');
    current.setDate(current.getDate() + 7);
    setStartDateStr(formatToISODate(current));
  };

  const handleResetToday = () => {
    setStartDateStr(todayStr);
  };

  const handleOpenCalendar = () => {
    try {
      if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current?.focus();
      }
    } catch {
      dateInputRef.current?.focus();
    }
  };

  // Helper to find a booking for a specific suite on a specific date
  const getBookingForSuitOnDate = (suitKey: string, dateStr: string): Booking | undefined => {
    return bookings.find(
      (b) =>
        b.booking_date === dateStr &&
        b.status !== 'CANCELLED' &&
        Number(b[suitKey as keyof Booking]) > 0
    );
  };

  // Group suites for a date with comma separation (e.g. "Suit 2, Suit 3")
  const getDateOccupancyGroups = (dateStr: string) => {
    const dayBookings = bookings.filter(
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

    // Add available suits
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

  const endDateStr = sevenDays[sixDaysLength(sevenDays)];
  function sixDaysLength(arr: string[]) {
    return arr.length > 0 ? arr.length - 1 : 0;
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Header Card with Date Range Navigation */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border-t-2 border-amber-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Title & Date Range Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 p-2.5 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Calendar className="w-full h-full stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-wide text-white">
                  {language === 'hi' ? 'कमरों की स्थिति (आगामी 7 दिवस)' : 'Room Status (Next 7 Days)'}
                </h2>
                {startDateStr === todayStr && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                    {language === 'hi' ? 'आज से शुरू' : 'Starting Today'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {language === 'hi'
                  ? `${formatToHindiDate(sevenDays[0])} से ${formatToHindiDate(endDateStr)} तक का आवंटन चार्ट`
                  : `Occupancy chart from ${formatToDisplayDate(sevenDays[0])} to ${formatToDisplayDate(endDateStr)}`}
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 self-end md:self-center">
            
            {/* Previous 7 Days */}
            <button
              onClick={handlePrev7Days}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition shadow-xs active:scale-95"
              title="पिछले 7 दिन देखें"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'hi' ? 'पिछला' : 'Prev'}</span>
            </button>

            {/* Date Picker Button */}
            <div className="relative">
              <button
                type="button"
                onClick={handleOpenCalendar}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition shadow-xs"
              >
                <span>{formatToDisplayDate(sevenDays[0])}</span>
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <input
                ref={dateInputRef}
                type="date"
                value={startDateStr}
                onChange={(e) => {
                  if (e.target.value) setStartDateStr(e.target.value);
                }}
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                aria-label="Select start date"
              />
            </div>

            {/* Today Reset Button */}
            <button
              onClick={handleResetToday}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition shadow-xs active:scale-95 ${
                startDateStr === todayStr
                  ? 'bg-amber-400 text-slate-950 shadow-amber-400/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {language === 'hi' ? 'आज (Today)' : 'Today'}
            </button>

            {/* Next 7 Days */}
            <button
              onClick={handleNext7Days}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition shadow-xs active:scale-95"
              title="अगले 7 दिन देखें"
            >
              <span className="hidden sm:inline">{language === 'hi' ? 'अगला' : 'Next'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Quick Week Overview Bar (7 Mini Day Badges) */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mt-4 pt-3 border-t border-slate-800">
          {sevenDays.map((dStr) => {
            let occupied = 0;
            SUITS.forEach((s) => {
              if (getBookingForSuitOnDate(s.id, dStr)) occupied++;
            });

            const isToday = dStr === todayStr;
            const dayName = getDayOfWeekName(dStr, language === 'hi' ? 'hi' : 'en');
            const dayNum = dStr.split('-')[2];

            return (
              <div
                key={`mini-${dStr}`}
                className={`rounded-xl p-1.5 sm:p-2 text-center transition border ${
                  isToday
                    ? 'bg-amber-500/20 border-amber-400/80 ring-1 ring-amber-400/40'
                    : 'bg-slate-800/60 border-slate-700/80'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 truncate">
                  {dayName.slice(0, 3)}
                </div>
                <div className="text-sm sm:text-base font-black text-white mt-0.5">
                  {dayNum}
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-block text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                      occupied === 4
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : occupied > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {occupied}/4
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Day-by-Day 7 Days Suite Cards */}
      <div className="space-y-6">
        {sevenDays.map((dateStr, dayIndex) => {
          const isToday = dateStr === todayStr;
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const isTomorrow = dateStr === formatToISODate(tomorrow);

          const dayHindi = getDayOfWeekName(dateStr, 'hi');
          const dayEnglish = getDayOfWeekName(dateStr, 'en');
          const dayLabel = language === 'hi' ? dayHindi : dayEnglish;

          // Calculate occupied suits for this date
          let dayOccupiedCount = 0;
          SUITS.forEach((s) => {
            if (getBookingForSuitOnDate(s.id, dateStr)) dayOccupiedCount++;
          });

          return (
            <div
              key={dateStr}
              className={`bg-white rounded-2xl border transition shadow-xs overflow-hidden ${
                isToday
                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                  : 'border-slate-200'
              }`}
            >
              {/* Day Section Header Bar */}
              <div
                className={`px-4 sm:px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  isToday
                    ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                      isToday
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-200 text-slate-700 font-bold'
                    }`}
                  >
                    {dayIndex + 1}
                  </div>

                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>
                      {language === 'hi' ? formatToHindiDate(dateStr) : formatToDisplayDate(dateStr)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      ({dayLabel})
                    </span>
                  </h3>

                  {isToday && (
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-400 text-slate-950 shadow-2xs">
                      {language === 'hi' ? 'आज (Today)' : 'Today'}
                    </span>
                  )}

                  {isTomorrow && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                      {language === 'hi' ? 'कल (Tomorrow)' : 'Tomorrow'}
                    </span>
                  )}
                </div>

                {/* Day Occupancy Tag */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                      dayOccupiedCount === 4
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : dayOccupiedCount > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <BedDouble className="w-3.5 h-3.5" />
                    <span>
                      {dayOccupiedCount}/4 {language === 'hi' ? 'आरक्षित' : 'Booked'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold">
                      {dayOccupiedCount === 4
                        ? language === 'hi'
                          ? 'पूर्ण आरक्षित'
                          : 'Fully Booked'
                        : `${4 - dayOccupiedCount} ${language === 'hi' ? 'खाली' : 'Available'}`}
                    </span>
                  </span>
                </div>
              </div>

              {/* Suite Tiles Grid for this day (Grouped with comma) */}
              <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {getDateOccupancyGroups(dateStr).map((group) => {
                  const allFourEmpty = group.isAvailable && group.suitIds.length === 4;

                  return (
                    <div
                      key={group.id}
                      className={`relative rounded-xl border p-3.5 flex flex-col justify-between transition min-h-[140px] ${
                        allFourEmpty ? 'sm:col-span-2 lg:col-span-3 xl:col-span-4' : ''
                      } ${
                        group.isAvailable
                          ? 'bg-emerald-50/30 border-emerald-300/80 hover:border-emerald-400 hover:bg-emerald-50/60'
                          : group.isInHouse
                          ? 'bg-blue-50/40 border-blue-300 hover:border-blue-400'
                          : 'bg-rose-50/30 border-rose-300/80 hover:border-rose-400'
                      }`}
                    >
                      {/* Top Row: Suite Title & Status Badge */}
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 tracking-wide">
                              {group.suitNames}
                            </span>
                            {group.suitIds.length > 1 && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700">
                                {group.suitIds.length} कमरे
                              </span>
                            )}
                          </div>

                          {group.isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{language === 'hi' ? 'उपलब्ध' : 'Available'}</span>
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                group.isInHouse
                                  ? 'text-blue-800 bg-blue-100 border-blue-300'
                                  : 'text-rose-800 bg-rose-100 border-rose-300'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              <span>{group.isInHouse ? 'IN HOUSE' : 'CONFIRMED'}</span>
                            </span>
                          )}
                        </div>

                        {/* Middle Content: Available prompt OR Guest/Officer Details */}
                        <div className="mt-3">
                          {group.isAvailable ? (
                            <div className="py-2 text-center text-slate-400">
                              <p className="text-xs font-medium text-emerald-700/80">
                                {language === 'hi'
                                  ? allFourEmpty
                                    ? 'सभी 4 कमरे आवंटन हेतु रिक्त हैं'
                                    : `${group.suitNames} आवंटन हेतु रिक्त हैं`
                                  : `${group.suitNames} ready for allotment`}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs font-black text-slate-900 leading-tight truncate">
                                {group.booking?.guest_name}
                              </p>
                              {group.booking?.reference && (
                                <p className="text-[11px] font-semibold text-slate-600 truncate flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>{group.booking.reference}</span>
                                </p>
                              )}
                              {group.booking?.mobile_number && (
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {group.booking.mobile_number}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Quick Book or View Letter Button */}
                      <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-center justify-between">
                        {group.isAvailable ? (
                          isAdmin && onQuickBook ? (
                            <div className="w-full flex items-center gap-1.5 flex-wrap">
                              {group.suitIds.length === 1 ? (
                                <button
                                  type="button"
                                  onClick={() => onQuickBook(dateStr, group.suitIds[0])}
                                  className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-2xs active:scale-95"
                                >
                                  <Plus className="w-3 h-3 stroke-[2.5]" />
                                  <span>{language === 'hi' ? 'त्वरित बुकिंग' : 'Quick Book'}</span>
                                </button>
                              ) : (
                                group.suitIds.map((sid) => {
                                  const sObj = SUITS.find((s) => s.id === sid);
                                  return (
                                    <button
                                      key={sid}
                                      type="button"
                                      onClick={() => onQuickBook(dateStr, sid)}
                                      className="flex-1 min-w-[75px] flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-2xs active:scale-95"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                      <span>{sObj?.name || sid}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-semibold w-full text-center">
                              {language === 'hi' ? 'आरक्षण हेतु खुला' : 'Open for booking'}
                            </span>
                          )
                        ) : (
                          <div className="w-full flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => group.booking && onSelectBooking(group.booking)}
                              className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{language === 'hi' ? 'आवंटन पत्र' : 'Official Letter'}</span>
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

      {/* 3. Status Legend Footer */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 text-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-slate-600">{language === 'hi' ? 'संकेत विवरण:' : 'Status Legend:'}</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>{language === 'hi' ? 'उपलब्ध (Available)' : 'Available'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>{language === 'hi' ? 'आरक्षित (Confirmed)' : 'Confirmed'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>{language === 'hi' ? 'इन-हाउस (In House)' : 'In House'}</span>
          </span>
        </div>

        <p className="text-[11px] text-slate-400">
          पुलिस ऑफिसर्स गेस्ट हाउस (POGH), अयोध्या • आगामी 7-दिवसीय कक्ष स्थिति
        </p>
      </div>

    </div>
  );
};
