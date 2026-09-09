'use client';

import React, { useState } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS } from '@/lib/constants';
import { formatToDisplayDate, formatToHindiDate, formatToISODate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { extractGroupIdFromNotes, extractDispatchNoFromNotes } from '@/lib/bookingUtils';
import {
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Share2,
  Trash2,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Phone,
  User,
  PlusCircle,
  BedDouble,
  Clock,
  Tag,
  Utensils,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DateWiseBookingsProps {
  bookings: Booking[];
  isAdmin: boolean;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onOpenBookingModalForDate: (dateStr: string, suitKey?: string) => void;
  onOpenLetter: (booking: Booking) => void;
  onDeleteBooking: (id: string, groupId?: string) => Promise<void>;
  onUpdateStatus: (booking: Booking, newStatus: BookingStatus, updateAllDates?: boolean) => Promise<void>;
}

export const BookingsTable: React.FC<DateWiseBookingsProps> = ({
  bookings,
  isAdmin,
  selectedDate,
  onSelectDate,
  onOpenBookingModalForDate,
  onOpenLetter,
  onDeleteBooking,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Handle Date Navigation (< Previous, Today, Next >)
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
    onSelectDate(formatToISODate(new Date()));
  };

  // Filter bookings for the selected date
  const dateBookings = bookings.filter(
    (b) => b.booking_date === selectedDate && b.status !== 'CANCELLED'
  );

  const cancelledDateBookings = bookings.filter(
    (b) => b.booking_date === selectedDate && b.status === 'CANCELLED'
  );

  // Search filter across all history (when searching)
  const isSearching = searchTerm.trim().length > 0;
  const searchResults = isSearching
    ? bookings.filter((b) => {
        const q = searchTerm.toLowerCase().trim();
        const refCode = (b.group_id || extractGroupIdFromNotes(b.notes)).toLowerCase();
        return (
          b.guest_name.toLowerCase().includes(q) ||
          b.mobile_number.includes(q) ||
          refCode.includes(q) ||
          (b.reference && b.reference.toLowerCase().includes(q)) ||
          b.booking_date.includes(q)
        );
      })
    : [];

  const getSuitsBookedList = (b: Booking) => {
    const suits: string[] = [];
    if (b.suit_1 > 0) suits.push('Suit 1 (₹800)');
    if (b.suit_2 > 0) suits.push('Suit 2 (₹800)');
    if (b.suit_3 > 0) suits.push('Suit 3 (₹1200)');
    if (b.suit_4 > 0) suits.push('Suit 4 (₹1200)');
    return suits;
  };

  const handleLifecycleClick = (b: Booking) => {
    if (!isAdmin) return;
    const current = b.status;
    let nextStatus: BookingStatus = 'CONFIRMED';
    if (current === 'CONFIRMED' || !current) {
      nextStatus = 'CHECKED_IN';
    } else if (current === 'CHECKED_IN') {
      nextStatus = 'CHECKED_OUT';
    } else if (current === 'CHECKED_OUT') {
      nextStatus = 'CONFIRMED';
    }
    onUpdateStatus(b, nextStatus, false);
  };

  const handleCancelClick = (b: Booking) => {
    if (!isAdmin) return;
    const isCurrentlyCancelled = b.status === 'CANCELLED';
    const newStatus: BookingStatus = isCurrentlyCancelled ? 'CONFIRMED' : 'CANCELLED';
    const refCode = b.group_id || extractGroupIdFromNotes(b.notes);

    if (refCode) {
      const confirmAll = window.confirm(
        isCurrentlyCancelled
          ? `क्या आप इस बुकिंग (${refCode}) के सभी दिनों को बहाल (Restore) करना चाहते हैं?`
          : `क्या आप इस बुकिंग (${refCode}) के सभी दिनों को निरस्त (Cancel) करना चाहते हैं?`
      );
      onUpdateStatus(b, newStatus, confirmAll);
    } else {
      onUpdateStatus(b, newStatus, false);
    }
  };

  const handleDeleteClick = (b: Booking) => {
    if (!isAdmin) return;
    const refCode = b.group_id || extractGroupIdFromNotes(b.notes);
    if (window.confirm(`क्या आप ${b.guest_name} का बुकिंग रिकॉर्ड स्थायी रूप से हटाना चाहते हैं?`)) {
      onDeleteBooking(b.id, refCode);
    }
  };

  const todayStr = formatToISODate(new Date());
  const isSelectedToday = selectedDate === todayStr;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-8 font-sans">
      
      {/* 1. Header & Interactive Date Navigation Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-amber-500/50">
        
        {/* Date Display and Status */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                दैनिक अतिथि पंजिका एवं बुकिंग विवरण
              </h2>
              {isSelectedToday && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                  आज (TODAY)
                </span>
              )}
            </div>
            <p className="text-xs text-amber-300 font-hindi mt-0.5">
              चयनित तिथि: <strong>{formatToHindiDate(selectedDate)}</strong> ({formatToDisplayDate(selectedDate)})
            </p>
          </div>
        </div>

        {/* Date Selector & Jump Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          
          {/* Native HTML Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-xl border border-slate-700 hover:border-amber-400 outline-none transition cursor-pointer"
              title="Select Date to View Bookings"
            />
          </div>

          {/* Previous Day */}
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="पिछली तिथि देखें"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Today Button */}
          <button
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              isSelectedToday
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            आज (Today)
          </button>

          {/* Next Day */}
          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="अगली तिथि देखें"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

        </div>

      </div>

      {/* 2. Global Guest Search Bar */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="गेस्ट का नाम, मोबाइल नं. या POGH संदर्भ संख्या खोजें..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white"
          />
        </div>
        {isSearching && (
          <div className="text-xs text-slate-500">
            खोज परिणाम: <strong>{searchResults.length}</strong> रिकॉर्ड्स मिले
            <button
              onClick={() => setSearchTerm('')}
              className="ml-2 text-amber-600 hover:underline font-semibold"
            >
              (क्लियर करें)
            </button>
          </div>
        )}
      </div>

      {/* 3. Main Body: Mode A (Search Results) OR Mode B (Selected Date Detailed View) */}
      <div className="p-4 sm:p-6">
        
        {/* Mode A: When user searches for a specific guest/booking */}
        {isSearching ? (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              खोज परिणाम (Search Results across all dates)
            </h3>

            {searchResults.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-500" />
                <p>कोई मेल खाता रिकॉर्ड नहीं मिला।</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((b) => {
                  const refCode = b.group_id || extractGroupIdFromNotes(b.notes) || 'POGH';
                  const suits = getSuitsBookedList(b);
                  const isInHouse = b.status === 'CHECKED_IN';
                  const isCancelled = b.status === 'CANCELLED';

                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl border transition shadow-xs flex flex-col justify-between ${
                        isCancelled
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : isInHouse
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {refCode}
                          </span>
                          <span className="text-xs font-bold text-slate-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            दिनांक: {formatToDisplayDate(b.booking_date)}
                          </span>
                        </div>

                        <div className="text-base font-bold text-slate-900">{b.guest_name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {b.mobile_number}
                          {b.reference && (
                            <span className="ml-2 px-1.5 py-0.2 bg-slate-100 rounded text-slate-700">
                              संदर्भ: {b.reference}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {suits.map((s) => (
                            <span
                              key={s}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-900">
                          ₹{Number(b.total_amount || 0).toLocaleString('en-IN')}{' '}
                          <span className="text-[10px] font-normal text-slate-500">
                            ({b.meal_type_status || 'PAID'})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onOpenLetter(b)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>आवंटन पत्र</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Mode B: Selected Date View - Executive Room Cards */
          <div>
            
            {/* Status overview for selected date */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>दिनांक {formatToHindiDate(selectedDate)} को कमरों की स्थिति:</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  कुल आरक्षित कमरे: <strong>{dateBookings.length}</strong> • उपलब्ध कमरे: <strong>{4 - dateBookings.length}</strong>
                </p>
              </div>

              {/* Admin Quick Booking trigger */}
              {isAdmin && (
                <button
                  onClick={() => onOpenBookingModalForDate(selectedDate)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>इस तिथि पर नई बुकिंग करें</span>
                </button>
              )}
            </div>

            {/* 4 Suits Cards for the Selected Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SUITS.map((suit) => {
                // Check if this suit is booked on this date
                const booking = dateBookings.find(
                  (b) => Number(b[suit.id as keyof Booking]) > 0
                );

                if (booking) {
                  const refCode = booking.group_id || extractGroupIdFromNotes(booking.notes) || 'POGH';
                  const isInHouse = booking.status === 'CHECKED_IN';
                  const isCheckedOut = booking.status === 'CHECKED_OUT';

                  return (
                    <div
                      key={suit.id}
                      className={`rounded-2xl p-5 border-2 transition shadow-xs flex flex-col justify-between ${
                        isInHouse
                          ? 'bg-emerald-50/60 border-emerald-400'
                          : isCheckedOut
                          ? 'bg-slate-50 border-slate-300'
                          : 'bg-rose-50/50 border-rose-300'
                      }`}
                    >
                      <div>
                        {/* Suit Title & Status Badge */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-base">
                              {suit.name}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              (₹{suit.rate}/दिन)
                            </span>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isInHouse
                                ? 'bg-emerald-600 text-white'
                                : isCheckedOut
                                ? 'bg-slate-400 text-white'
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

                        {/* Guest Information */}
                        <div className="mt-3.5 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                अतिथि का नाम (Guest Name)
                              </p>
                              <p className="text-base font-bold text-slate-900">
                                {booking.guest_name}
                              </p>
                            </div>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
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
                              <span className="text-slate-500">भोजन व्यवस्था:</span>{' '}
                              <strong className="text-emerald-700">{booking.meal_type_status || 'PAID'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">किराया:</span>{' '}
                              <strong className="text-slate-900 font-bold">₹{booking[suit.id as keyof Booking]}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="mt-5 pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        
                        {/* Reports Actions (Both Admin & Officer) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onOpenLetter(booking)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition border border-blue-200"
                            title="आधिकारिक आवंटन पत्र देखें एवं प्रिंट करें"
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
                            className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition border border-emerald-200"
                            title="व्हाट्सएप पर पुष्टि भेजें"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Admin Exclusive Lifecycle and Cancel Controls */}
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            {/* Check-in / Check-out Toggle */}
                            <button
                              onClick={() => handleLifecycleClick(booking)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition bg-white text-slate-700 hover:bg-slate-50"
                              title={isInHouse ? 'प्रस्थान दर्ज करें' : 'आगमन दर्ज करें'}
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

                            {/* Cancel Booking */}
                            <button
                              onClick={() => handleCancelClick(booking)}
                              className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200"
                              title="बुकिंग निरस्त करें"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>

                            {/* Delete Booking */}
                            <button
                              onClick={() => handleDeleteClick(booking)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition"
                              title="रिकॉर्ड हटाएं"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                }

                // Available Room Card
                return (
                  <div
                    key={suit.id}
                    className="rounded-2xl p-5 border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70 transition flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base">
                            {suit.name}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            (₹{suit.rate}/दिन)
                          </span>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          उपलब्ध (AVAILABLE)
                        </span>
                      </div>

                      <div className="py-6 text-center text-slate-500 text-xs">
                        दिनांक {formatToHindiDate(selectedDate)} के लिए यह कमरा पूर्णतः रिक्त एवं उपलब्ध है।
                      </div>
                    </div>

                    {/* Book Now Button (Admin Only) */}
                    {isAdmin ? (
                      <button
                        onClick={() => onOpenBookingModalForDate(selectedDate, suit.id)}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>इस तिथि पर {suit.name} बुक करें</span>
                      </button>
                    ) : (
                      <div className="py-2 text-center text-[11px] font-semibold text-emerald-700 bg-emerald-100/50 rounded-xl">
                        बुकिंग के लिए प्रशासक से संपर्क करें
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cancelled Bookings for this date (if any exist) */}
            {cancelledDateBookings.length > 0 && (
              <div className="mt-6 p-4 rounded-2xl bg-rose-50/60 border border-rose-200">
                <h4 className="text-xs font-bold text-rose-800 mb-2 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>इस तिथि पर निरस्त (Cancelled) बुकिंग्स:</span>
                </h4>
                <div className="space-y-2">
                  {cancelledDateBookings.map((cb) => (
                    <div
                      key={cb.id}
                      className="p-2.5 bg-white rounded-xl border border-rose-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong>{cb.guest_name}</strong> ({cb.mobile_number}) - {cb.reference}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleCancelClick(cb)}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                        >
                          पुनः बहाल करें (Restore)
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};
