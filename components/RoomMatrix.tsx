'use client';

import React, { useState } from 'react';
import { Booking } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import { formatToISODate } from '@/lib/dateUtils';
import { extractGroupIdFromNotes } from '@/lib/bookingUtils';
import { ChevronLeft, ChevronRight, Calendar, PlusCircle, CheckCircle2 } from 'lucide-react';

interface RoomMatrixProps {
  bookings: Booking[];
  isAdmin: boolean;
  selectedDate?: string;
  onSelectDate?: (dateStr: string) => void;
  onQuickBook: (dateStr: string, suitKey: string) => void;
  onSelectBooking: (booking: Booking) => void;
}

export const RoomMatrix: React.FC<RoomMatrixProps> = ({
  bookings,
  isAdmin,
  selectedDate,
  onSelectDate,
  onQuickBook,
  onSelectBooking,
}) => {
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const numDaysToShow = 7;

  const dateList: Date[] = [];
  for (let i = 0; i < numDaysToShow; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dateList.push(d);
  }

  const handlePrev = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() - numDaysToShow);
    setStartDate(d);
  };

  const handleNext = () => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + numDaysToShow);
    setStartDate(d);
  };

  const handleToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setStartDate(d);
    if (onSelectDate) {
      onSelectDate(formatToISODate(d));
    }
  };

  const getBookingForSuit = (dateStr: string, suitKey: string): Booking | undefined => {
    return bookings.find(
      (b) =>
        b.booking_date === dateStr &&
        b.status !== 'CANCELLED' &&
        Number(b[suitKey as keyof Booking]) > 0
    );
  };

  const todayStr = formatToISODate(new Date());

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden mb-6">
      {/* Matrix Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">
            कमरा उपलब्धता कैलेंडर (Room Occupancy Matrix)
          </h2>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition"
            title="पिछली तिथियां देखें"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
          >
            आज (Today)
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 transition"
            title="अगली तिथियां देखें"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Column Header: Dates */}
          <div className="grid grid-cols-[180px_repeat(7,1fr)] bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600">
            <div className="p-3 border-r border-slate-200 text-slate-700 uppercase tracking-wider flex items-center">
              कमरा / सूट
            </div>
            {dateList.map((d) => {
              const iso = formatToISODate(d);
              const isToday = iso === todayStr;
              const isSelected = selectedDate === iso;

              return (
                <div
                  key={iso}
                  onClick={() => onSelectDate && onSelectDate(iso)}
                  className={`p-2.5 text-center border-r last:border-r-0 border-slate-200 cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-amber-100/80 text-amber-950 font-black ring-2 ring-amber-500 ring-inset shadow-xs'
                      : isToday
                      ? 'bg-amber-50/70 text-amber-900 font-bold'
                      : 'hover:bg-slate-200/60'
                  }`}
                  title="Click to view full bookings for this date"
                >
                  <div className="text-[11px] text-slate-500">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-xs">{d.getDate()} {d.toLocaleDateString('en-US', { month: 'short' })}</div>
                  {isToday ? (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] bg-amber-500 text-white rounded font-bold">
                      TODAY
                    </span>
                  ) : isSelected ? (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] bg-slate-800 text-amber-300 rounded font-bold">
                      SELECTED
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Matrix Rows: Suits */}
          {SUITS.map((suit) => (
            <div
              key={suit.id}
              className="grid grid-cols-[180px_repeat(7,1fr)] border-b last:border-b-0 border-slate-200 text-sm hover:bg-slate-50/50 transition"
            >
              {/* Suit Info Column */}
              <div className="p-3 border-r border-slate-200 bg-slate-50/80 flex flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">{suit.name}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  ₹{suit.rate}/दिन
                </div>
              </div>

              {/* Day Cells */}
              {dateList.map((d) => {
                const iso = formatToISODate(d);
                const booking = getBookingForSuit(iso, suit.id);
                const isToday = iso === todayStr;
                const isSelected = selectedDate === iso;

                if (booking) {
                  const isInHouse = booking.status === 'CHECKED_IN';
                  const isCheckedOut = booking.status === 'CHECKED_OUT';
                  const refCode = booking.group_id || extractGroupIdFromNotes(booking.notes);

                  return (
                    <div
                      key={iso}
                      onClick={() => {
                        if (onSelectDate) onSelectDate(iso);
                        onSelectBooking(booking);
                      }}
                      className={`p-2 border-r last:border-r-0 border-slate-200 cursor-pointer transition hover:opacity-90 ${
                        isSelected ? 'bg-amber-100/50' : isInHouse ? 'bg-emerald-50/70' : isCheckedOut ? 'bg-slate-100/70' : 'bg-rose-50/40'
                      }`}
                      title={`Booked for ${booking.guest_name} - Click to view letter & details`}
                    >
                      <div
                        className={`h-full rounded-lg p-2 border flex flex-col justify-between shadow-xs ${
                          isInHouse
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-950'
                            : isCheckedOut
                            ? 'bg-slate-200 border-slate-300 text-slate-700'
                            : 'bg-rose-100 border-rose-200 text-rose-900'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="truncate max-w-[65px]">{booking.reference || 'VIP'}</span>
                            <span
                              className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                                isInHouse
                                  ? 'bg-emerald-600 text-white'
                                  : isCheckedOut
                                  ? 'bg-slate-400 text-white'
                                  : 'bg-rose-200 text-rose-800'
                              }`}
                            >
                              {isInHouse ? 'IN HOUSE' : isCheckedOut ? 'OUT' : 'BOOKED'}
                            </span>
                          </div>
                          <div className="text-xs font-semibold truncate mt-1">
                            {booking.guest_name}
                          </div>
                        </div>
                        <div className="text-[10px] mt-1 font-mono flex items-center justify-between opacity-80">
                          <span>{booking.mobile_number}</span>
                          {refCode && <span className="text-[9px]">{refCode.replace('POGH-2026-', '#')}</span>}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={iso}
                    className={`p-2 border-r last:border-r-0 border-slate-200 flex items-center justify-center group ${
                      isSelected ? 'bg-amber-100/40' : isToday ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {isAdmin ? (
                      <button
                        onClick={() => {
                          if (onSelectDate) onSelectDate(iso);
                          onQuickBook(iso, suit.id);
                        }}
                        className="w-full h-full min-h-[58px] rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/80 text-emerald-700 flex flex-col items-center justify-center gap-0.5 transition group-hover:scale-98 shadow-xs"
                        title={`Click to book ${suit.name} on ${iso}`}
                      >
                        <span className="text-[11px] font-semibold flex items-center gap-1">
                          <PlusCircle className="w-3 h-3 text-emerald-600" />
                          उपलब्ध
                        </span>
                        <span className="text-[9px] text-emerald-600/80">Book Now</span>
                      </button>
                    ) : (
                      <div
                        onClick={() => onSelectDate && onSelectDate(iso)}
                        className="w-full h-full min-h-[58px] rounded-lg border border-emerald-200 bg-emerald-50/30 text-emerald-700 flex flex-col items-center justify-center gap-0.5 select-none cursor-pointer"
                        title="Available for booking"
                      >
                        <span className="text-[11px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          उपलब्ध
                        </span>
                        <span className="text-[9px] text-slate-400">खाली है</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span>उपलब्ध (Available)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-200 border border-rose-300" />
            <span>आरक्षित (Booked)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600" />
            <span>उपस्थित (In House)</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-500">
          सुझाव: किसी भी तिथि पर क्लिक करके नीचे उस दिन का विस्तृत विवरण देखें।
        </div>
      </div>
    </div>
  );
};
