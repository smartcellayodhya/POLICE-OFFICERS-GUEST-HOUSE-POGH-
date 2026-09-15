'use client';

import React, { useState, useEffect } from 'react';
import { Booking } from '@/lib/types';
import {
  extractGroupIdFromNotes,
  extractDispatchNoFromNotes,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractRatePerRoomFromNotes,
  extractFoodAmountFromNotes,
  extractPaymentModeFromNotes,
  extractCollectionNoteFromNotes,
  getBookingSuitsList,
  formatGuestDisplayName,
} from '@/lib/bookingUtils';
import { calculateStayNights, formatToDisplayDate } from '@/lib/dateUtils';
import {
  X,
  IndianRupee,
  Utensils,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Receipt,
  User,
  Phone,
  FileText,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface RecordCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  relatedBookings?: Booking[];
  currentUserDisplayName?: string;
  onSaveCollection: (data: {
    roomRentPerDay: number;
    foodAmount: number;
    paymentMode: string;
    remarks?: string;
    markCheckedOut?: boolean;
  }) => Promise<void>;
}

export const RecordCollectionModal: React.FC<RecordCollectionModalProps> = ({
  isOpen,
  onClose,
  booking,
  relatedBookings = [],
  currentUserDisplayName = 'Guest House Operator',
  onSaveCollection,
}) => {
  const { language } = useLanguage();

  const [roomRentInput, setRoomRentInput] = useState<string>('');
  const [foodAmountInput, setFoodAmountInput] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [remarks, setRemarks] = useState<string>('');
  const [markCheckedOut, setMarkCheckedOut] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Determine full stay data
  const allGuestBookings = relatedBookings.length > 0 ? relatedBookings : (booking ? [booking] : []);

  useEffect(() => {
    if (booking && isOpen) {
      // Determine existing rate
      const metaRate = extractRatePerRoomFromNotes(booking.notes);
      const suitRate = Math.max(
        Number(booking.suit_1) || 0,
        Number(booking.suit_2) || 0,
        Number(booking.suit_3) || 0,
        Number(booking.suit_4) || 0
      );
      const defaultRate = metaRate > 0 ? metaRate : (suitRate > 1 ? suitRate : Number(booking.total_amount) || 800);
      setRoomRentInput(String(defaultRate));

      // Existing food amount
      const existingFood = extractFoodAmountFromNotes(booking.notes) || Number(booking.food_amount) || 0;
      setFoodAmountInput(existingFood > 0 ? String(existingFood) : '');

      // Payment mode
      const existingPay = booking.payment_mode || extractPaymentModeFromNotes(booking.notes) || 'CASH';
      setPaymentMode(existingPay);

      // Remarks
      const existingNote = extractCollectionNoteFromNotes(booking.notes);
      setRemarks(existingNote);

      // Status
      setMarkCheckedOut(booking.status !== 'CHECKED_OUT');
    }
  }, [booking, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !booking) return null;

  const sortedDates = allGuestBookings.map((b) => b.booking_date).sort();
  const notesCin = extractCheckInDateFromNotes(booking.notes);
  const notesCout = extractCheckOutDateFromNotes(booking.notes);
  const checkInDate = notesCin || sortedDates[0] || booking.booking_date;
  const checkOutDate = notesCout || sortedDates[sortedDates.length - 1] || booking.booking_date;
  const stayNights = Math.max(calculateStayNights(checkInDate, checkOutDate), allGuestBookings.length, 1);

  // Suits count
  const suitNames: string[] = [];
  if (Number(booking.suit_1) > 0) suitNames.push('Suit 1');
  if (Number(booking.suit_2) > 0) suitNames.push('Suit 2');
  if (Number(booking.suit_3) > 0) suitNames.push('Suit 3');
  if (Number(booking.suit_4) > 0) suitNames.push('Suit 4');
  const numRooms = suitNames.length || 1;
  const suitsDisplay = suitNames.length > 0 ? suitNames.join(', ') : 'Suit 1';

  const bookingRef =
    booking.group_id ||
    extractGroupIdFromNotes(booking.notes) ||
    `POGH-2026-${String(booking.id).slice(0, 4).toUpperCase()}`;

  const dispatchNo =
    booking.dispatch_no ||
    extractDispatchNoFromNotes(booking.notes) ||
    '-';

  // Live Math
  const parsedRent = Number(roomRentInput) || 0;
  const totalRoomRent = parsedRent * numRooms * stayNights;
  const parsedFood = Number(foodAmountInput) || 0;
  const grandTotal = totalRoomRent + parsedFood;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSaveCollection({
        roomRentPerDay: parsedRent,
        foodAmount: parsedFood,
        paymentMode,
        remarks: remarks.trim(),
        markCheckedOut,
      });
      onClose();
    } catch (err: any) {
      console.error('Error recording collection:', err);
      alert('कलेक्शन सुरक्षित करने में त्रुटि: ' + (err?.message || 'अज्ञात त्रुटि'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-4 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1 rounded bg-amber-500 text-slate-950">
                <Receipt className="w-4 h-4" />
              </span>
              <h3 className="text-base sm:text-lg font-bold">
                {language === 'hi' ? 'दैनिक कलेक्शन एवं बिल सेटलमेंट' : 'Record Collection & Billing'}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">
                {bookingRef}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              गेस्ट हाउस काउंटर • ऑपरेटर / प्रभारी संग्रह प्रविष्टि (पत्रांक: {dispatchNo})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-slate-800">
          
          {/* Guest & Stay Info Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                <User className="w-4 h-4 text-amber-600" />
                <span>{formatGuestDisplayName(booking.guest_name)}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-600 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{booking.mobile_number}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-slate-600">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>आवंटित: <strong>{suitsDisplay}</strong> ({numRooms} कमरा)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>अवधि: <strong>{stayNights} रात्रि / दिन</strong></span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500">
              प्रवास: {formatToDisplayDate(checkInDate)} से {formatToDisplayDate(checkOutDate)}
            </div>
          </div>

          {/* 1. Room Rent Modification Field */}
          <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-amber-700" />
                <span>{language === 'hi' ? 'कमरा किराया (प्रति कमरा / प्रति दिन ₹)' : 'Room Rent (Per Room / Per Day ₹)'}</span>
              </label>
              <span className="text-[11px] text-amber-800 font-medium">
                (मौके पर संशोधित किया जा सकता है)
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                required
                value={roomRentInput}
                onChange={(e) => setRoomRentInput(e.target.value)}
                placeholder="800"
                className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white font-mono font-bold text-slate-900"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-amber-900 pt-1">
              <span>कमरा किराया गणना:</span>
              <span className="font-mono font-semibold">
                {numRooms} कमरा × ₹{parsedRent} × {stayNights} दिन = <strong>₹{totalRoomRent.toLocaleString('en-IN')}</strong>
              </span>
            </div>
          </div>

          {/* 2. Food / Mess Collection Field */}
          <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-blue-700" />
                <span>{language === 'hi' ? 'खान-पान / भोजन संग्रह (Food Collection ₹)' : 'Food / Meal Collection (₹)'}</span>
              </label>
              <span className="text-[11px] text-blue-800 font-medium">
                (मेस / भोजन का कुल संग्रह)
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                value={foodAmountInput}
                onChange={(e) => setFoodAmountInput(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition bg-white font-mono font-bold text-slate-900"
              />
            </div>

            <p className="text-[11px] text-blue-700">
              यदि भोजन निःशुल्क या लागू नहीं है तो 0 अथवा खाली छोड़ें।
            </p>
          </div>

          {/* 3. Payment Mode & Collected By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'hi' ? 'भुगतान का माध्यम' : 'Payment Mode'}</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 outline-none bg-white font-semibold"
              >
                <option value="CASH">नकद (CASH)</option>
                <option value="UPI">ऑनलाइन / यूपीआई (UPI)</option>
                <option value="GOVT">शासकीय / वीआईपी (GOVT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'hi' ? 'कलेक्शन कर्ता (Operator)' : 'Collected By'}</span>
              </label>
              <input
                type="text"
                readOnly
                value={currentUserDisplayName}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed outline-none"
              />
            </div>
          </div>

          {/* Optional Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>{language === 'hi' ? 'बिल / कलेक्शन टिप्पणी (वैकल्पिक)' : 'Collection Notes (Optional)'}</span>
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. UPI ट्रांजेक्शन / रसीद जारी"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Check-Out Status Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={markCheckedOut}
                onChange={(e) => setMarkCheckedOut(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <span>भुगतान प्राप्ति के उपरांत स्थिति <strong>चेक-आउट (CHECKED-OUT)</strong> दर्ज करें</span>
            </label>
          </div>

          {/* Grand Total Settlement Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl shadow-md border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>कमरा किराया:</span>
              <span className="font-mono font-bold text-amber-400">₹{totalRoomRent.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>खान-पान / भोजन संग्रह:</span>
              <span className="font-mono font-bold text-blue-400">₹{parsedFood.toLocaleString('en-IN')}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                सर्वकुल संकलित धनराशि (Grand Total):
              </span>
              <span className="text-xl font-black font-mono text-emerald-400">
                ₹{grandTotal.toLocaleString('en-IN')}/-
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              रद्द करें (Cancel)
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'सुरक्षित हो रहा है...' : 'सुरक्षित करें एवं रसीद देखें'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
