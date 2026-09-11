'use client';

import React, { useState, useMemo } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { formatToDisplayDate, formatToHindiDate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { extractGroupIdFromNotes } from '@/lib/bookingUtils';
import { exportBookingsToCSV } from '@/lib/exportUtils';
import { REFERENCES, SUITS } from '@/lib/constants';
import {
  Search,
  FileText,
  Share2,
  Trash2,
  LogIn,
  LogOut,
  XCircle,
  Phone,
  User,
  BedDouble,
  Clock,
  Tag,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Filter,
  Edit3,
  Download,
  Calendar,
  Receipt,
} from 'lucide-react';

import { useLanguage } from '@/lib/languageContext';

interface BookingsTableProps {
  bookings: Booking[];
  isAdmin: boolean;
  onOpenLetter: (booking: Booking) => void;
  onOpenReceipt: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onDeleteBooking: (id: string, groupId?: string) => Promise<void>;
  onUpdateStatus: (booking: Booking, newStatus: BookingStatus, updateAllDates?: boolean) => Promise<void>;
}

type StatusFilter = 'ALL' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export const BookingsTable: React.FC<BookingsTableProps> = ({
  bookings,
  isAdmin,
  onOpenLetter,
  onOpenReceipt,
  onEditBooking,
  onDeleteBooking,
  onUpdateStatus,
}) => {
  const { language, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [referenceFilter, setReferenceFilter] = useState('ALL');
  const [suitFilter, setSuitFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Filter bookings by search term, date range, and status tab
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const bStatus = b.status || 'CONFIRMED';
        if (bStatus !== statusFilter) return false;
      }

      // Reference filter
      if (referenceFilter !== 'ALL' && b.reference !== referenceFilter) return false;

      // Suit filter
      if (suitFilter !== 'ALL') {
        if (suitFilter === 'suit_1' && Number(b.suit_1) <= 0) return false;
        if (suitFilter === 'suit_2' && Number(b.suit_2) <= 0) return false;
        if (suitFilter === 'suit_3' && Number(b.suit_3) <= 0) return false;
        if (suitFilter === 'suit_4' && Number(b.suit_4) <= 0) return false;
      }

      // Date range filter
      if (fromDate && b.booking_date < fromDate) return false;
      if (toDate && b.booking_date > toDate) return false;

      // Search term filter
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      const refCode = (b.group_id || extractGroupIdFromNotes(b.notes)).toLowerCase();

      return (
        b.guest_name.toLowerCase().includes(q) ||
        b.mobile_number.includes(q) ||
        refCode.includes(q) ||
        (b.reference && b.reference.toLowerCase().includes(q)) ||
        b.booking_date.includes(q)
      );
    });
  }, [bookings, searchTerm, statusFilter, referenceFilter, suitFilter, fromDate, toDate]);

  const setThisMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    setFromDate(`${y}-${m}-01`);
    setToDate(`${y}-${m}-${lastDay}`);
  };

  const setLastMonth = () => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prevMonthDate.getFullYear();
    const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, prevMonthDate.getMonth() + 1, 0).getDate();
    setFromDate(`${y}-${m}-01`);
    setToDate(`${y}-${m}-${lastDay}`);
  };

  const clearDateFilter = () => {
    setFromDate('');
    setToDate('');
  };

  const getSuitsBookedList = (b: Booking) => {
    const suits: string[] = [];
    if (b.suit_1 > 0) suits.push('Suit 1');
    if (b.suit_2 > 0) suits.push('Suit 2');
    if (b.suit_3 > 0) suits.push('Suit 3');
    if (b.suit_4 > 0) suits.push('Suit 4');
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
          ? `क्या आप इस बुकिंग (${refCode}) के सभी दिवस बहाल (Restore) करना चाहते हैं?`
          : `क्या आप इस बुकिंग (${refCode}) के सभी दिवस निरस्त (Cancel) करना चाहते हैं?`
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-8 font-sans">
      
      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-4 border-b border-amber-500/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {language === 'hi' ? 'अतिथि बुकिंग पंजिका' : 'Guest Booking Records'}
            </h2>
            <p className="text-xs text-amber-300 font-hindi mt-0.5">
              {language === 'hi' ? 'कुल प्रविष्टियाँ: ' : 'Total Records: '}
              <strong>{filteredBookings.length}</strong>
            </p>
          </div>
        </div>

        {/* Header Right: Excel Export & Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => exportBookingsToCSV(filteredBookings)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs whitespace-nowrap active:scale-95"
            title={language === 'hi' ? 'Excel में डाउनलोड करें' : 'Export to Excel'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportExcel')}</span>
          </button>

          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'hi' ? 'नाम, मोबाइल, संदर्भ या तिथि खोजें...' : 'Search by name, mobile, reference, date...'}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-800 text-white placeholder-slate-400 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* 2. Status & Date Range Filter Bar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'स्थिति:' : 'Status:'}</span>
          </div>

          {[
            { id: 'ALL', label: t('all') },
            { id: 'CONFIRMED', label: t('confirmed') },
            { id: 'CHECKED_IN', label: t('checkedIn') },
            { id: 'CHECKED_OUT', label: t('checkedOut') },
            { id: 'CANCELLED', label: t('cancelled') },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as StatusFilter)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">{language === 'hi' ? 'कब से:' : 'From:'}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="outline-none text-slate-800 text-xs bg-transparent"
            />
          </div>

          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-slate-500 font-medium">{language === 'hi' ? 'कब तक:' : 'To:'}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="outline-none text-slate-800 text-xs bg-transparent"
            />
          </div>

          {/* Reference Filter */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={referenceFilter}
              onChange={(e) => setReferenceFilter(e.target.value)}
              className="outline-none text-slate-800 text-xs bg-transparent cursor-pointer font-medium"
            >
              <option value="ALL">{language === 'hi' ? 'सभी संदर्भ' : 'All References'}</option>
              {REFERENCES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Suit Filter */}
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <BedDouble className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={suitFilter}
              onChange={(e) => setSuitFilter(e.target.value)}
              className="outline-none text-slate-800 text-xs bg-transparent cursor-pointer font-medium"
            >
              <option value="ALL">{language === 'hi' ? 'सभी सूट' : 'All Suits'}</option>
              {SUITS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={setThisMonth}
              className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition text-[11px]"
              title={language === 'hi' ? 'चालू माह की बुकिंग्स दिखाएं' : 'Show this month bookings'}
            >
              {language === 'hi' ? 'इस माह' : 'This Month'}
            </button>
            <button
              onClick={setLastMonth}
              className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition text-[11px]"
              title={language === 'hi' ? 'पिछले माह की बुकिंग्स दिखाएं' : 'Show last month bookings'}
            >
              {language === 'hi' ? 'गत माह' : 'Last Month'}
            </button>
            {(fromDate || toDate || searchTerm || referenceFilter !== 'ALL' || suitFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  clearDateFilter();
                  setSearchTerm('');
                  setReferenceFilter('ALL');
                  setSuitFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="px-2 py-1 text-rose-600 hover:text-rose-700 font-bold text-[11px] ml-1 hover:underline"
                title={language === 'hi' ? 'सभी फ़िल्टर हटाएं' : 'Clear all filters'}
              >
                {language === 'hi' ? 'फ़िल्टर साफ़ करें' : 'Clear Filter'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Booking Records List (Clean Cards, NOT raw Excel table) */}
      <div className="p-4 sm:p-6">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-500" />
            <p className="text-sm font-medium text-slate-500">
              {language === 'hi' ? 'कोई बुकिंग रिकॉर्ड नहीं मिला।' : 'No booking records found.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBookings.map((b) => {
              const refCode = b.group_id || extractGroupIdFromNotes(b.notes) || 'POGH';
              const suits = getSuitsBookedList(b);
              const isInHouse = b.status === 'CHECKED_IN';
              const isCheckedOut = b.status === 'CHECKED_OUT';
              const isCancelled = b.status === 'CANCELLED';

              return (
                <div
                  key={b.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition shadow-xs flex flex-col justify-between ${
                    isCancelled
                      ? 'bg-slate-50/80 border-slate-200 opacity-65'
                      : isInHouse
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : isCheckedOut
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header with Reference Code and Booking Date */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {refCode}
                      </span>
                      <span className="text-xs font-bold text-slate-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {language === 'hi' ? 'दिनांक:' : 'Date:'} {formatToDisplayDate(b.booking_date)}
                      </span>
                    </div>

                    {/* Guest Name & Mobile */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-bold text-slate-900">
                          {b.guest_name.startsWith('श्री') ? b.guest_name : `श्री ${b.guest_name}`}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{b.mobile_number}</span>
                          {b.reference && (
                            <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 text-[11px] font-sans">
                              {language === 'hi' ? 'संदर्भ:' : 'Ref:'} {b.reference}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isCancelled
                            ? 'bg-rose-100 text-rose-800'
                            : isInHouse
                            ? 'bg-emerald-600 text-white'
                            : isCheckedOut
                            ? 'bg-slate-400 text-white'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {isCancelled
                          ? t('cancelled')
                          : isInHouse
                          ? t('checkedIn')
                          : isCheckedOut
                          ? t('checkedOut')
                          : t('confirmed')}
                      </span>
                    </div>

                    {/* Suits Booked Pills */}
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

                  {/* Footer with Amount, Official Letter & Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="text-xs font-bold text-slate-900">
                      {Number(b.total_amount) > 0 ? (
                        <>₹{Number(b.total_amount).toLocaleString('en-IN')}/- </>
                      ) : (
                        <span className="text-slate-500 font-medium text-[11px]">As Per Applicable </span>
                      )}
                      <span className="text-[10px] font-normal text-slate-500">
                        ({b.meal_type_status || 'PAID'})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:justify-end">
                      {/* View Allotment Letter */}
                      <button
                        onClick={() => onOpenLetter(b)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition border border-blue-200"
                        title={language === 'hi' ? 'आवंटन पत्र देखें' : 'View Allotment Letter'}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t('allotmentLetter')}</span>
                      </button>

                      {/* View Payment Receipt */}
                      <button
                        onClick={() => onOpenReceipt(b)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition border border-amber-200"
                        title={language === 'hi' ? 'किराया रसीद देखें' : 'View Payment Receipt'}
                      >
                        <Receipt className="w-3.5 h-3.5 text-amber-700" />
                        <span>{language === 'hi' ? 'रसीद' : 'Receipt'}</span>
                      </button>

                      {/* WhatsApp Share */}
                      <button
                        onClick={() => {
                          const url = getWhatsAppUrl({
                            guest_name: b.guest_name,
                            mobile_number: b.mobile_number,
                            reference: b.reference,
                            booking_ref_no: refCode,
                            check_in_date: b.booking_date,
                            check_out_date: b.booking_date,
                            suits: suits,
                            total_days: 1,
                            total_amount: Number(b.total_amount || 0),
                            meal_type_status: b.meal_type_status,
                            dates: [b.booking_date],
                          });
                          window.open(url, '_blank');
                        }}
                        className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition border border-emerald-200"
                        title={language === 'hi' ? 'व्हाट्सएप पर भेजें' : 'Share on WhatsApp'}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Admin Controls */}
                      {isAdmin && (
                        <>
                          {/* Edit Booking Button */}
                          <button
                            onClick={() => onEditBooking(b)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition border border-amber-200 shadow-2xs"
                            title={language === 'hi' ? 'विवरण संशोधित करें' : 'Edit Booking'}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                            <span>{t('edit')}</span>
                          </button>

                          <button
                            onClick={() => handleLifecycleClick(b)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition bg-white text-slate-700 hover:bg-slate-100 shadow-xs"
                            title={isInHouse ? (language === 'hi' ? 'चेक-आउट दर्ज करें' : 'Record Check-Out') : (language === 'hi' ? 'चेक-इन दर्ज करें' : 'Record Check-In')}
                          >
                            {isInHouse ? (
                              <>
                                <LogOut className="w-3 h-3 text-amber-600" />
                                <span>{language === 'hi' ? 'चेक-आउट' : 'Check-Out'}</span>
                              </>
                            ) : (
                              <>
                                <LogIn className="w-3 h-3 text-emerald-600" />
                                <span>{language === 'hi' ? 'चेक-इन' : 'Check-In'}</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCancelClick(b)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200"
                            title={isCancelled ? (language === 'hi' ? 'बुकिंग बहाल करें' : 'Restore Booking') : (language === 'hi' ? 'बुकिंग निरस्त करें' : 'Cancel Booking')}
                          >
                            {isCancelled ? <RotateCcw className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleDeleteClick(b)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition"
                            title={language === 'hi' ? 'रिकॉर्ड हटाएं' : 'Delete Record'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
