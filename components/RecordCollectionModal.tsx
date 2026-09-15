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
  extractExpenditureFromNotes,
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
  TrendingDown,
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
    expenditure: number;
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
  const [expenditureInput, setExpenditureInput] = useState<string>('');
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
      const defaultRate = metaRate > 0 ? metaRate : (suitRate > 1 ? suitRate : Number(booking.total_amount) || 0);
      setRoomRentInput(defaultRate > 0 ? String(defaultRate) : '');

      // Existing food amount
      const existingFood = extractFoodAmountFromNotes(booking.notes) || Number(booking.food_amount) || 0;
      setFoodAmountInput(existingFood > 0 ? String(existingFood) : '');

      // Existing expenditure
      const existingExp = extractExpenditureFromNotes(booking.notes) || Number(booking.expenditure) || 0;
      setExpenditureInput(existingExp > 0 ? String(existingExp) : '');

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
  const parsedExp = Number(expenditureInput) || 0;
  const grossCollection = totalRoomRent + parsedFood;
  // User condition: If room is free/govt with 0 rent & 0 food, net shouldn't be negative!
  const netGrandTotal = grossCollection <= 0 ? 0 : Math.max(0, grossCollection - parsedExp);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSaveCollection({
        roomRentPerDay: parsedRent,
        foodAmount: parsedFood,
        expenditure: parsedExp,
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
      className="fixed inset-0 z-50 p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Fixed Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1 rounded bg-amber-500 text-slate-950">
              <Receipt className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold">
              {language === 'hi' ? 'दैनिक कलेक्शन एवं बिलिंग' : 'Record Collection & Billing'}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">
              {bookingRef}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-slate-800">
          
          {/* Scrollable Body */}
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
            
            {/* Guest & Stay Summary Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-600" />
                  <span>{formatGuestDisplayName(booking.guest_name)}</span>
                </div>
                <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                  {booking.mobile_number} • {suitsDisplay} ({numRooms} कमरा)
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-medium">
                <div>{formatToDisplayDate(checkInDate)} से {formatToDisplayDate(checkOutDate)}</div>
                <div className="font-bold text-slate-800 font-mono">{stayNights} रात्रि / दिन</div>
              </div>
            </div>

            {/* 1. Room Rent Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                  <span>{language === 'hi' ? 'कमरा किराया (प्रति कमरा / दिन)' : 'Room Rent (Per Room / Day)'}</span>
                </span>
                {parsedRent > 0 && (
                  <span className="text-[11px] font-mono font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {numRooms} × ₹{parsedRent} × {stayNights} = ₹{totalRoomRent.toLocaleString('en-IN')}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={roomRentInput}
                  onChange={(e) => setRoomRentInput(e.target.value)}
                  placeholder={language === 'hi' ? 'दैनिक कमरा दर (उदा. 500)' : 'Enter room rent per day'}
                  className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white font-mono font-semibold text-slate-900"
                />
              </div>
            </div>

            {/* 2. Food / Mess Collection & Expenditure in 2-Col Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-blue-600" />
                  <span>{language === 'hi' ? 'खान-पान / भोजन संग्रह' : 'Food / Meal Collection'}</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={foodAmountInput}
                    onChange={(e) => setFoodAmountInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition bg-white font-mono font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                  <span>{language === 'hi' ? 'व्यय / खर्च कटौती' : 'Expenditure / Deduction'}</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={expenditureInput}
                    onChange={(e) => setExpenditureInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition bg-white font-mono font-semibold text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* 3. Payment Mode & Collected By */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'hi' ? 'भुगतान माध्यम' : 'Payment Mode'}</span>
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 outline-none bg-white font-medium"
                >
                  <option value="CASH">{language === 'hi' ? 'नकद' : 'Cash'}</option>
                  <option value="UPI">{language === 'hi' ? 'ऑनलाइन / यूपीआई' : 'UPI / Online'}</option>
                  <option value="GOVT">{language === 'hi' ? 'शासकीय / वीआईपी' : 'Govt / VIP'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'hi' ? 'कलेक्शन कर्ता' : 'Collected By'}</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentUserDisplayName}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-medium cursor-not-allowed outline-none"
                />
              </div>
            </div>

            {/* 4. Optional Remarks */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'hi' ? 'टिप्पणी (वैकल्पिक)' : 'Notes (Optional)'}</span>
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={language === 'hi' ? 'उदा. यूपीआई संदर्भ / रसीद विवरण' : 'e.g. UPI ref or receipt details'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 outline-none"
              />
            </div>

            {/* 5. Check-Out Status Toggle */}
            <div className="pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={markCheckedOut}
                  onChange={(e) => setMarkCheckedOut(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <span>{language === 'hi' ? 'भुगतान उपरांत स्थिति "चेक-आउट" दर्ज करें' : 'Mark status as Checked-Out on save'}</span>
              </label>
            </div>

            {/* 6. Clean Settlement Summary Strip */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between gap-3 shadow-xs">
              <div className="text-xs space-y-0.5">
                <div className="text-slate-400 font-medium">
                  {language === 'hi' ? 'कुल संकलित धनराशि (नेट):' : 'Net Total Amount:'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                  <span>किराया: ₹{totalRoomRent.toLocaleString('en-IN')}</span>
                  {parsedFood > 0 && <span className="text-blue-300">+ भोजन: ₹{parsedFood}</span>}
                  {parsedExp > 0 && <span className="text-rose-300">- खर्च: ₹{parsedExp}</span>}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-black font-mono text-emerald-400">
                  ₹{netGrandTotal.toLocaleString('en-IN')}/-
                </span>
              </div>
            </div>

          </div>

          {/* Fixed Footer with Action Buttons */}
          <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-10 sm:h-11 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-xl transition cursor-pointer"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 sm:h-11 px-6 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{submitting ? (language === 'hi' ? 'सुरक्षित हो रहा है...' : 'Saving...') : (language === 'hi' ? 'सुरक्षित करें' : 'Save & Close')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
