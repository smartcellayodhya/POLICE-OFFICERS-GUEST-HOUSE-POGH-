'use client';

import React, { useState } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { formatToDisplayDate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { extractGroupIdFromNotes, extractDispatchNoFromNotes, cleanNotesText } from '@/lib/bookingUtils';
import {
  Search,
  Filter,
  FileText,
  Share2,
  Trash2,
  CheckCircle,
  XCircle,
  UserCheck,
  LogOut,
  LogIn,
  Phone,
  User,
  Hash,
  Lock
} from 'lucide-react';

interface BookingsTableProps {
  bookings: Booking[];
  isAdminUnlocked: boolean;
  onRequestAuth: () => void;
  onOpenLetter: (booking: Booking) => void;
  onDeleteBooking: (id: string, groupId?: string) => Promise<void>;
  onUpdateStatus: (booking: Booking, newStatus: BookingStatus, updateAllDates?: boolean) => Promise<void>;
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  bookings,
  isAdminUnlocked,
  onRequestAuth,
  onOpenLetter,
  onDeleteBooking,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mealFilter, setMealFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Filter logic
  const filteredBookings = bookings.filter((b) => {
    const q = searchTerm.toLowerCase().trim();
    const refCode = (b.group_id || extractGroupIdFromNotes(b.notes)).toLowerCase();
    const matchesSearch =
      !q ||
      b.guest_name.toLowerCase().includes(q) ||
      b.mobile_number.includes(q) ||
      refCode.includes(q) ||
      (b.reference && b.reference.toLowerCase().includes(q)) ||
      (b.booking_date && b.booking_date.includes(q));

    const matchesMeal = mealFilter === 'ALL' || b.meal_type_status === mealFilter;
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

    return matchesSearch && matchesMeal && matchesStatus;
  });

  const getSuitsBookedBadge = (b: Booking) => {
    const suits: string[] = [];
    if (b.suit_1 > 0) suits.push('Suit 1');
    if (b.suit_2 > 0) suits.push('Suit 2');
    if (b.suit_3 > 0) suits.push('Suit 3');
    if (b.suit_4 > 0) suits.push('Suit 4');
    return suits;
  };

  const handleLifecycleClick = (b: Booking) => {
    if (!isAdminUnlocked) {
      onRequestAuth();
      return;
    }

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
    if (!isAdminUnlocked) {
      onRequestAuth();
      return;
    }

    const isCurrentlyCancelled = b.status === 'CANCELLED';
    const newStatus: BookingStatus = isCurrentlyCancelled ? 'CONFIRMED' : 'CANCELLED';
    const refCode = b.group_id || extractGroupIdFromNotes(b.notes);

    if (refCode) {
      const confirmAll = window.confirm(
        isCurrentlyCancelled
          ? `Restore this booking (${refCode})? Click OK to restore all nights, or Cancel for this single night.`
          : `Cancel this booking (${refCode})? Click OK to cancel all nights of this booking, or Cancel for this single date.`
      );
      onUpdateStatus(b, newStatus, confirmAll);
    } else {
      onUpdateStatus(b, newStatus, false);
    }
  };

  const handleDeleteClick = (b: Booking) => {
    if (!isAdminUnlocked) {
      onRequestAuth();
      return;
    }

    const refCode = b.group_id || extractGroupIdFromNotes(b.notes);
    if (window.confirm(`Delete booking record for ${b.guest_name}? This cannot be undone.`)) {
      onDeleteBooking(b.id, refCode);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      {/* Table Header Controls */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Booking Records & Lifecycle Directory (बुकिंग एवं आवागमन पंजिका)
          </h3>
          <p className="text-xs text-slate-500">
            Showing {filteredBookings.length} of {bookings.length} bookings
            {!isAdminUnlocked && (
              <span className="ml-2 text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[10px] font-semibold">
                View Only (Staff Login to edit)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, phone, ref, POGH-xxx..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-amber-500 outline-none transition bg-white"
            />
          </div>

          {/* Meal Status Filter */}
          <select
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 outline-none"
          >
            <option value="ALL">All Meals</option>
            <option value="PAID">PAID</option>
            <option value="FREE">FREE</option>
            <option value="PENDING">PENDING</option>
          </select>

          {/* Booking Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="CONFIRMED">CONFIRMED (आरक्षित)</option>
            <option value="CHECKED_IN">CHECKED IN (उपस्थित)</option>
            <option value="CHECKED_OUT">CHECKED OUT (प्रस्थान)</option>
            <option value="CANCELLED">CANCELLED (निरस्त)</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Booking Ref</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Guest Details</th>
              <th className="py-3 px-4">Reference</th>
              <th className="py-3 px-4">Suits</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status & Lifecycle</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No matching booking records found</p>
                </td>
              </tr>
            ) : (
              filteredBookings.map((b) => {
                const suits = getSuitsBookedBadge(b);
                const isCancelled = b.status === 'CANCELLED';
                const isInHouse = b.status === 'CHECKED_IN';
                const isCheckedOut = b.status === 'CHECKED_OUT';
                const refCode = b.group_id || extractGroupIdFromNotes(b.notes) || 'POGH';

                return (
                  <tr
                    key={b.id}
                    className={`hover:bg-slate-50/80 transition ${
                      isCancelled
                        ? 'bg-slate-50 opacity-60'
                        : isInHouse
                        ? 'bg-emerald-50/30'
                        : ''
                    }`}
                  >
                    {/* Booking Reference Pill */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                        {refCode}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {formatToDisplayDate(b.booking_date)}
                    </td>

                    {/* Guest Name & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.guest_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {b.mobile_number}
                      </div>
                    </td>

                    {/* Reference */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                        {b.reference || 'SSP SIR'}
                      </span>
                    </td>

                    {/* Allocated Suits */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {suits.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      ₹{Number(b.total_amount || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Lifecycle Status & Caretaker Toggle */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isInHouse
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isCheckedOut
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : isCancelled
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {isInHouse
                            ? 'IN HOUSE (उपस्थित)'
                            : isCheckedOut
                            ? 'CHECKED OUT'
                            : isCancelled
                            ? 'CANCELLED'
                            : 'CONFIRMED'}
                        </span>

                        {/* Quick Lifecycle Action for Staff */}
                        {!isCancelled && (
                          <button
                            onClick={() => handleLifecycleClick(b)}
                            className="p-1 rounded text-[10px] font-semibold border hover:bg-slate-100 transition flex items-center gap-1 text-slate-600"
                            title={
                              isInHouse
                                ? 'Click to Mark as Checked-Out (प्रस्थान)'
                                : 'Click to Mark as Checked-In (आगमन)'
                            }
                          >
                            {isInHouse ? (
                              <>
                                <LogOut className="w-3 h-3 text-amber-600" />
                                <span className="hidden xl:inline">Check-Out</span>
                              </>
                            ) : (
                              <>
                                <LogIn className="w-3 h-3 text-emerald-600" />
                                <span className="hidden xl:inline">Check-In</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Open Hindi Letter */}
                        <button
                          onClick={() => onOpenLetter(b)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold transition"
                          title="Generate official Hindi letter"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Letter</span>
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
                              total_amount: b.total_amount,
                              meal_type_status: b.meal_type_status,
                              dates: [b.booking_date],
                            });
                            window.open(url, '_blank');
                          }}
                          className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                          title="Send confirmation on WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle Cancel / Restore */}
                        <button
                          onClick={() => handleCancelClick(b)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 transition"
                          title={isCancelled ? 'Restore Booking' : 'Cancel Booking'}
                        >
                          {isCancelled ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          )}
                        </button>

                        {/* Delete Row (Admin only) */}
                        <button
                          onClick={() => handleDeleteClick(b)}
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
