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

import { useLanguage } from '@/lib/languageContext';

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
  const { language, t } = useLanguage();
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

  const dateFormatted = language === 'hi' ? formatToHindiDate(selectedDate) : formatToDisplayDate(selectedDate);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6 font-sans">
      
      {/* Top Header with Date Picker & Navigation Controls */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-amber-500/50">
        
        {/* Title and Selected Date */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {t('matrix')}
              </h2>
              {isSelectedToday && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                  {t('today')}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-300 mt-0.5">
              {dateFormatted} • {occupiedCount}/4 {t('rooms')} {t('booked')}
            </p>
          </div>
        </div>

        {/* Date Selector & Navigation Controls */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700">
          
          {/* Previous Day Button */}
          <button
            onClick={handlePrevDay}
            className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="Previous Day"
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
            {t('today')}
          </button>

          {/* Next Day Button */}
          <button
            onClick={handleNextDay}
            className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="Next Day"
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
                  title={language === 'hi' ? 'विवरण एवं आवंटन पत्र देखने के लिए क्लिक करें' : 'Click to view details and allotment letter'}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {suit.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {suit.id === 'suit_1' || suit.id === 'suit_2' ? t('groundFloor') : t('firstFloor')}
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
                        {isInHouse ? `● ${t('checkedIn')}` : `● ${t('confirmed')}`}
                      </span>
                    </div>

                    {/* Guest Name */}
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {booking.guest_name.startsWith('श्री') ? booking.guest_name : `श्री ${booking.guest_name}`}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {booking.mobile_number} {booking.reference ? `• ${booking.reference}` : ''}
                    </div>
                  </div>

                  {/* Footer link */}
                  <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                    <span className="text-blue-700 font-bold flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>{t('allotmentLetter')}</span>
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {booking.meal_type_status || 'PAID'}
                    </span>
                  </div>
                </div>
              );
            }

            // If Room is AVAILABLE
            return (
              <div
                key={suit.id}
                onClick={() => {
                  if (isAdmin) onQuickBook(selectedDate, suit.id);
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50/80 transition flex flex-col justify-between shadow-xs ${
                  isAdmin ? 'cursor-pointer hover:border-emerald-600' : ''
                }`}
                title={isAdmin ? (language === 'hi' ? `क्लिक करके ${suit.name} बुक करें` : `Click to book ${suit.name}`) : (language === 'hi' ? 'कमरा उपलब्ध है' : 'Room is available')}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/70">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {suit.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {suit.id === 'suit_1' || suit.id === 'suit_2' ? t('groundFloor') : t('firstFloor')}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="my-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {t('available')}
                    </span>
                  </div>
                </div>

                {/* Quick Action Footer */}
                <div className="mt-3 pt-2 border-t border-emerald-200/70 flex items-center justify-between text-[11px]">
                  {isAdmin ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1 hover:underline">
                      <PlusCircle className="w-3 h-3" />
                      <span>{language === 'hi' ? 'बुक करें' : 'Book Now'}</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-medium">
                      {t('available')}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {suit.id === 'suit_1' || suit.id === 'suit_2' ? t('groundFloor') : t('firstFloor')}
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
            <span>{t('available')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span>{t('confirmed')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600 ring-2 ring-emerald-300" />
            <span>{t('checkedIn')}</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          {language === 'hi' ? 'तिथि बदलकर कमरों की स्थिति देखें।' : 'Change date to view room status.'}
        </div>
      </div>

    </div>
  );
};
