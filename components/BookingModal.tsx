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
import { useLanguage } from '@/lib/languageContext';

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
  const { language, t } = useLanguage();
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

  const [manualAmount, setManualAmount] = useState<string>('');
  const [mealStatus, setMealStatus] = useState<string>('PAID');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const bookingDates = getDatesInRange(checkInDate, checkOutDate);
  const totalDays = bookingDates.length;

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

  const conflicts = checkConflicts();

  const handleSuitToggle = (suitId: string) => {
    setSelectedSuits((prev) => ({
      ...prev,
      [suitId]: !prev[suitId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim()) {
      alert(language === 'hi' ? 'कृपया अतिथि का नाम दर्ज करें।' : 'Please enter guest name.');
      return;
    }

    if (!mobileNumber.trim()) {
      alert(language === 'hi' ? 'कृपया मोबाइल नंबर दर्ज करें।' : 'Please enter mobile number.');
      return;
    }

    const hasAnySuit = Object.values(selectedSuits).some(Boolean);
    if (!hasAnySuit) {
      alert(language === 'hi' ? 'कृपया कम से कम एक कमरा (Suit) चुनें।' : 'Please select at least one suit.');
      return;
    }

    if (conflicts.length > 0) {
      alert(
        (language === 'hi' ? 'कमरा पहले से आरक्षित है:\n' : 'Room is already booked:\n') +
        conflicts.join('\n') +
        (language === 'hi' ? '\n\nकृपया अन्य तिथि अथवा कमरा चुनें।' : '\n\nPlease select another date or room.')
      );
      return;
    }

    setSubmitting(true);
    try {
      const finalAmount = manualAmount.trim() ? Number(manualAmount) : 0;
      const finalNotes = encodeNotesWithMeta(notes.trim(), autoRef, autoDispatch);

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

  const getMealStatusLabel = (status: string) => {
    if (language === 'hi') {
      if (status === 'PAID') return 'सशुल्क';
      if (status === 'COMPLIMENTARY') return 'शासकीय / वीआईपी';
      if (status === 'NOT REQUIRED') return 'लागू नहीं';
      if (status === 'FREE') return 'निःशुल्क';
      if (status === 'PENDING') return 'लंबित';
    } else {
      if (status === 'PAID') return 'Paid';
      if (status === 'COMPLIMENTARY') return 'Complimentary (Govt/VIP)';
      if (status === 'NOT REQUIRED') return 'Not Required';
      if (status === 'FREE') return 'Free';
      if (status === 'PENDING') return 'Pending';
    }
    return status;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold">
                {language === 'hi' ? 'नयी अतिथि बुकिंग' : 'New Guest Booking'}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">
                {autoRef || 'POGH'}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-hindi">
              {language === 'hi' ? 'पुलिस ऑफिसर्स गेस्ट हाउस - अयोध्या' : 'Police Officers Guest House - Ayodhya'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-medium">
              <Hash className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {language === 'hi' ? 'बुकिंग संदर्भ:' : 'Booking Ref:'} <strong className="font-mono text-slate-900">{autoRef}</strong>
              </span>
            </div>
            <div>
              <span>
                {language === 'hi' ? 'डिस्पैच संख्या:' : 'Dispatch No:'} <strong className="font-mono text-slate-900">{autoDispatch}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                {language === 'hi' ? 'गेस्ट का नाम *' : 'Guest Name *'}
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={language === 'hi' ? 'उदा. श्री राहुल यादव' : 'e.g. Shri Rahul Yadav'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                {language === 'hi' ? 'मोबाइल नंबर *' : 'Mobile Number *'}
              </label>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder={language === 'hi' ? '10 अंकों का मोबाइल नंबर' : '10 digit mobile number'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                {language === 'hi' ? 'किसके संदर्भ से' : 'Reference'}
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
                {language === 'hi' ? 'भोजन व्यवस्था' : 'Meal Status'}
              </label>
              <select
                value={mealStatus}
                onChange={(e) => setMealStatus(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white"
              >
                {MEAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getMealStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                {language === 'hi' ? 'आगमन तिथि' : 'Check-in Date'}
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
                {language === 'hi' ? 'प्रस्थान तिथि' : 'Check-out Date'}
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
              <span>{language === 'hi' ? `कुल अवधि: ${totalDays} रात्रि` : `Total Stay: ${totalDays} Night(s)`}</span>
              <span>{formatToDisplayDate(checkInDate)} to {formatToDisplayDate(checkOutDate)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {language === 'hi' ? 'आवंटित किए जाने वाले कमरे चुनें:' : 'Select Room(s) to Allocate:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SUITS.map((suit) => {
                const isSelected = selectedSuits[suit.id];
                const floorLabel = suit.id === 'suit_1' || suit.id === 'suit_2' ? t('groundFloor') : t('firstFloor');
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

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                {language === 'hi' ? 'प्रति रूम प्रति दिन किराया (₹)' : 'Room Rent Per Day (₹)'}
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'hi' ? `${Object.values(selectedSuits).filter(Boolean).length} सूट चयनित` : `${Object.values(selectedSuits).filter(Boolean).length} suits selected`}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder={language === 'hi' ? 'उदा. 800 (खाली छोड़ने पर "As Per Applicable" छपेगा)' : 'e.g. 800 (leave blank for As Per Applicable)'}
                className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {language === 'hi'
                ? '* यदि आप यहाँ किराया लिखेंगे तो वही आवंटन पत्र में छपेगा। खाली छोड़ने पर पत्र में As Per Applicable छपेगा।'
                : '* If entered, this rate will appear on the allotment letter. Otherwise, "As Per Applicable" will be printed.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'hi' ? 'विशेष निर्देश / टिप्पणी (वैकल्पिक)' : 'Special Instructions / Notes (Optional)'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'hi' ? 'उदा. विशेष सुरक्षा, अतिरिक्त गद्दे आदि' : 'e.g. Special security, extra mattresses etc.'}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
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
