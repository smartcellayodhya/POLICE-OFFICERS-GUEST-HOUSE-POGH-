'use client';

import React, { useState, useEffect } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import { SUITS, REFERENCES, MEAL_STATUSES } from '@/lib/constants';
import {
  extractGroupIdFromNotes,
  extractDispatchNoFromNotes,
  cleanNotesText,
  encodeNotesWithMeta,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractRatePerRoomFromNotes,
  extractBookingTypeFromNotes,
  extractStayHoursFromNotes,
  extractHourlyRateFromNotes,
  isHourlyBooking,
  parseTimeToMinutes,
  formatMinutesToTime,
  calculateStayHours,
  findConflictingBooking,
  parseBookingMeta,
} from '@/lib/bookingUtils';
import { formatToDisplayDate, calculateStayNights, getStayDates } from '@/lib/dateUtils';
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
  Lock,
  AlertTriangle,
  Timer,
  IndianRupee,
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
  const [otherReferenceName, setOtherReferenceName] = useState('');

  // Stay Type: Standard vs Hourly
  const [stayType, setStayType] = useState<'STANDARD' | 'HOURLY'>('STANDARD');
  const [hourlyHours, setHourlyHours] = useState<number>(4);
  const [hourlyRate, setHourlyRate] = useState<string>('');

  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('12:00 PM');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
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

  const handleSelectPresetHours = (hrs: number) => {
    setHourlyHours(hrs);
    const inMin = parseTimeToMinutes(checkInTime) ?? 600;
    const outMin = inMin + hrs * 60;
    setCheckOutTime(formatMinutesToTime(outMin));
  };

  const handleCheckInTimeChange = (newVal: string) => {
    setCheckInTime(newVal);
    if (stayType === 'HOURLY') {
      const inMin = parseTimeToMinutes(newVal);
      if (inMin !== null) {
        const outMin = inMin + hourlyHours * 60;
        setCheckOutTime(formatMinutesToTime(outMin));
      }
    }
  };

  const handleCheckOutTimeChange = (newVal: string) => {
    setCheckOutTime(newVal);
    if (stayType === 'HOURLY') {
      const hrs = calculateStayHours(checkInTime, newVal);
      if (hrs > 0) setHourlyHours(hrs);
    }
  };

  useEffect(() => {
    if (booking) {
      setGuestName(booking.guest_name || '');
      setMobileNumber(booking.mobile_number || '');
      const savedRef = booking.reference || 'SSP SIR';
      if (REFERENCES.includes(savedRef)) {
        setReference(savedRef);
        setOtherReferenceName('');
      } else {
        setReference('OTHER');
        setOtherReferenceName(savedRef);
      }
      setCheckInTime(booking.check_in_time || '12:00 PM');
      setCheckOutTime(booking.check_out_time || '12:00 PM');
      
      const isHr = isHourlyBooking(booking);
      setStayType(isHr ? 'HOURLY' : 'STANDARD');
      const sHours = extractStayHoursFromNotes(booking.notes) || booking.stay_hours || calculateStayHours(booking.check_in_time, booking.check_out_time);
      setHourlyHours(sHours > 0 ? sHours : 4);
      const hrRate = extractHourlyRateFromNotes(booking.notes) || booking.hourly_rate;
      setHourlyRate(hrRate ? String(hrRate) : '');

      const noteCin = extractCheckInDateFromNotes(booking.notes);
      const noteCout = extractCheckOutDateFromNotes(booking.notes);
      setCheckInDate(noteCin || booking.booking_date);
      setCheckOutDate(noteCout || booking.booking_date);

      setSelectedSuits({
        suit_1: Number(booking.suit_1) > 0,
        suit_2: Number(booking.suit_2) > 0,
        suit_3: Number(booking.suit_3) > 0,
        suit_4: Number(booking.suit_4) > 0,
      });

      const noteRate = extractRatePerRoomFromNotes(booking.notes);
      const suitRate = Math.max(Number(booking.suit_1) || 0, Number(booking.suit_2) || 0, Number(booking.suit_3) || 0, Number(booking.suit_4) || 0);
      const activeRate = noteRate > 0 ? noteRate : (suitRate > 1 ? suitRate : Number(booking.total_amount) || 0);
      setManualAmount(activeRate > 0 ? String(activeRate) : '');

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

  const stayDates = stayType === 'HOURLY' ? [checkInDate] : getStayDates(checkInDate, checkOutDate);
  const currentGroupIds = React.useMemo(() => {
    if (!booking) return new Set<string>();
    return new Set(relatedBookings.map((b) => b.id).concat(booking.id));
  }, [booking, relatedBookings]);

  // Check real-time availability of each suit for the selected date range (excluding this guest's own booking)
  const getSuitAvailability = React.useCallback(
    (suitId: string) => {
      const dates = stayType === 'HOURLY' ? [checkInDate] : getStayDates(checkInDate, checkOutDate);
      const res = findConflictingBooking(
        existingBookings,
        suitId,
        dates,
        currentGroupIds,
        checkInTime,
        checkOutTime,
        stayType === 'HOURLY'
      );
      if (res.isBooked && res.booking) {
        return {
          isBooked: true,
          date: res.conflictingDate || dates[0] || checkInDate,
          time: res.conflictingTime,
          guestName: res.guestName || res.booking.guest_name,
          isMaintenance: !!res.isMaintenance,
        };
      }
      return { isBooked: false, date: '', time: '', guestName: '', isMaintenance: false };
    },
    [checkInDate, checkOutDate, existingBookings, currentGroupIds, stayType, checkInTime, checkOutTime]
  );

  const handleSuitToggle = (id: string) => {
    const avail = getSuitAvailability(id);
    if (avail.isBooked) return; // Prevent selecting suits booked by another guest
    setSelectedSuits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Automatically uncheck any suit that becomes booked if the user changes the dates
  useEffect(() => {
    setSelectedSuits((prev) => {
      let changed = false;
      const next = { ...prev };
      SUITS.forEach((suit) => {
        if (next[suit.id]) {
          const avail = getSuitAvailability(suit.id);
          if (avail.isBooked) {
            next[suit.id] = false;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [checkInDate, checkOutDate, existingBookings]);

  const bookingRef =
    (booking?.group_id) ||
    extractGroupIdFromNotes(booking?.notes) ||
    (booking ? `POGH-${booking.id.slice(0, 4)}` : '');

  const dispatchNo =
    (booking?.dispatch_no) ||
    extractDispatchNoFromNotes(booking?.notes) ||
    '';

  // Conflict detection for edited suits
  const checkConflicts = (): string[] => {
    const conflictsList: string[] = [];
    SUITS.forEach((s) => {
      if (selectedSuits[s.id]) {
        const conflict = findConflictingBooking(
          existingBookings,
          s.id,
          stayDates,
          currentGroupIds,
          checkInTime,
          checkOutTime,
          stayType === 'HOURLY'
        );
        if (conflict.isBooked && conflict.booking) {
          const timeDetail = conflict.conflictingTime ? ` (समय: ${conflict.conflictingTime})` : '';
          conflictsList.push(
            language === 'hi'
              ? `${s.name} दिनांक ${formatToDisplayDate(conflict.conflictingDate || '')}${timeDetail} को ${conflict.guestName || conflict.booking.guest_name} के लिए पहले से आरक्षित है।`
              : `${s.name} is already booked on ${formatToDisplayDate(conflict.conflictingDate || '')}${timeDetail} for ${conflict.guestName || conflict.booking.guest_name}.`
          );
        }
      }
    });
    return conflictsList;
  };

  const conflicts = checkConflicts();

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

    if (stayType === 'STANDARD') {
      if (checkOutDate <= checkInDate) {
        alert(language === 'hi' ? 'प्रस्थान तिथि (Check-out Date) आगमन तिथि से अगले दिन की होनी चाहिए।' : 'Check-out date must be after check-in date.');
        return;
      }
    } else {
      if (checkOutDate < checkInDate) {
        alert(language === 'hi' ? 'प्रस्थान तिथि आगमन तिथि से पूर्व की नहीं हो सकती।' : 'Check-out date cannot be before check-in date.');
        return;
      }
      if (checkInDate === checkOutDate && checkInTime.trim() === checkOutTime.trim()) {
        alert(language === 'hi' ? 'घंटेवार स्टे में आगमन एवं प्रस्थान का समय समान नहीं हो सकता।' : 'Check-in and check-out times cannot be identical for hourly stay.');
        return;
      }
      if (hourlyHours <= 0) {
        alert(language === 'hi' ? 'कृपया न्यूनतम 1 घंटे की अवधि चुनें।' : 'Please select a duration of at least 1 hour.');
        return;
      }
    }

    if (conflicts.length > 0) {
      alert(
        (language === 'hi' ? 'कमरा पहले से आरक्षित है:\n' : 'Room is already booked:\n') +
        conflicts.join('\n') +
        (language === 'hi' ? '\n\nकृपया अन्य कमरा, समय स्लॉट अथवा तिथि चुनें।' : '\n\nPlease choose another room, time slot or date.')
      );
      return;
    }

    setSubmitting(true);
    try {
      const numRooms = Object.values(selectedSuits).filter(Boolean).length || 1;
      const hrRate = Number(hourlyRate) || 0;
      let perRoomRent = manualAmount.trim() ? Number(manualAmount) : 0;
      let dayTotalAmount = 0;

      if (stayType === 'HOURLY') {
        if (hrRate > 0) {
          perRoomRent = hrRate * hourlyHours;
          dayTotalAmount = perRoomRent * numRooms;
        } else if (perRoomRent > 0) {
          dayTotalAmount = perRoomRent * numRooms;
        }
      } else {
        dayTotalAmount = perRoomRent * numRooms;
      }

      // Safely preserve existing collection, expenditure, and payment records
      const existingMeta = parseBookingMeta(booking.notes);
      const safeFoodAmount = existingMeta.foodAmount !== undefined
        ? existingMeta.foodAmount
        : (booking.food_amount !== undefined && Number(booking.food_amount) > 0 ? Number(booking.food_amount) : undefined);
      const safeExpenditure = existingMeta.expenditure !== undefined
        ? existingMeta.expenditure
        : (booking.expenditure !== undefined && Number(booking.expenditure) > 0 ? Number(booking.expenditure) : undefined);
      const safePaymentMode = existingMeta.paymentMode || booking.payment_mode;
      const safeCollectedBy = existingMeta.collectedBy || booking.collected_by;
      const safeCollectionNote = existingMeta.collectionNote;

      // Re-encode metadata safely so group_id, dispatch_no, checkInDate, checkOutDate, ratePerRoom & collections are NEVER lost
      const finalNotes = (bookingRef || dispatchNo)
        ? encodeNotesWithMeta(
            notes.trim(),
            bookingRef,
            dispatchNo,
            checkInDate,
            checkOutDate,
            perRoomRent,
            safeFoodAmount,
            safePaymentMode,
            safeCollectedBy,
            safeCollectionNote,
            safeExpenditure,
            stayType,
            stayType === 'HOURLY' ? hourlyHours : undefined,
            stayType === 'HOURLY' && hrRate > 0 ? hrRate : undefined,
            checkInTime.trim(),
            checkOutTime.trim()
          )
        : notes.trim();

      const updatedData: Partial<Booking> = {
        guest_name: guestName.trim(),
        mobile_number: cleanedMobile,
        reference: (reference === 'OTHER' && otherReferenceName.trim()) ? otherReferenceName.trim() : reference.trim(),
        check_in_time: checkInTime.trim(),
        check_out_time: checkOutTime.trim(),
        booking_type: stayType,
        stay_hours: stayType === 'HOURLY' ? hourlyHours : undefined,
        hourly_rate: stayType === 'HOURLY' && hrRate > 0 ? hrRate : undefined,
        suit_1: selectedSuits.suit_1 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        suit_2: selectedSuits.suit_2 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        suit_3: selectedSuits.suit_3 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        suit_4: selectedSuits.suit_4 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        total_amount: dayTotalAmount > 0 ? dayTotalAmount : perRoomRent,
        meal_type_status: mealStatus,
        status: status,
        notes: finalNotes,
        food_amount: safeFoodAmount,
        expenditure: safeExpenditure,
        payment_mode: safePaymentMode,
        collected_by: safeCollectedBy,
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
      alert(
        language === 'hi'
          ? `संशोधन विफल: ${err.message || 'त्रुटि उत्पन्न हुई'}`
          : `Update failed: ${err.message || 'Error occurred'}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getMealStatusLabel = (st: string) => {
    if (language === 'hi') {
      if (st === 'PAID') return 'सशुल्क';
      if (st === 'COMPLIMENTARY') return 'शासकीय / वीआईपी';
      if (st === 'AS PER APPLICABLE' || st === 'AS_PER_APPLICABLE') return 'नियमानुसार';
      if (st === 'NOT REQUIRED') return 'लागू नहीं';
      if (st === 'FREE') return 'निःशुल्क';
      if (st === 'PENDING') return 'लंबित';
    } else {
      if (st === 'PAID') return 'Paid';
      if (st === 'COMPLIMENTARY') return 'Complimentary (Govt/VIP)';
      if (st === 'AS PER APPLICABLE' || st === 'AS_PER_APPLICABLE') return 'As per Applicable';
      if (st === 'NOT REQUIRED') return 'Not Required';
      if (st === 'FREE') return 'Free';
      if (st === 'PENDING') return 'Pending';
    }
    return st;
  };

  if (!isOpen || !booking) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500 shrink-0">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
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
                {language === 'hi' ? 'अतिथि का नाम *' : 'Guest Name *'}
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={language === 'hi' ? 'अतिथि का नाम दर्ज करें' : 'Enter guest name'}
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
                onChange={(e) => {
                  setReference(e.target.value);
                  if (e.target.value !== 'OTHER') setOtherReferenceName('');
                }}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white"
              >
                {REFERENCES.map((ref) => (
                  <option key={ref} value={ref}>
                    {ref}
                  </option>
                ))}
              </select>
              {reference === 'OTHER' && (
                <input
                  type="text"
                  value={otherReferenceName}
                  onChange={(e) => setOtherReferenceName(e.target.value)}
                  placeholder={language === 'hi' ? 'अधिकारी का नाम लिखें...' : 'Enter officer name...'}
                  className="w-full mt-2 px-3.5 py-2 text-sm rounded-lg border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-amber-50"
                />
              )}
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

          {/* Stay Type Toggle: Standard vs Hourly */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setStayType('STANDARD');
                const d = new Date(checkInDate + (checkInDate.length === 10 ? 'T00:00:00' : ''));
                if (!isNaN(d.getTime())) {
                  d.setDate(d.getDate() + 1);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setCheckOutDate(`${y}-${m}-${day}`);
                }
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                stayType === 'STANDARD'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'hi' ? 'पूर्ण दिवस / रात्रि' : 'Standard Stay'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStayType('HOURLY');
                setCheckOutDate(checkInDate);
                if (!checkInTime || checkInTime === '12:00 PM') {
                  setCheckInTime('10:00 AM');
                  setCheckOutTime('02:00 PM');
                  setHourlyHours(4);
                }
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                stayType === 'HOURLY'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'घंटे अनुसार (अल्पकालिक)' : 'Hourly / Short Stay'}</span>
            </button>
          </div>

          {/* Stay Dates & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {stayType === 'HOURLY' ? (
              <div className="col-span-full">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-amber-600" />
                    {language === 'hi' ? 'त्वरित अवधि चयन (घंटे):' : 'Quick Stay Duration (Hours):'}
                  </label>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200">
                    ⏱️ {hourlyHours} {language === 'hi' ? 'घंटे' : 'hrs'} ({checkInTime} - {checkOutTime})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[2, 3, 4, 6, 8, 12].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectPresetHours(h)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        hourlyHours === h
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40'
                      }`}
                    >
                      {h} {language === 'hi' ? 'घंटे' : 'hrs'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                {language === 'hi' ? (stayType === 'HOURLY' ? 'ठहराव की तारीख' : 'आगमन तिथि') : (stayType === 'HOURLY' ? 'Stay Date' : 'Check-In Date')}
              </label>
              <input
                type="date"
                required
                value={checkInDate}
                onChange={(e) => {
                  const newIn = e.target.value;
                  setCheckInDate(newIn);
                  if (stayType === 'HOURLY') {
                    setCheckOutDate(newIn);
                  } else if (newIn > checkOutDate) {
                    setCheckOutDate(newIn);
                  }
                }}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                {language === 'hi' ? 'प्रस्थान तिथि' : 'Check-Out Date'}
              </label>
              <input
                type="date"
                required
                min={stayType === 'HOURLY' ? checkInDate : checkInDate}
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                disabled={stayType === 'HOURLY'}
                className={`w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 ${
                  stayType === 'HOURLY' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>

            {/* Check-In & Check-Out Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {language === 'hi' ? 'चेक-इन समय' : 'Check-In Time'}
              </label>
              <input
                type="text"
                value={checkInTime}
                onChange={(e) => handleCheckInTimeChange(e.target.value)}
                placeholder="10:00 AM"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white font-mono"
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
                onChange={(e) => handleCheckOutTimeChange(e.target.value)}
                placeholder="02:00 PM"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white font-mono"
              />
            </div>

            <div className="col-span-full text-xs font-semibold text-slate-600 flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-[11px] text-slate-500">
                {stayType === 'HOURLY'
                  ? (language === 'hi' ? 'घंटे अनुसार बुकिंग: उसी दिन का समय स्लॉट' : 'Hourly Stay: Same-day time slot')
                  : (language === 'hi' ? 'सामान्य ठहराव: दोपहर 12:00 से अगले दिन 12:00' : 'Standard Stay')}
              </span>
              <span className="font-bold text-slate-800">
                {stayType === 'HOURLY'
                  ? (language === 'hi' ? `कुल अवधि: ${hourlyHours} घंटे (अल्पकालिक)` : `Total Stay: ${hourlyHours} Hour(s)`)
                  : (language === 'hi' ? `कुल प्रवास: ${calculateStayNights(checkInDate, checkOutDate)} रात्रि (${calculateStayNights(checkInDate, checkOutDate)} दिवस)` : `Total Stay: ${calculateStayNights(checkInDate, checkOutDate)} Night(s)`)}
              </span>
            </div>
          </div>

          {/* Suits Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                {language === 'hi' ? 'कमरा आवंटन (सूट चुनें):' : 'Select Room(s) to Allocate:'}
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {Object.values(selectedSuits).filter(Boolean).length} {language === 'hi' ? 'सूट चयनित' : 'suits selected'}
              </span>
            </div>

            {/* Real-time Conflict Alert Banner */}
            {conflicts.length > 0 && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-rose-900 animate-in fade-in duration-150 shadow-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-rose-800">
                    {language === 'hi' ? 'कमरा पहले से आरक्षित है (Room Already Booked):' : 'Booking Conflict Detected:'}
                  </div>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-rose-700">
                    {conflicts.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                  <div className="mt-1 text-[11px] text-rose-600 font-medium">
                    {language === 'hi' ? 'कृपया अन्य कमरा या अन्य तारीख चुनें।' : 'Please choose another room or date.'}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SUITS.map((suit) => {
                const isSelected = !!selectedSuits[suit.id];
                const avail = getSuitAvailability(suit.id);

                if (avail.isBooked) {
                  return (
                    <div
                      key={suit.id}
                      className="rounded-xl p-2.5 border-2 border-rose-300 bg-rose-50/80 text-rose-950 flex flex-col justify-between select-none cursor-not-allowed opacity-90 shadow-2xs"
                      title={
                        language === 'hi'
                          ? `${suit.name}: दिनांक ${formatToDisplayDate(avail.date)} को ${avail.guestName} के लिए आरक्षित है (चयन नहीं किया जा सकता)`
                          : `${suit.name}: Already booked on ${formatToDisplayDate(avail.date)} for ${avail.guestName} (disabled)`
                      }
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-800 line-through decoration-rose-500">
                          {suit.name}
                        </span>
                        <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-rose-200 flex flex-col items-center">
                        <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded text-center w-full truncate border border-rose-200">
                          <Lock className="w-2.5 h-2.5" />
                          <span>
                            {avail.isMaintenance
                              ? (language === 'hi' ? 'मरम्मत ब्लॉक' : 'Maintenance')
                              : (language === 'hi' ? 'आरक्षित' : 'Booked')}
                          </span>
                        </span>
                        <span
                          className="text-[10px] text-slate-700 truncate mt-0.5 max-w-full font-bold"
                          title={avail.guestName}
                        >
                          👤 {avail.guestName}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {formatToDisplayDate(avail.date)}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={suit.id}
                    onClick={() => handleSuitToggle(suit.id)}
                    className={`cursor-pointer rounded-xl p-2.5 border-2 transition flex flex-col justify-between select-none ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-950 shadow-xs ring-2 ring-amber-400/20'
                        : 'border-emerald-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/30 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                        {suit.name}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-center">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-center w-full ${
                          isSelected
                            ? 'bg-amber-200/80 text-amber-950'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {isSelected
                          ? (language === 'hi' ? 'चयनित' : 'Selected')
                          : (language === 'hi' ? 'उपलब्ध' : 'Available')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room Rent Input (Standard vs Hourly) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            {stayType === 'HOURLY' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {language === 'hi' ? 'प्रति घंटा दर (₹/घंटा)' : 'Hourly Rate (₹/Hour)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={hourlyRate}
                        onChange={(e) => {
                          setHourlyRate(e.target.value);
                          if (e.target.value) setManualAmount('');
                        }}
                        placeholder="उदा० 100 / घंटा"
                        className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-600" />
                      {language === 'hi' ? 'अथवा एकमुश्त किराया (₹)' : 'Or Flat Room Rent (₹)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={manualAmount}
                        onChange={(e) => {
                          setManualAmount(e.target.value);
                          if (e.target.value) setHourlyRate('');
                        }}
                        placeholder="उदा० 500"
                        className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {(Number(hourlyRate) > 0 || Number(manualAmount) > 0) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 gap-1">
                    <span>{language === 'hi' ? 'कुल अल्पकालिक देय किराया:' : 'Total Hourly Rent:'}</span>
                    <span className="font-mono font-bold">
                      {Number(hourlyRate) > 0 ? (
                        <>
                          {Object.values(selectedSuits).filter(Boolean).length || 1} {language === 'hi' ? 'कमरा' : 'Room(s)'} × ₹{Number(hourlyRate)}/घंटा × {hourlyHours} {language === 'hi' ? 'घंटे' : 'hrs'} = ₹{((Object.values(selectedSuits).filter(Boolean).length || 1) * Number(hourlyRate) * hourlyHours).toLocaleString('en-IN')}/-
                        </>
                      ) : (
                        <>
                          {Object.values(selectedSuits).filter(Boolean).length || 1} {language === 'hi' ? 'कमरा' : 'Room(s)'} × ₹{Number(manualAmount)} = ₹{((Object.values(selectedSuits).filter(Boolean).length || 1) * Number(manualAmount)).toLocaleString('en-IN')}/-
                        </>
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    {language === 'hi' ? 'प्रति कमरा दैनिक किराया (₹)' : 'Room Rent Per Day (₹)'}
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {Object.values(selectedSuits).filter(Boolean).length} {language === 'hi' ? 'सूट चयनित' : 'suits selected'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder={language === 'hi' ? 'लागू कमरा किराया दर दर्ज करें' : 'Enter room rent per day'}
                    className="w-full pl-8 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition bg-white font-mono"
                  />
                </div>
                {Number(manualAmount) > 0 && (
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <span>{language === 'hi' ? 'कुल देय किराया:' : 'Total Payable Rent:'}</span>
                    <span className="font-mono font-bold">
                      {Object.values(selectedSuits).filter(Boolean).length || 1} {language === 'hi' ? 'कमरा' : 'Room(s)'} × ₹{Number(manualAmount)} × {calculateStayNights(checkInDate, checkOutDate)} {language === 'hi' ? 'दिन' : 'Day(s)'} = ₹{((Object.values(selectedSuits).filter(Boolean).length || 1) * Number(manualAmount) * calculateStayNights(checkInDate, checkOutDate)).toLocaleString('en-IN')}/-
                    </span>
                  </div>
                )}
              </>
            )}
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
              {language === 'hi' ? 'विशेष टिप्पणी' : 'Remarks'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'hi' ? 'आवश्यक टिप्पणी (वैकल्पिक)' : 'Remarks (optional)'}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition bg-white"
            />
          </div>

          </div>

          {/* Fixed Footer Actions */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex-1 min-w-0 pr-2">
              {conflicts.length > 0 ? (
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {language === 'hi' ? 'कमरा पहले से आरक्षित है' : 'Room is already booked'}
                  </span>
                </span>
              ) : !Object.values(selectedSuits).some(Boolean) ? (
                <span className="text-xs font-semibold text-slate-500 truncate">
                  {language === 'hi' ? 'कृपया कम से कम एक सूट अवश्य चुनें' : 'Please select at least one suit'}
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {Object.values(selectedSuits).filter(Boolean).length} {language === 'hi' ? 'कमरा तैयार' : 'room(s) ready'}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-10 sm:h-11 px-5 text-sm font-semibold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting || conflicts.length > 0 || !Object.values(selectedSuits).some(Boolean)}
                title={
                  conflicts.length > 0
                    ? (language === 'hi' ? 'कमरा पहले से आरक्षित है' : 'Room is already booked')
                    : !Object.values(selectedSuits).some(Boolean)
                    ? (language === 'hi' ? 'कमरा चुनें' : 'Select a room')
                    : ''
                }
                className="flex items-center gap-2 h-10 sm:h-11 px-6 text-sm font-bold rounded-xl text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>
                  {submitting
                    ? (language === 'hi' ? 'सहेज रहे हैं...' : 'Saving...')
                    : (language === 'hi' ? 'संशोधन सुरक्षित करें' : 'Save Changes')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
