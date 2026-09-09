'use client';

import React, { useState } from 'react';
import { Booking } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import { formatToDisplayDate, formatToISODate, formatToHindiDate } from '@/lib/dateUtils';
import { ChevronLeft, ChevronRight, Calendar, UserCheck, ShieldCheck, PlusCircle } from 'lucide-react';

interface RoomMatrixProps {
  bookings: Booking[];
  onQuickBook: (dateStr: string, suitKey: string) => void;
  onSelectBooking: (booking: Booking) => void;
}

export const RoomMatrix: React.FC<RoomMatrixProps> = ({
  bookings,
  onQuickBook,
  onSelectBooking,
}) => {
  // Center matrix around today or chosen base date
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const numDaysToShow = 7;

  // Generate date array
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
  };

  // Helper to find booking for a specific date and suit
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Matrix Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">
            Room Occupancy Matrix (कमरों की उपलब्धता स्थिति)
          </h2>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition"
            title="Previous Days"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition"
            title="Next Days"
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
              Room / Suit
            </div>
            {dateList.map((d) => {
              const iso = formatToISODate(d);
              const isToday = iso === todayStr;
              return (
                <div
                  key={iso}
                  className={`p-2.5 text-center border-r last:border-r-0 border-slate-200 ${
                    isToday ? 'bg-amber-50 text-amber-900 font-bold border-b-2 border-b-amber-500' : ''
                  }`}
                >
                  <div className="text-[11px] text-slate-500">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-xs">{d.getDate()} {d.toLocaleDateString('en-US', { month: 'short' })}</div>
                  {isToday && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] bg-amber-500 text-white rounded font-bold">
                      TODAY
                    </span>
                  )}
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
                  ₹{suit.rate}/day
                </div>
              </div>

              {/* Day Cells */}
              {dateList.map((d) => {
                const iso = formatToISODate(d);
                const booking = getBookingForSuit(iso, suit.id);
                const isToday = iso === todayStr;

                if (booking) {
                  return (
                    <div
                      key={iso}
                      onClick={() => onSelectBooking(booking)}
                      className={`p-2 border-r last:border-r-0 border-slate-200 cursor-pointer transition hover:opacity-90 ${
                        isToday ? 'bg-red-50/60' : 'bg-rose-50/40'
                      }`}
                      title={`Booked for ${booking.guest_name} (${booking.reference}) - Click to view`}
                    >
                      <div className="h-full rounded-lg p-2 bg-rose-100 border border-rose-200/80 text-rose-900 flex flex-col justify-between shadow-xs">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-bold text-rose-700">
                            <span className="truncate max-w-[70px]">{booking.reference || 'VIP'}</span>
                            <span className="px-1 py-0.2 rounded bg-rose-200 text-[9px]">BOOKED</span>
                          </div>
                          <div className="text-xs font-semibold text-slate-900 truncate mt-1">
                            {booking.guest_name}
                          </div>
                        </div>
                        <div className="text-[10px] text-rose-800 mt-1 font-mono">
                          {booking.mobile_number}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={iso}
                    className={`p-2 border-r last:border-r-0 border-slate-200 flex items-center justify-center group ${
                      isToday ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <button
                      onClick={() => onQuickBook(iso, suit.id)}
                      className="w-full h-full min-h-[58px] rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/80 text-emerald-700 flex flex-col items-center justify-center gap-0.5 transition group-hover:scale-98 shadow-xs"
                      title={`Click to book ${suit.name} on ${iso}`}
                    >
                      <span className="text-[11px] font-semibold flex items-center gap-1">
                        <PlusCircle className="w-3 h-3 text-emerald-600" />
                        Available
                      </span>
                      <span className="text-[9px] text-emerald-600/80">Book Now</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span>Available (उपलब्ध)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-200 border border-rose-300" />
            <span>Booked (आरक्षित)</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          Tip: Click any booked cell to view letter, or any green cell to book instantly.
        </div>
      </div>
    </div>
  );
};
