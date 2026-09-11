'use client';

import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS, REFERENCES, MEAL_STATUSES } from '@/lib/constants';
import {
  extractGroupIdFromNotes,
  extractDispatchNoFromNotes,
  cleanNotesText,
  encodeNotesWithMeta,
} from '@/lib/bookingUtils';
import { formatToDisplayDate } from '@/lib/dateUtils';
import {
  X,
  User,
  Phone,
  Tag,
  Utensils,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { logActivity } from '@/lib/auditLog';

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  relatedBookings?: Booking[];
  existingBookings?: Booking[];
  onSave: (updatedData: Partial<Booking>, applyToAll: boolean) => Promise<void>;
}

export const EditBookingModal: React.FC<EditBookingModalProps> = ({
  isOpen,
  onClose,
  booking,
  relatedBookings = [],
  existingBookings = [],
  onSave,
}) => {
  const { language, t } = useLanguage();
  const [guestName, setGuestName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [reference, setReference] = useState('SSP SIR');
  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('12:00 PM');
  const [selectedSuits, setSelectedSuits] = useState<Record<string, boolean>>({
    suit_1: false,
    suit_2: false,
    suit_3: false,
    suit_4: false,
  });
  const [manualAmount, setManualAmount] = useState<string>('');
  const [mealStatus, setMealStatus] = useState<string>('PAID');
  const [status, setStatus] = useState<BookingStatus>('CONFIRMED');
  const [notes, setNotes] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (booking) {
      setGuestName(booking.guest_name || '');
      setMobileNumber(booking.mobile_number || '');
      setReference(booking.reference || 'SSP SIR');
      setCheckInTime(booking.check_in_time || '12:00 PM');
      setCheckOutTime(booking.check_out_time || '12:00 PM');
      setSelectedSuits({
        suit_1: Number(booking.suit_1) > 0,
        suit_2: Number(booking.suit_2) > 0,
        suit_3: Number(booking.suit_3) > 0,
        suit_4: Number(booking.suit_4) > 0,
      });
      setManualAmount(Number(booking.total_amount) > 0 ? String(booking.total_amount) : '');
      setMealStatus(booking.meal_type_status || 'PAID');
      setStatus(booking.status || 'CONFIRMED');
      // Clean notes so metadata JSON tag is hidden from user
      setNotes(cleanNotesText(booking.notes));
      setApplyToAll(relatedBookings.length > 1);
    }
  }, [booking, relatedBookings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !booking) return null;

  const handleSuitToggle = (id: string) => {
    setSelectedSuits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const bookingRef =
    booking.group_id ||
    extractGroupIdFromNotes(booking.notes) ||
    `POGH-${booking.id.slice(0, 4)}`;

  const dispatchNo =
    booking.dispatch_no ||
    extractDispatchNoFromNotes(booking.notes) ||
    '';

  // Conflict detection for edited suits
  const checkConflicts = (datesToCheck: string[]): string[] => {
    const conflicts: string[] = [];
    const currentGroupIds = new Set(
      relatedBookings.map((b) => b.id).concat(booking.id)
    );

    datesToCheck.forEach((dateStr) => {
      SUITS.forEach((s) => {
        if (selectedSuits[s.id]) {
          const conflictingBooking = existingBookings.find(
            (b) =>
              b.booking_date === dateStr &&
              b.status !== 'CANCELLED' &&
              !currentGroupIds.has(b.id) &&
              Number(b[s.id as keyof Booking]) > 0
          );
          if (conflictingBooking) {
            conflicts.push(
              `${s.name} दिनांक ${formatToDisplayDate(dateStr)} को ${conflictingBooking.guest_name} के लिए पहले से आरक्षित है।`
            );
          }
        }
      });
    });

    return conflicts;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      alert(language === 'hi' ? 'कृपया गेस्ट का नाम भरें।' : 'Please enter guest name.');
      return;
    }
    const cleanedMobile = mobileNumber.replace(/\D/g, '');
    if (cleanedMobile.length !== 10) {
      alert(language === 'hi' ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
      return;
    }
    const hasAnySuit = Object.values(selectedSuits).some(Boolean);
    if (!hasAnySuit) {
      alert(language === 'hi' ? 'कृपया कम से कम एक सूट अवश्य चुनें।' : 'Please select at least one suit.');
      return;
    }

    // Determine dates to validate for conflict
    const datesToCheck = applyToAll && relatedBookings.length > 0
      ? relatedBookings.map((b) => b.booking_date)
      : [booking.booking_date];

    // Check conflicts
    const conflicts = checkConflicts(datesToCheck);
    if (conflicts.length > 0) {
      alert(
        (language === 'hi' ? 'कमरा आवंटन में टकराव (Double-Booking Conflict):\n' : 'Room Booking Conflict:\n') +
        conflicts.join('\n') +
        (language === 'hi' ? '\n\nकृपया दूसरा सूट चुनें।' : '\n\nPlease choose another room.')
      );
      return;
    }

    setSubmitting(true);
    try {
      const finalAmount = manualAmount.trim() ? Number(manualAmount) : 0;
      // Re-encode metadata safely so group_id & dispatch_no are NEVER lost
      const finalNotes = (bookingRef || dispatchNo)
        ? encodeNotesWithMeta(notes.trim(), bookingRef, dispatchNo)
        : notes.trim();

      const updatedData: Partial<Booking> = {
        guest_name: guestName.trim(),
        mobile_number: cleanedMobile,
        reference: reference.trim(),
        check_in_time: checkInTime.trim(),
        check_out_time: checkOutTime.trim(),
        suit_1: selectedSuits.suit_1 ? 1 : 0,
        suit_2: selectedSuits.suit_2 ? 1 : 0,
        suit_3: selectedSuits.suit_3 ? 1 : 0,
        suit_4: selectedSuits.suit_4 ? 1 : 0,
        total_amount: finalAmount,
        meal_type_status: mealStatus,
        status: status,
        notes: finalNotes,
      };

      await onSave(updatedData, applyToAll && relatedBookings.length > 1);
      
      logActivity(
        'UPDATE',
        `बुकिंग संशोधित: ${bookingRef}`,
        `अतिथि: ${guestName}, संदर्भ: ${reference}, स्थिति: ${status}`
      );

      alert(language === 'hi' ? 'बुकिंग विवरण सफलतापूर्वक संशोधित किया गया!' : 'Booking updated successfully!');
      onClose();
    } catch (err: any) {
      console.error('Error updating booking:', err);
      alert(`संशोधन विफल: ${err.message || 'त्रुटि उत्पन्न हुई'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getMealStatusLabel = (st: string) => {
    if (language === 'hi') {
      if (st === 'PAID') return 'सशुल्क';
      if (st === 'COMPLIMENTARY') return 'शासकीय / वीआईपी';
      if (st === 'NOT REQUIRED') return 'लागू नहीं';
      if (st === 'FREE') return 'निःशुल्क';
      if (st === 'PENDING') return 'लंबित';
    } else {
      if (st === 'PAID') return 'Paid';
      if (st === 'COMPLIMENTARY') return 'Complimentary (Govt/VIP)';
      if (st === 'NOT REQUIRED') return 'Not Required';
      if (st === 'FREE') return 'Free';
      if (st === 'PENDING') return 'Pending';
    }
    return st;
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-1 sm:my-6 animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">
                {language === 'hi' ? 'बुकिंग विवरण संशोधन' : 'Edit Booking Details'}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">
                {bookingRef}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'hi' ? 'तारीख:' : 'Date:'} {formatToDisplayDate(booking.booking_date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Apply to all group dates checkbox */}
          {relatedBookings.length > 1 && (
            <div className="pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <span>
                  {language === 'hi'
                    ? `इस प्रवास के सभी ${relatedBookings.length} दिवसों पर यह संशोधन लागू करें`
                    : `Apply this modification to all ${relatedBookings.length} days of this stay`}
                </span>
              </label>
            </div>
          )}

          {/* Guest Name & Mobile */}
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
                placeholder={language === 'hi' ? 'उदा. राहुल यादव' : 'e.g. Rahul Yadav'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white"
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
                inputMode="numeric"
                maxLength={10}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder={language === 'hi' ? '10 अंकों का मोबाइल नंबर' : '10 digit mobile number'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white font-mono"
              />
            </div>
          </div>

          {/* Reference & Meal Status */}
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
                {MEAL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {getMealStatusLabel(st)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Check-In & Check-Out Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {language === 'hi' ? 'चेक-इन समय' : 'Check-In Time'}
              </label>
              <input
                type="text"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                placeholder="12:00 PM"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {language === 'hi' ? 'चेक-आउट समय' : 'Check-Out Time'}
              </label>
              <input
                type="text"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                placeholder="12:00 PM"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white font-mono"
              />
            </div>
          </div>

          {/* Suits Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {language === 'hi' ? 'आवंटित किए जाने वाले कमरे चुनें:' : 'Select Room(s) to Allocate:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SUITS.map((suit) => {
                const isSelected = selectedSuits[suit.id];
                return (
                  <div
                    key={suit.id}
                    onClick={() => handleSuitToggle(suit.id)}
                    className={`cursor-pointer rounded-xl p-3 border-2 transition text-center flex items-center justify-center gap-1.5 select-none ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800 font-semibold'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                    <span className="text-xs sm:text-sm">{suit.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per Room Rent Input */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {language === 'hi' ? 'प्रति रूम प्रति दिन किराया (₹)' : 'Room Rent Per Day (₹)'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="उदा. 800"
                className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white font-mono"
              />
            </div>
          </div>

          {/* Booking Status Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'hi' ? 'बुकिंग स्थिति' : 'Booking Status'}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white font-semibold"
            >
              <option value="CONFIRMED">{t('confirmed')}</option>
              <option value="CHECKED_IN">{t('checkedIn')}</option>
              <option value="CHECKED_OUT">{t('checkedOut')}</option>
              <option value="CANCELLED">{t('cancelled')}</option>
            </select>
          </div>

          {/* Remarks / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'hi' ? 'विशेष विवरण / टिप्पणी' : 'Notes / Remarks'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'hi' ? 'उदा. आधिकारिक प्रवास' : 'e.g. Official stay'}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {submitting
                  ? (language === 'hi' ? 'सहेज रहे हैं...' : 'Saving...')
                  : (language === 'hi' ? 'संशोधन सुरक्षित करें' : 'Save Changes')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
