'use client';

import React, { useState, useEffect } from 'react';
import { Booking } from '@/lib/types';
import { SUITS, REFERENCES, MEAL_STATUSES, DEFAULT_RATES } from '@/lib/constants';
import { formatToISODate, getDatesInRange, formatToDisplayDate } from '@/lib/dateUtils';
import {
  generateBookingRef,
  generateDispatchNumber,
  encodeNotesWithMeta,
} from '@/lib/bookingUtils';
import { X, Calendar, User, Phone, Tag, Utensils, AlertTriangle, CheckCircle2, Hash } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newBookings: Booking[]) => Promise<void>;
  existingBookings: Booking[];
  initialDate?: string;
  initialSuit?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingBookings,
  initialDate,
  initialSuit,
}) => {
  const today = formatToISODate(new Date());

  const [guestName, setGuestName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [reference, setReference] = useState('SSP SIR');
  const [checkInDate, setCheckInDate] = useState(initialDate || today);
  const [checkOutDate, setCheckOutDate] = useState(initialDate || today);
  
  const [selectedSuits, setSelectedSuits] = useState<Record<string, boolean>>({
    suit_1: initialSuit === 'suit_1',
    suit_2: initialSuit === 'suit_2',
    suit_3: initialSuit === 'suit_3',
    suit_4: initialSuit === 'suit_4',
  });

  // Manual amount input (not auto-linked to suits)
  const [manualAmount, setManualAmount] = useState<string>('');
  const [mealStatus, setMealStatus] = useState<string>('PAID');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto reference number
  const [autoRef, setAutoRef] = useState('');
  const [autoDispatch, setAutoDispatch] = useState('');

  useEffect(() => {
    if (isOpen) {
      const ref = generateBookingRef(existingBookings);
      const disp = generateDispatchNumber(existingBookings);
      setAutoRef(ref);
      setAutoDispatch(disp);
    }
  }, [isOpen, existingBookings]);

  useEffect(() => {
    if (initialDate) {
      setCheckInDate(initialDate);
      setCheckOutDate(initialDate);
    }
    if (initialSuit) {
      setSelectedSuits({
        suit_1: initialSuit === 'suit_1',
        suit_2: initialSuit === 'suit_2',
        suit_3: initialSuit === 'suit_3',
        suit_4: initialSuit === 'suit_4',
      });
    }
  }, [initialDate, initialSuit]);

  if (!isOpen) return null;

  // Calculate dates list
  const bookingDates = getDatesInRange(checkInDate, checkOutDate);
  const totalDays = bookingDates.length;

  // Check conflicts
  const checkConflicts = () => {
    const conflicts: string[] = [];
    bookingDates.forEach((d) => {
      SUITS.forEach((s) => {
        if (selectedSuits[s.id]) {
          const booked = existingBookings.find(
            (b) => b.booking_date === d && b.status !== 'CANCELLED' && Number(b[s.id as keyof Booking]) > 0
          );
          if (booked) {
            conflicts.push(`${s.name} is already booked on ${formatToDisplayDate(d)} for ${booked.guest_name}`);
          }
        }
      });
    });
    return conflicts;
  };

  const handleSuitToggle = (id: string) => {
    setSelectedSuits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim()) {
      alert('Please enter Guest Name.');
      return;
    }

    if (!mobileNumber.trim()) {
      alert('Please enter Mobile Number.');
      return;
    }

    const hasAnySuit = Object.values(selectedSuits).some((v) => v);
    if (!hasAnySuit) {
      alert('Please select at least one suit (Suit 1 - Suit 4).');
      return;
    }

    const conflicts = checkConflicts();
    if (conflicts.length > 0) {
      const confirmForce = window.confirm(
        `Warning: Overlapping room bookings detected!\n\n${conflicts.slice(0, 3).join('\n')}\n\nDo you still want to proceed?`
      );
      if (!confirmForce) return;
    }

    setSubmitting(true);
    try {
      const finalNotes = encodeNotesWithMeta(notes, autoRef, autoDispatch);
      const finalAmount = manualAmount.trim() ? Number(manualAmount) : 0;

      // Build individual date booking records all tied with autoRef
      const recordsToCreate: Booking[] = bookingDates.map((dateStr) => ({
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random()}`,
        group_id: autoRef,
        dispatch_no: autoDispatch,
        booking_date: dateStr,
        guest_name: guestName.trim(),
        mobile_number: mobileNumber.trim(),
        reference: reference.trim(),
        suit_1: selectedSuits.suit_1 ? 1 : 0,
        suit_2: selectedSuits.suit_2 ? 1 : 0,
        suit_3: selectedSuits.suit_3 ? 1 : 0,
        suit_4: selectedSuits.suit_4 ? 1 : 0,
        total_amount: finalAmount,
        meal_type_status: mealStatus,
        status: 'CONFIRMED',
        notes: finalNotes,
        created_at: new Date().toISOString(),
      }));

      await onSave(recordsToCreate);
      onClose();
    } catch (err: any) {
      console.error('Error saving booking:', err);
      alert('Failed to save booking: ' + (err?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold">New Room Booking</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">
                {autoRef || 'POGH'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-hindi">पुलिस ऑफिसर्स गेस्ट हाउस - नई बुकिंग दर्ज करें</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Booking Ref Banner */}
          <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-medium">
              <Hash className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto Booking Ref: <strong className="font-mono text-slate-900">{autoRef}</strong></span>
            </div>
            <div>
              <span>Auto Dispatch No: <strong className="font-mono text-slate-900">{autoDispatch}</strong></span>
            </div>
          </div>

          {/* Guest Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Guest Name (गेस्ट का नाम) *
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="उदा. श्री राहुल यादव"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                Mobile Number (मोबाइल नं.) *
              </label>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="10 digit mobile number"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition font-mono"
              />
            </div>
          </div>

          {/* Reference & Meal Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Reference (किसके संदर्भ से)
              </label>
              <select
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white"
              >
                {REFERENCES.map((ref) => (
                  <option key={ref} value={ref}>
                    {ref}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-slate-500" />
                Meal Status (भोजन व्यवस्था)
              </label>
              <select
                value={mealStatus}
                onChange={(e) => setMealStatus(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white"
              >
                {MEAL_STATUSES.map((status) => {
                  let label: string = status;
                  if (status === 'PAID') label = 'PAID (सशुल्क)';
                  else if (status === 'COMPLIMENTARY') label = 'COMPLIMENTARY (शासकीय / वीआईपी)';
                  else if (status === 'NOT REQUIRED') label = 'NOT REQUIRED (लागू नहीं)';
                  else if (status === 'FREE') label = 'FREE (निःशुल्क)';
                  else if (status === 'PENDING') label = 'PENDING (लंबित)';
                  return (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Check-in and Check-out Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Check-in Date (आगमन)
              </label>
              <input
                type="date"
                required
                value={checkInDate}
                onChange={(e) => {
                  setCheckInDate(e.target.value);
                  if (e.target.value > checkOutDate) {
                    setCheckOutDate(e.target.value);
                  }
                }}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Check-out Date (प्रस्थान)
              </label>
              <input
                type="date"
                required
                min={checkInDate}
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div className="col-span-full text-xs text-slate-500 flex items-center justify-between">
              <span>Total Stay: <strong>{totalDays} Night(s)</strong></span>
              <span>{formatToDisplayDate(checkInDate)} to {formatToDisplayDate(checkOutDate)}</span>
            </div>
          </div>

          {/* Suit Selection (Not linked to any automatic calculation) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Suit(s) to Allocate (कमरे का चयन करें):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SUITS.map((suit) => {
                const isSelected = selectedSuits[suit.id];
                const floorLabel = suit.id === 'suit_1' || suit.id === 'suit_2' ? 'भू-तल' : 'प्रथम तल';
                return (
                  <div
                    key={suit.id}
                    onClick={() => handleSuitToggle(suit.id)}
                    className={`cursor-pointer rounded-xl p-3 border-2 transition text-center flex flex-col items-center justify-center gap-1 select-none ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
                      {suit.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {floorLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Manual Booking Amount Field (वैकल्पिक - यदि पत्र में प्रिंट करना हो) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                प्रति रूम प्रति दिन किराया (₹) (वैकल्पिक)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {Object.values(selectedSuits).filter(Boolean).length} सूट चयनित
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="उदा. 800 (खाली छोड़ने पर पत्र में 'As Per Applicable' छपेगा)"
                className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              * यदि आप यहाँ किराया लिखेंगे तो वही आवंटन पत्र में छपेगा। खाली छोड़ने पर पत्र में <strong>As Per Applicable</strong> छपेगा।
            </p>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Remarks / Notes (विशेष विवरण - वैकल्पिक)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="उदा. विशेष सुरक्षा, अतिरिक्त गद्दे आदि"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs md:text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Confirming...' : 'Confirm & Save Booking'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
