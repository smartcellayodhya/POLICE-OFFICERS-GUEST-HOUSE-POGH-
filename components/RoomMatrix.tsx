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

      {/* Direct 4 Rooms Display for Selected Date (Upar jo 7-day line bani thi usko hta diya - keval 4 kamre) */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUITS.map((suit) => {
            const booking = getBookingForSuit(suit.id);

            // If Room is BOOKED on this date
            if (booking) {
              const refCode = booking.group_id || extractGroupIdFromNotes(booking.notes) || 'POGH';
              const isInHouse = booking.status === 'CHECKED_IN';
              const isCheckedOut = booking.status === 'CHECKED_OUT';

              return (
                <div
                  key={suit.id}
                  className={`rounded-2xl p-5 border-2 transition shadow-xs flex flex-col justify-between ${
                    isInHouse
                      ? 'bg-emerald-50/70 border-emerald-400'
                      : isCheckedOut
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-rose-50/60 border-rose-300'
                  }`}
                >
                  <div>
                    {/* Suit Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-lg">
                          {suit.name}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          (₹{suit.rate}/दिन)
                        </span>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
                          isInHouse
                            ? 'bg-emerald-600 text-white'
                            : isCheckedOut
                            ? 'bg-slate-500 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {isInHouse
                          ? 'IN HOUSE (उपस्थित)'
                          : isCheckedOut
                          ? 'CHECKED OUT'
                          : 'आरक्षित (BOOKED)'}
                      </span>
                    </div>

                    {/* Guest Details */}
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            अतिथि का नाम (Guest)
                          </p>
                          <p className="text-base font-bold text-slate-900">
                            {booking.guest_name}
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-800">
                          {refCode}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-500">मोबाइल नं:</span>{' '}
                          <strong className="font-mono text-slate-800">{booking.mobile_number}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">संदर्भ:</span>{' '}
                          <strong className="text-slate-800">{booking.reference || 'SSP SIR'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">भोजन:</span>{' '}
                          <strong className="text-emerald-700">{booking.meal_type_status || 'PAID'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">किराया:</span>{' '}
                          <strong className="text-slate-900 font-bold">₹{booking[suit.id as keyof Booking]}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this Room */}
                  <div className="mt-5 pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    
                    {/* View Letter & WhatsApp (Admin & Officer) */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectBooking(booking)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition border border-blue-200"
                        title="आधिकारिक आवंटन पत्र देखें"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>आवंटन पत्र</span>
                      </button>

                      <button
                        onClick={() => {
                          const url = getWhatsAppUrl({
                            guest_name: booking.guest_name,
                            mobile_number: booking.mobile_number,
                            reference: booking.reference,
                            booking_ref_no: refCode,
                            check_in_date: booking.booking_date,
                            check_out_date: booking.booking_date,
                            suits: [suit.name],
                            total_days: 1,
                            total_amount: Number(booking[suit.id as keyof Booking]) || 0,
                            meal_type_status: booking.meal_type_status,
                            dates: [booking.booking_date],
                          });
                          window.open(url, '_blank');
                        }}
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition border border-emerald-200"
                        title="व्हाट्सएप पर भेजें"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Admin Exclusive: Check-In/Out & Cancel */}
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        {onUpdateStatus && (
                          <button
                            onClick={() => {
                              const next = isInHouse ? 'CHECKED_OUT' : 'CHECKED_IN';
                              onUpdateStatus(booking, next);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition bg-white text-slate-700 hover:bg-slate-100 shadow-xs"
                          >
                            {isInHouse ? (
                              <>
                                <LogOut className="w-3.5 h-3.5 text-amber-600" />
                                <span>Check-Out</span>
                              </>
                            ) : (
                              <>
                                <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Check-In</span>
                              </>
                            )}
                          </button>
                        )}

                        {onCancelBooking && (
                          <button
                            onClick={() => onCancelBooking(booking)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200"
                            title="बुकिंग निरस्त करें"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            }

            // If Room is AVAILABLE on this date
            return (
              <div
                key={suit.id}
                className="rounded-2xl p-5 border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70 transition flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-lg">
                        {suit.name}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        (₹{suit.rate}/दिन)
                      </span>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      उपलब्ध (AVAILABLE)
                    </span>
                  </div>

                  <div className="py-8 text-center text-slate-500 text-xs">
                    दिनांक <strong>{formatToHindiDate(selectedDate)}</strong> के लिए यह कमरा पूर्णतः रिक्त एवं उपलब्ध है।
                  </div>
                </div>

                {/* Book Now Button (Admin Only) */}
                {isAdmin ? (
                  <button
                    onClick={() => onQuickBook(selectedDate, suit.id)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>इस तिथि पर {suit.name} बुक करें</span>
                  </button>
                ) : (
                  <div className="py-2.5 text-center text-xs font-semibold text-emerald-700 bg-emerald-100/60 rounded-xl">
                    कमरा उपलब्ध है
                  </div>
                )}
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
