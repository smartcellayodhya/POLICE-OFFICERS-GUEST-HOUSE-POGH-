'use client';

import React from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import { formatToDisplayDate, formatToHindiDate, formatToISODate } from '@/lib/dateUtils';
import {
  extractGroupIdFromNotes,
  cleanNotesText,
  formatGuestDisplayName,
  isBookingOccupyingDate,
  isSuitAllocatedInBooking,
  isHourlyBooking,
  extractStayHoursFromNotes,
} from '@/lib/bookingUtils';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Wrench,
  IndianRupee,
  Clock,
  Plus,
  Timer,
} from 'lucide-react';

import { useLanguage } from '@/lib/languageContext';

interface RoomMatrixProps {
  bookings: Booking[];
  isAdmin: boolean;
  isOperator?: boolean;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onQuickBook?: (dateStr: string, suitKey: string) => void;
  onSelectBooking: (booking: Booking) => void;
  onOpenRecordCollection?: (booking: Booking) => void;
  onUpdateStatus?: (booking: Booking, newStatus: BookingStatus) => Promise<void>;
  onCancelBooking?: (booking: Booking) => void;
}

export const RoomMatrix: React.FC<RoomMatrixProps> = ({
  bookings,
  isAdmin,
  isOperator = false,
  selectedDate,
  onSelectDate,
  onQuickBook,
  onSelectBooking,
  onOpenRecordCollection,
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

  // Helper to find all bookings for a specific suit on selectedDate (supports multiple hourly slots)
  const getBookingsForSuit = (suitKey: string): Booking[] => {
    return bookings.filter(
      (b) =>
        (b.status || '').toUpperCase() !== 'CANCELLED' &&
        isSuitAllocatedInBooking(b, suitKey) &&
        (b.booking_date === selectedDate || isBookingOccupyingDate(b, selectedDate))
    );
  };

  // Count occupied rooms on this date
  let occupiedCount = 0;
  SUITS.forEach((s) => {
    if (getBookingsForSuit(s.id).length > 0) occupiedCount++;
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
            title={language === 'hi' ? 'पिछला दिन' : 'Previous Day'}
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
            title={language === 'hi' ? 'अगला दिन' : 'Next Day'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

        </div>

      </div>

      {/* Direct 4 Rooms Compact Status Display (with Multi-slot Hourly Support) */}
      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {SUITS.map((suit) => {
            const suitBookings = getBookingsForSuit(suit.id);

            // CASE 1: AVAILABLE (No bookings)
            if (suitBookings.length === 0) {
              return (
                <div
                  key={suit.id}
                  className="p-3 sm:p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 flex flex-col justify-between shadow-2xs hover:shadow-xs transition"
                >
                  <div>
                    <div className="pb-1.5 sm:pb-2 border-b border-emerald-200/70 flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{suit.name}</span>
                    </div>
                    <div className="my-2 sm:my-3">
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                        <span>{t('available')}</span>
                      </span>
                    </div>
                  </div>
                  {isAdmin && onQuickBook && (
                    <button
                      type="button"
                      onClick={() => onQuickBook(selectedDate, suit.id)}
                      className="w-full mt-2 h-7 sm:h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{language === 'hi' ? 'क्विक बुक' : 'Quick Book'}</span>
                    </button>
                  )}
                </div>
              );
            }

            // CASE 2: SINGLE BOOKING (Standard OR Single Hourly Slot OR Maintenance)
            if (suitBookings.length === 1) {
              const booking = suitBookings[0];
              const isMaintenance = booking.status === 'MAINTENANCE' || booking.is_maintenance;
              const isInHouse = booking.status === 'CHECKED_IN';
              const isHourly = isHourlyBooking(booking);
              const stayHrs = extractStayHoursFromNotes(booking.notes) || booking.stay_hours || 4;

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
                        <span className="font-extrabold text-slate-900 text-sm">{suit.name}</span>
                      </div>
                      <div className="my-2.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-600 text-white shadow-xs">
                          <Wrench className="w-3 h-3" />
                          <span>{language === 'hi' ? 'मरम्मत / ब्लॉक' : 'Maintenance'}</span>
                        </span>
                      </div>
                      <div className="text-xs font-bold text-purple-900 truncate">{booking.guest_name}</div>
                      <div className="text-[11px] text-purple-700 font-mono truncate">
                        {cleanNotesText(booking.notes) || (language === 'hi' ? 'सेवा से बाहर' : 'Out of Service')}
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
                  className={`p-3 sm:p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                    isHourly
                      ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                      : isInHouse
                      ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950'
                      : 'bg-rose-50/80 border-rose-300 text-rose-950'
                  }`}
                  title={language === 'hi' ? 'विवरण एवं आवंटन पत्र देखने के लिए क्लिक करें' : 'Click to view details and allotment letter'}
                >
                  <div>
                    {/* Header */}
                    <div className="pb-1.5 sm:pb-2 border-b border-slate-200/70 flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{suit.name}</span>
                      {isHourly && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{stayHrs} {language === 'hi' ? 'घंटे' : 'hrs'}</span>
                        </span>
                      )}
                    </div>

                    {/* Status Pill & Meal Tag */}
                    <div className="my-1.5 sm:my-2 flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shadow-2xs ${
                          isInHouse
                            ? 'bg-emerald-600 text-white'
                            : isHourly
                            ? 'bg-amber-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {isInHouse
                          ? `● ${t('checkedIn')}`
                          : isHourly
                          ? `⏱️ ${language === 'hi' ? 'अल्प' : 'Hourly'}`
                          : `● ${t('confirmed')}`}
                      </span>

                      <span className="text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 truncate">
                        {booking.meal_type_status === 'FREE'
                          ? (language === 'hi' ? 'निःशुल्क' : 'Free')
                          : (booking.meal_type_status === 'COMPLIMENTARY'
                            ? (language === 'hi' ? 'शासकीय' : 'Govt')
                            : (booking.meal_type_status === 'NOT REQUIRED'
                              ? (language === 'hi' ? 'लागू नहीं' : 'N/A')
                              : (booking.meal_type_status === 'AS PER APPLICABLE' || booking.meal_type_status === 'AS_PER_APPLICABLE'
                                ? (language === 'hi' ? 'नियमानुसार' : 'As per App')
                                : (language === 'hi' ? 'सशुल्क' : 'Paid'))))}
                      </span>
                    </div>

                    {/* Guest Name */}
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {formatGuestDisplayName(booking.guest_name)}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono truncate mt-0.5">
                      {booking.mobile_number} {booking.reference ? `• ${booking.reference}` : ''}
                    </div>

                    {/* Time slot for hourly */}
                    {isHourly && (
                      <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-100/70 border border-amber-200 text-[9px] sm:text-[10px] font-bold text-amber-900 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-700 shrink-0" />
                        <span className="truncate">{booking.check_in_time || '10:00 AM'} - {booking.check_out_time || '02:00 PM'}</span>
                      </div>
                    )}
                  </div>

                  {/* Clean Footer Action Bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex flex-col gap-1 sm:gap-1.5">
                    <div className="flex items-center justify-between gap-1 sm:gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectBooking(booking)}
                        className="flex-1 h-7 sm:h-8 px-1.5 sm:px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer"
                      >
                        <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                        <span>{language === 'hi' ? 'पत्र' : 'Letter'}</span>
                      </button>

                      {(isAdmin || isOperator) && onOpenRecordCollection && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRecordCollection(booking);
                          }}
                          className="flex-1 h-7 sm:h-8 px-1.5 sm:px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer active:scale-95"
                          title={language === 'hi' ? 'कलेक्शन व भोजन बिल दर्ज करें' : 'Record Collection & Food Bill'}
                        >
                          <IndianRupee className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-700" />
                          <span>{language === 'hi' ? 'कलेक्शन' : 'Collection'}</span>
                        </button>
                      )}
                    </div>

                    {/* If hourly, allow booking remaining hours on same day */}
                    {isHourly && isAdmin && onQuickBook && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickBook(selectedDate, suit.id);
                        }}
                        className="w-full h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{language === 'hi' ? '+ अन्य स्लॉट बुक करें' : '+ Book Another Slot'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // CASE 3: MULTIPLE HOURLY BOOKINGS ON SAME DAY
            return (
              <div
                key={suit.id}
                className="p-3.5 sm:p-4 rounded-2xl border-2 border-amber-400 bg-amber-50/70 text-slate-900 flex flex-col justify-between shadow-xs hover:shadow-md"
              >
                <div>
                  <div className="pb-2 border-b border-amber-300/70 flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-sm">{suit.name}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white shadow-2xs">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{suitBookings.length} {language === 'hi' ? 'स्लॉट' : 'slots'}</span>
                    </span>
                  </div>

                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {suitBookings.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => onSelectBooking(b)}
                        className="p-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 transition cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                          <span className="truncate">{formatGuestDisplayName(b.guest_name)}</span>
                          <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                            {b.check_in_time || '10:00 AM'} - {b.check_out_time || '02:00 PM'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                          {b.mobile_number} {b.reference ? `• ${b.reference}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {isAdmin && onQuickBook && (
                  <button
                    type="button"
                    onClick={() => onQuickBook(selectedDate, suit.id)}
                    className="w-full mt-2 h-7 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === 'hi' ? '+ अन्य स्लॉट जोड़ें' : '+ Add Slot'}</span>
                  </button>
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
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span>{language === 'hi' ? 'घंटे अनुसार / अल्पकालिक' : 'Hourly / Short Stay'}</span>
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
