'use client';

import React, { useState, useEffect } from 'react';
import { Booking } from '@/lib/types';
import { SUITS, REFERENCES, MEAL_STATUSES, DEFAULT_RATES } from '@/lib/constants';
import { formatToISODate, getDatesInRange, formatToDisplayDate } from '@/lib/dateUtils';
import { X, Calendar, User, Phone, Tag, Utensils, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

  const [rates, setRates] = useState({ ...DEFAULT_RATES });
  const [mealStatus, setMealStatus] = useState<string>('PAID');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Update when initialDate/initialSuit changes
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

  // Calculate daily room rent for selected suits
  let dailyRateSum = 0;
  if (selectedSuits.suit_1) dailyRateSum += Number(rates.suit_1) || 0;
  if (selectedSuits.suit_2) dailyRateSum += Number(rates.suit_2) || 0;
  if (selectedSuits.suit_3) dailyRateSum += Number(rates.suit_3) || 0;
  if (selectedSuits.suit_4) dailyRateSum += Number(rates.suit_4) || 0;

  const totalAmount = dailyRateSum * totalDays;

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
        `Warning: Overlapping bookings detected!\n\n${conflicts.slice(0, 3).join('\n')}\n\nDo you still want to proceed?`
      );
      if (!confirmForce) return;
    }

    setSubmitting(true);
    try {
      // Build individual date booking records
      const recordsToCreate: Booking[] = bookingDates.map((dateStr) => ({
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random()}`,
        booking_date: dateStr,
        guest_name: guestName.trim(),
        mobile_number: mobileNumber.trim(),
        reference: reference.trim(),
        suit_1: selectedSuits.suit_1 ? Number(rates.suit_1) || 0 : 0,
        suit_2: selectedSuits.suit_2 ? Number(rates.suit_2) || 0 : 0,
        suit_3: selectedSuits.suit_3 ? Number(rates.suit_3) || 0 : 0,
        suit_4: selectedSuits.suit_4 ? Number(rates.suit_4) || 0 : 0,
        total_amount: dailyRateSum,
        meal_type_status: mealStatus,
        status: 'CONFIRMED',
        notes: notes.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>New Room Booking</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">POGH</span>
            </h3>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                {MEAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
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
              <span>Total Duration: <strong>{totalDays} Day(s)</strong></span>
              <span>{formatToDisplayDate(checkInDate)} to {formatToDisplayDate(checkOutDate)}</span>
            </div>
          </div>

          {/* Suit Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Suit(s) to Allocate (कमरे का चयन करें):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SUITS.map((suit) => {
                const isSelected = selectedSuits[suit.id];
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
                    <div className="text-xs text-slate-500">
                      ₹{rates[suit.id as keyof typeof rates]}/day
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Banner */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-amber-900">Total Calculated Rent:</span>
              <div className="text-lg font-bold text-amber-950">
                ₹{totalAmount.toLocaleString('en-IN')}{' '}
                <span className="text-xs font-normal text-amber-800">
                  (₹{dailyRateSum}/day × {totalDays} days)
                </span>
              </div>
            </div>
            <div className="text-xs text-right text-amber-800">
              {Object.values(selectedSuits).filter(Boolean).length} Suit(s) Selected
            </div>
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
              placeholder="e.g. VIP guest, security detail, extra bedding required"
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
              {submitting ? 'Confirming Booking...' : 'Confirm & Save Booking'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
