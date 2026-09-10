'use client';

import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS, REFERENCES, MEAL_STATUSES } from '@/lib/constants';
import { extractGroupIdFromNotes } from '@/lib/bookingUtils';
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
  CheckSquare
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  relatedBookings?: Booking[];
  onSave: (updatedData: Partial<Booking>, applyToAll: boolean) => Promise<void>;
}

export const EditBookingModal: React.FC<EditBookingModalProps> = ({
  isOpen,
  onClose,
  booking,
  relatedBookings = [],
  onSave,
}) => {
  const { language, t } = useLanguage();
  const [guestName, setGuestName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [reference, setReference] = useState('SSP SIR');
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
      setSelectedSuits({
        suit_1: Number(booking.suit_1) > 0,
        suit_2: Number(booking.suit_2) > 0,
        suit_3: Number(booking.suit_3) > 0,
        suit_4: Number(booking.suit_4) > 0,
      });
      setManualAmount(Number(booking.total_amount) > 0 ? String(booking.total_amount) : '');
      setMealStatus(booking.meal_type_status || 'PAID');
      setStatus(booking.status || 'CONFIRMED');
      setNotes(booking.notes || '');
      setApplyToAll(relatedBookings.length > 1);
    }
  }, [booking, relatedBookings]);

  if (!isOpen || !booking) return null;

  const handleSuitToggle = (id: string) => {
    setSelectedSuits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      alert('कृपया गेस्ट का नाम भरें।');
      return;
    }
    if (!mobileNumber.trim()) {
      alert('कृपया मोबाइल नंबर भरें।');
      return;
    }
    const hasAnySuit = Object.values(selectedSuits).some(Boolean);
    if (!hasAnySuit) {
      alert('कृपया कम से कम एक सूट अवश्य चुनें।');
      return;
    }

    setSubmitting(true);
    try {
      const finalAmount = manualAmount.trim() ? Number(manualAmount) : 0;
      const updatedData: Partial<Booking> = {
        guest_name: guestName.trim(),
        mobile_number: mobileNumber.trim(),
        reference: reference.trim(),
        suit_1: selectedSuits.suit_1 ? 1 : 0,
        suit_2: selectedSuits.suit_2 ? 1 : 0,
        suit_3: selectedSuits.suit_3 ? 1 : 0,
        suit_4: selectedSuits.suit_4 ? 1 : 0,
        total_amount: finalAmount,
        meal_type_status: mealStatus,
        status: status,
        notes: notes.trim(),
      };

      await onSave(updatedData, applyToAll && relatedBookings.length > 1);
      onClose();
    } catch (err: any) {
      console.error('Error updating booking:', err);
      alert(`संशोधन विफल: ${err.message || 'त्रुटि उत्पन्न हुई'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const bookingRef = booking.group_id || `POGH-${booking.id.slice(0, 4)}`;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
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
              {relatedBookings.length > 1 && (language === 'hi' ? ` (कुल ${relatedBookings.length} दिवसों का प्रवास)` : ` (${relatedBookings.length} nights stay)`)}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Apply to all group dates checkbox */}
          {relatedBookings.length > 1 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-amber-950">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                />
                <span>
                  {language === 'hi'
                    ? `इस प्रवास के सभी ${relatedBookings.length} दिवसों पर यह संशोधन लागू करें`
                    : `Apply this modification to all ${relatedBookings.length} days of this stay`}
                </span>
              </label>
              <span className="text-[11px] text-amber-800 font-semibold">
                {language === 'hi' ? 'अनुशंसित' : 'Recommended'}
              </span>
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
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="उदा. 9411616767"
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

          {/* Suits Selection */}
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
                        ? 'border-amber-500 bg-amber-50/80 shadow-xs'
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

          {/* Per Room Rent Input */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              {language === 'hi' ? 'प्रति रूम प्रति दिन किराया (₹) (वैकल्पिक)' : 'Room Rent Per Day (₹) (Optional)'}
            </label>
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
                ? '* खाली छोड़ने पर आवंटन पत्र में As Per Applicable छपेगा।'
                : '* If left blank, "As Per Applicable" will be printed on the letter.'}
            </p>
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
