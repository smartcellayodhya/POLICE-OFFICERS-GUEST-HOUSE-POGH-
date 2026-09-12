'use client';

import React from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import { formatToDisplayDate, formatToHindiDate, formatToISODate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { extractGroupIdFromNotes, cleanNotesText } from '@/lib/bookingUtils';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Wrench,
} from 'lucide-react';

import { useLanguage } from '@/lib/languageContext';

interface RoomMatrixProps {
  bookings: Booking[];
  isAdmin: boolean;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onQuickBook?: (dateStr: string, suitKey: string) => void;
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

  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const formatDateNumberDisplay = (isoStr: string) => {
    if (!isoStr || !isoStr.includes('-')) return isoStr;
    const [y, m, d] = isoStr.split('-');
    return `${d}-${m}-${y}`;
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

          {/* Custom Styled Date Picker with Solid Bright Golden Calendar Button */}
          <div 
            onClick={handleOpenCalendar}
            className="relative flex items-center bg-slate-900 rounded-xl border border-amber-500/60 hover:border-amber-400 pl-3 pr-1 py-1 gap-2 cursor-pointer shadow-sm hover:shadow transition group"
            title={language === 'hi' ? 'कैलेंडर खोलें' : 'Open Calendar'}
          >
            {/* Displayed Date: e.g. 11-09-2026 */}
            <span className="text-xs font-black font-mono text-amber-300 tracking-wider select-none">
              {formatDateNumberDisplay(selectedDate)}
            </span>

            {/* Invisible native date input overlay covering the entire pill */}
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              tabIndex={0}
              aria-label={language === 'hi' ? 'तारीख चुनें' : 'Select date'}
            />

            {/* High-Contrast Solid Gold Calendar Button with Dark Icon */}
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-400 group-hover:bg-amber-300 text-slate-950 shadow-sm transition shrink-0"
            >
              <Calendar className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
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

            // If Room is BOOKED or IN MAINTENANCE on this date
            if (booking) {
              const isMaintenance = booking.status === 'MAINTENANCE' || booking.is_maintenance;
              const isInHouse = booking.status === 'CHECKED_IN';

              if (isMaintenance) {
                return (
                  <div
                    key={suit.id}
                    onClick={() => onSelectBooking(booking)}
                    className="p-3.5 sm:p-4 rounded-2xl border-2 border-purple-300 bg-purple-50/80 text-purple-950 transition cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md"
                    title={language === 'hi' ? 'कमरा मरम्मत/ब्लॉक में है' : 'Room is under maintenance'}
                  >
                    <div>
                      <div className="pb-2 border-b border-purple-200">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {suit.name}
                        </span>
                      </div>

                      <div className="my-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-600 text-white shadow-xs">
                          <Wrench className="w-3 h-3" />
                          <span>{language === 'hi' ? 'मरम्मत / ब्लॉक' : 'Maintenance'}</span>
                        </span>
                      </div>

                      <div className="text-xs font-bold text-purple-900 truncate">
                        {booking.guest_name}
                      </div>
                      <div className="text-[11px] text-purple-700 font-mono truncate">
                        {cleanNotesText(booking.notes) || 'Out of Service'}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-purple-200 flex items-center justify-between text-[11px]">
                      <span className="text-purple-800 font-bold flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>{language === 'hi' ? 'विवरण देखें' : 'Details'}</span>
                      </span>
                    </div>
                  </div>
                );
              }

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
                    <div className="pb-2 border-b border-slate-200/70">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {suit.name}
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
                      <span className="text-slate-500 font-medium text-[11px]">
                        {booking.meal_type_status === 'FREE' ? (language === 'hi' ? 'निःशुल्क' : 'Free') : (booking.meal_type_status === 'COMPLIMENTARY' ? (language === 'hi' ? 'शासकीय' : 'Govt') : (booking.meal_type_status === 'NOT REQUIRED' ? (language === 'hi' ? 'लागू नहीं' : 'N/A') : (language === 'hi' ? 'सशुल्क' : 'Paid')))}
                      </span>
                    </div>
                </div>
              );
            }

            // If Room is AVAILABLE
            return (
              <div
                key={suit.id}
                className="p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 flex flex-col justify-between shadow-xs"
              >
                <div>
                  {/* Header */}
                  <div className="pb-2 border-b border-emerald-200/70">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {suit.name}
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
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-600" />
            <span>{language === 'hi' ? 'मरम्मत / ब्लॉक' : 'Maintenance'}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
