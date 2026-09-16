'use client';

import React, { useMemo } from 'react';
import { Booking } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import { formatToISODate, formatToDisplayDate, formatToHindiDate } from '@/lib/dateUtils';
import {
  formatGuestDisplayName,
  cleanNotesText,
  isBookingOccupyingDate,
  isSuitAllocatedInBooking,
  extractGroupIdFromNotes,
} from '@/lib/bookingUtils';
import { useLanguage } from '@/lib/languageContext';
import {
  User,
  Phone,
  BedDouble,
  CheckCircle2,
  Clock,
  ArrowRight,
  LogIn,
  FileText,
  ShieldAlert,
} from 'lucide-react';

interface TodayActivityWidgetProps {
  bookings: Booking[];
  isAdmin: boolean;
  onSelectBooking: (booking: Booking) => void;
  onQuickBook?: (dateStr: string, suitKey: string) => void;
  onViewAllSchedule: () => void;
  onViewBookings: () => void;
}

export const TodayActivityWidget: React.FC<TodayActivityWidgetProps> = ({
  bookings,
  isAdmin,
  onSelectBooking,
  onQuickBook,
  onViewAllSchedule,
  onViewBookings,
}) => {
  const { language, t } = useLanguage();
  const todayStr = formatToISODate(new Date());

  // Today's active bookings (handles single-day records & multi-day spans)
  const todayBookings = useMemo(() => {
    const active = bookings.filter(
      (b) => (b.status || '').toUpperCase() !== 'CANCELLED' && isBookingOccupyingDate(b, todayStr)
    );
    // Deduplicate multi-day rows for the same stay/group so each guest stay appears once
    const seenGroups = new Set<string>();
    const uniqueBookings: Booking[] = [];
    active.forEach((b) => {
      const ref = b.group_id || extractGroupIdFromNotes(b.notes) || b.id;
      if (!seenGroups.has(ref)) {
        seenGroups.add(ref);
        const exact = active.find(
          (x) =>
            (x.group_id || extractGroupIdFromNotes(x.notes) || x.id) === ref &&
            x.booking_date === todayStr
        );
        uniqueBookings.push(exact || b);
      }
    });
    return uniqueBookings;
  }, [bookings, todayStr]);

  // Which rooms are occupied vs available today
  const { occupiedSuits, availableSuits } = useMemo(() => {
    const occupiedMap = new Map<string, Booking>();
    todayBookings.forEach((b) => {
      SUITS.forEach((s) => {
        if (isSuitAllocatedInBooking(b, s.id)) {
          occupiedMap.set(s.id, b);
        }
      });
    });

    const avail = SUITS.filter((s) => !occupiedMap.has(s.id));
    return { occupiedSuits: occupiedMap, availableSuits: avail };
  }, [todayBookings]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 font-sans">
      
      {/* Col 1 & 2: Today's Occupants & Booked Guests */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {language === 'hi' ? 'आज की गतिविधि व अतिथि' : "Today's Occupants & Activity"}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {language === 'hi' ? formatToHindiDate(todayStr) : formatToDisplayDate(todayStr)} • {todayBookings.length} {language === 'hi' ? 'आरक्षण सक्रिय' : 'active bookings'}
              </p>
            </div>
          </div>

          <button
            onClick={onViewBookings}
            className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 transition"
          >
            <span>{language === 'hi' ? 'पूरी पंजिका' : 'View All'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayBookings.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <BedDouble className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-600" />
            <p className="text-xs font-bold text-slate-600">
              {language === 'hi' ? 'आज कोई कमरा आरक्षित नहीं है (सभी 4 कमरे उपलब्ध हैं)।' : 'No rooms booked today (All 4 available).'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todayBookings.map((b) => {
              const suitsBooked: string[] = [];
              SUITS.forEach((s) => {
                if (Number(b[s.id as keyof Booking]) > 0) suitsBooked.push(s.name);
              });
              const isInHouse = b.status === 'CHECKED_IN';
              const cleanName = formatGuestDisplayName(b.guest_name);

              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBooking(b)}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer hover:shadow-xs ${
                    isInHouse
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {cleanName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isInHouse
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {isInHouse ? t('checkedIn') : t('confirmed')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                      <span>{b.mobile_number}</span>
                      {b.reference && (
                        <>
                          <span>•</span>
                          <span className="text-amber-800 font-semibold font-sans">{b.reference}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {suitsBooked.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded bg-white text-slate-800 text-[10px] font-bold border border-slate-200 shadow-2xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBooking(b);
                      }}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-blue-700 transition"
                      title={language === 'hi' ? 'आवंटन पत्र देखें' : 'View Allotment Letter'}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Col 3: Room Availability Quick Action */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {language === 'hi' ? 'कमरा उपलब्धता (आज)' : "Room Availability (Today)"}
            </h3>
            <span className="text-xs font-black text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {availableSuits.length}/4 {language === 'hi' ? 'खाली' : 'Free'}
            </span>
          </div>

          <div className="space-y-2">
            {SUITS.map((suit) => {
              const booking = occupiedSuits.get(suit.id);
              const isAvailable = !booking;

              return (
                <div
                  key={suit.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    isAvailable
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">{suit.name}</span>
                  </div>

                  {isAvailable ? (
                    isAdmin && onQuickBook ? (
                      <button
                        onClick={() => onQuickBook(todayStr, suit.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition shadow-2xs"
                      >
                        {language === 'hi' ? '+ बुक करें' : '+ Book'}
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{language === 'hi' ? 'उपलब्ध' : 'Available'}</span>
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 truncate max-w-[110px]">
                      {booking?.guest_name ? formatGuestDisplayName(booking.guest_name).split(' ')[1] || booking.guest_name : (language === 'hi' ? 'आरक्षित' : 'Reserved')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Link to Full Forecast & Calendar */}
        <button
          onClick={onViewAllSchedule}
          className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>{language === 'hi' ? 'आगामी 7-दिवसीय कमरा चार्ट देखें' : 'View 7-Day Room Chart'}</span>
          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
        </button>
      </div>

    </div>
  );
};
