'use client';

import React from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import { formatToDisplayDate, formatToHindiDate, formatToISODate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { extractGroupIdFromNotes } from '@/lib/bookingUtils';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  CheckCircle2,
  FileText,
  Share2,
  LogIn,
  LogOut,
  XCircle,
  Phone,
  User,
  BedDouble
} from 'lucide-react';

interface RoomMatrixProps {
  bookings: Booking[];
  isAdmin: boolean;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onQuickBook: (dateStr: string, suitKey: string) => void;
  onSelectBooking: (booking: Booking) => void;
  onUpdateStatus?: (booking: Booking, newStatus: BookingStatus) => Promise<void>;
  onCancelBooking?: (booking: Booking) => void;
}

export const RoomMatrix: React.FC<RoomMatrixProps> = ({
  bookings,
  isAdmin,
  selectedDate,
  onSelectDate,
  onQuickBook,
  onSelectBooking,
  onUpdateStatus,
  onCancelBooking,
}) => {
  const todayStr = formatToISODate(new Date());
  const isSelectedToday = selectedDate === todayStr;

  // Day Navigation (< Prev, Today, Next >)
  const handlePrevDay = () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() - 1);
    onSelectDate(formatToISODate(current));
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    onSelectDate(formatToISODate(current));
  };

  const handleToday = () => {
    onSelectDate(todayStr);
  };

  // Helper to find booking for a specific suit on selectedDate
  const getBookingForSuit = (suitKey: string): Booking | undefined => {
    return bookings.find(
      (b) =>
        b.booking_date === selectedDate &&
        b.status !== 'CANCELLED' &&
        Number(b[suitKey as keyof Booking]) > 0
    );
  };

  // Count occupied on this date
  let occupiedCount = 0;
  SUITS.forEach((s) => {
    if (getBookingForSuit(s.id)) occupiedCount++;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6 font-sans">
      
      {/* Top Header with Date Picker & Navigation Controls (Jaha Today tha waha Date select karne ka option) */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-amber-500/50">
        
        {/* Title and Selected Date in Hindi */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Room Occupancy & Live Status (कमरों की उपलब्धता स्थिति)
              </h2>
              {isSelectedToday && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                  आज (TODAY)
                </span>
              )}
            </div>
            <p className="text-xs text-amber-300 font-hindi mt-0.5">
              चयनित तिथि: <strong>{formatToHindiDate(selectedDate)}</strong> ({formatToDisplayDate(selectedDate)}) • आरक्षित: {occupiedCount}/4 कमरे
            </p>
          </div>
        </div>

        {/* Date Selector & Navigation Controls (Date Select karne ka option directly where Today was) */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700">
          
          {/* Previous Day Button */}
          <button
            onClick={handlePrevDay}
            className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="पिछली तिथि देखें"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Direct HTML Date Picker with Calendar Icon */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-amber-400 rounded-xl border border-amber-500/40 hover:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition cursor-pointer"
              title="कैलेंडर से तिथि चुनें (Select Date)"
            />
          </div>

          {/* Today Button */}
          <button
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              isSelectedToday
                ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            आज (Today)
          </button>

          {/* Next Day Button */}
          <button
            onClick={handleNextDay}
            className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="अगली तिथि देखें"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

        </div>

      </div>

      {/* Direct 4 Rooms Compact Status Display (Sirf status: available ya nahi) */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SUITS.map((suit) => {
            const booking = getBookingForSuit(suit.id);

            // If Room is BOOKED on this date
            if (booking) {
              const isInHouse = booking.status === 'CHECKED_IN';

              return (
                <div
                  key={suit.id}
                  onClick={() => onSelectBooking(booking)}
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isInHouse
                      ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950'
                      : 'bg-rose-50/80 border-rose-300 text-rose-950'
                  }`}
                  title="विवरण एवं आवंटन पत्र देखने के लिए क्लिक करें"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {suit.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        ₹{suit.rate}/दिन
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div className="my-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs ${
                          isInHouse
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {isInHouse ? '● उपस्थित (In House)' : '● आरक्षित (Booked)'}
                      </span>
                    </div>

                    {/* Guest Name */}
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {booking.guest_name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {booking.mobile_number} {booking.reference ? `• ${booking.reference}` : ''}
                    </div>
                  </div>

                  {/* Footer link */}
                  <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                    <span className="text-blue-700 font-bold flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>आवंटन पत्र देखें</span>
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {booking.meal_type_status || 'PAID'}
                    </span>
                  </div>
                </div>
              );
            }

            // If Room is AVAILABLE: Simple, clean, no long paragraphs, no giant buttons!
            return (
              <div
                key={suit.id}
                onClick={() => {
                  if (isAdmin) onQuickBook(selectedDate, suit.id);
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50/80 transition flex flex-col justify-between shadow-xs ${
                  isAdmin ? 'cursor-pointer hover:border-emerald-600' : ''
                }`}
                title={isAdmin ? `क्लिक करके ${suit.name} बुक करें` : 'कमरा उपलब्ध है'}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/70">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {suit.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      ₹{suit.rate}/दिन
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="my-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      उपलब्ध (Available)
                    </span>
                  </div>
                </div>

                {/* Quick Action Footer */}
                <div className="mt-3 pt-2 border-t border-emerald-200/70 flex items-center justify-between text-[11px]">
                  {isAdmin ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1 hover:underline">
                      <PlusCircle className="w-3 h-3" />
                      <span>Book Now (बुक करें)</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-medium">
                      रिक्त (खाली)
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {suit.id === 'suit_1' || suit.id === 'suit_2' ? 'भू-तल' : 'प्रथम तल'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>उपलब्ध (Available)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span>आरक्षित (Booked)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 ring-2 ring-emerald-300" />
            <span>उपस्थित (In House)</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          तिथि बदलकर किसी भी दिन के चारों कमरों की स्थिति तुरंत देखें।
        </div>
      </div>

    </div>
  );
};
