'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Booking } from '@/lib/types';
import { SUITS, REFERENCES, MEAL_STATUSES } from '@/lib/constants';
import { formatToISODate, getDatesInRange, getStayDates, calculateStayNights, formatToDisplayDate } from '@/lib/dateUtils';
import {
  generateBookingRef,
  generateDispatchNumber,
  encodeNotesWithMeta,
  findConflictingBooking,
  parseTimeToMinutes,
  formatMinutesToTime,
  calculateStayHours,
} from '@/lib/bookingUtils';
import { X, Calendar, User, Phone, Tag, Utensils, AlertTriangle, CheckCircle2, Hash, Clock, Wrench, Lock, Timer, IndianRupee, History } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { logActivity } from '@/lib/auditLog';

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

  const getNextDayISO = (dateStr: string): string => {
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + 1);
    return formatToISODate(d);
  };

  // Stay Type: Standard Overnight vs Hourly / Short Stay
  const [stayType, setStayType] = useState<'STANDARD' | 'HOURLY'>('STANDARD');
  const [hourlyHours, setHourlyHours] = useState<number>(4);
  const [hourlyRate, setHourlyRate] = useState<string>('');

  const [checkInDate, setCheckInDate] = useState(initialDate || today);
  const [checkOutDate, setCheckOutDate] = useState(() => getNextDayISO(initialDate || today));
  
  const [selectedSuits, setSelectedSuits] = useState<Record<string, boolean>>({
    suit_1: initialSuit === 'suit_1',
    suit_2: initialSuit === 'suit_2',
    suit_3: initialSuit === 'suit_3',
    suit_4: initialSuit === 'suit_4',
  });

  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('12:00 PM');
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [manualAmount, setManualAmount] = useState<string>('');
  const [mealStatus, setMealStatus] = useState<string>('PAID');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [autoRef, setAutoRef] = useState('');
  const [autoDispatch, setAutoDispatch] = useState('');

  const handleSelectPresetHours = (hrs: number) => {
    setHourlyHours(hrs);
    const inMin = parseTimeToMinutes(checkInTime) ?? 600; // default 10:00 AM
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

  const resetForm = useCallback(() => {
    setGuestName('');
    setMobileNumber('');
    setReference('SSP SIR');
    setStayType('STANDARD');
    setHourlyHours(4);
    setHourlyRate('');
    const baseDate = initialDate || formatToISODate(new Date());
    setCheckInDate(baseDate);
    const d = new Date(baseDate + (baseDate.length === 10 ? 'T00:00:00' : ''));
    let cout = baseDate;
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1);
      cout = formatToISODate(d);
      setCheckOutDate(cout);
    } else {
      setCheckOutDate(baseDate);
    }
    const initialStay = getStayDates(baseDate, cout);
    const availInitial = initialSuit
      ? findConflictingBooking(existingBookings, initialSuit, initialStay)
      : { isBooked: false };

    setSelectedSuits({
      suit_1: initialSuit === 'suit_1' && !availInitial.isBooked,
      suit_2: initialSuit === 'suit_2' && !availInitial.isBooked,
      suit_3: initialSuit === 'suit_3' && !availInitial.isBooked,
      suit_4: initialSuit === 'suit_4' && !availInitial.isBooked,
    });
    setCheckInTime('12:00 PM');
    setCheckOutTime('12:00 PM');
    setIsMaintenance(false);
    setManualAmount('');
    setMealStatus('PAID');
    setNotes('');
  }, [initialDate, initialSuit, existingBookings]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      const ref = generateBookingRef(existingBookings);
      const disp = generateDispatchNumber(existingBookings);
      setAutoRef(ref);
      setAutoDispatch(disp);
    }
  }, [isOpen, existingBookings, resetForm]);

  useEffect(() => {
    if (initialDate) {
      setCheckInDate(initialDate);
      const nextDay = getNextDayISO(initialDate);
      setCheckOutDate(nextDay);
      if (initialSuit) {
        const initialStay = getStayDates(initialDate, nextDay);
        const availInitial = findConflictingBooking(existingBookings, initialSuit, initialStay);
        setSelectedSuits({
          suit_1: initialSuit === 'suit_1' && !availInitial.isBooked,
          suit_2: initialSuit === 'suit_2' && !availInitial.isBooked,
          suit_3: initialSuit === 'suit_3' && !availInitial.isBooked,
          suit_4: initialSuit === 'suit_4' && !availInitial.isBooked,
        });
      }
    }
  }, [initialDate, initialSuit, existingBookings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const bookingDates = stayType === 'HOURLY' ? [checkInDate] : getStayDates(checkInDate, checkOutDate);
  const totalDays = stayType === 'HOURLY' ? 1 : calculateStayNights(checkInDate, checkOutDate);

  // Check real-time availability of each suit for the selected date range and time slot
  const getSuitAvailability = useCallback(
    (suitId: string) => {
      const dates = stayType === 'HOURLY' ? [checkInDate] : getStayDates(checkInDate, checkOutDate);
      const res = findConflictingBooking(
        existingBookings,
        suitId,
        dates,
        undefined,
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
    [checkInDate, checkOutDate, existingBookings, stayType, checkInTime, checkOutTime]
  );

  // Automatically uncheck any suit that becomes booked if the user changes the dates or times
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
  }, [getSuitAvailability]);

  const checkConflicts = () => {
    const conflictsList: string[] = [];
    SUITS.forEach((s) => {
      if (selectedSuits[s.id]) {
        const conflict = findConflictingBooking(
          existingBookings,
          s.id,
          bookingDates,
          undefined,
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

  const handleSuitToggle = (suitId: string) => {
    const avail = getSuitAvailability(suitId);
    if (avail.isBooked) return; // Prevent selecting already booked suits

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

    const cleanedMobile = mobileNumber.replace(/\D/g, '');
    if (cleanedMobile.length !== 10) {
      alert(language === 'hi' ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
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

    const hasAnySuit = Object.values(selectedSuits).some(Boolean);
    if (!hasAnySuit) {
      alert(language === 'hi' ? 'कृपया कम से कम एक कमरा (Suit) चुनें।' : 'Please select at least one suit.');
      return;
    }

    if (conflicts.length > 0) {
      alert(
        (language === 'hi' ? 'कमरा पहले से आरक्षित है:\n' : 'Room is already booked:\n') +
        conflicts.join('\n') +
        (language === 'hi' ? '\n\nकृपया अन्य तिथि, समय स्लॉट अथवा कमरा चुनें।' : '\n\nPlease select another date, time slot or room.')
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

      const finalNotes = encodeNotesWithMeta(
        notes.trim(),
        autoRef,
        autoDispatch,
        checkInDate,
        checkOutDate,
        perRoomRent,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        stayType,
        stayType === 'HOURLY' ? hourlyHours : undefined,
        stayType === 'HOURLY' && hrRate > 0 ? hrRate : undefined,
        checkInTime.trim(),
        checkOutTime.trim()
      );

      const recordsToCreate: Booking[] = bookingDates.map((dateStr) => ({
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random()}`,
        group_id: autoRef,
        dispatch_no: autoDispatch,
        booking_date: dateStr,
        guest_name: guestName.trim(),
        mobile_number: cleanedMobile,
        reference: reference.trim(),
        suit_1: selectedSuits.suit_1 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        suit_2: selectedSuits.suit_2 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        suit_3: selectedSuits.suit_3 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        suit_4: selectedSuits.suit_4 ? (perRoomRent > 0 ? perRoomRent : 1) : 0,
        total_amount: dayTotalAmount > 0 ? dayTotalAmount : perRoomRent,
        meal_type_status: mealStatus,
        status: isMaintenance ? 'MAINTENANCE' : 'CONFIRMED',
        check_in_time: checkInTime.trim(),
        check_out_time: checkOutTime.trim(),
        booking_type: stayType,
        stay_hours: stayType === 'HOURLY' ? hourlyHours : undefined,
        hourly_rate: stayType === 'HOURLY' && hrRate > 0 ? hrRate : undefined,
        is_maintenance: isMaintenance,
        notes: finalNotes,
        created_at: new Date().toISOString(),
      }));

      await onSave(recordsToCreate);

      logActivity(
        isMaintenance ? 'MAINTENANCE' : 'CREATE',
        isMaintenance ? `कमरा मरम्मत ब्लॉक: ${autoRef}` : `${stayType === 'HOURLY' ? 'अल्पकालिक बुकिंग' : 'नई बुकिंग'}: ${autoRef}`,
        `अतिथि: ${guestName}, तारीख: ${checkInDate} से ${checkOutDate}${stayType === 'HOURLY' ? ` (${hourlyHours} घंटे, ${checkInTime} - ${checkOutTime})` : ''}, स्थिति: ${isMaintenance ? 'MAINTENANCE' : 'CONFIRMED'}`
      );

      resetForm();
      onClose();

      if (isMaintenance) {
        alert(language === 'hi' ? 'कमरा मरम्मत ब्लॉक सफलतापूर्वक दर्ज किया गया!' : 'Maintenance block saved successfully!');
      }
    } catch (err: any) {
      console.error('Error saving booking:', err);
      alert(
        language === 'hi'
          ? 'बुकिंग सुरक्षित करने में विफल: ' + (err?.message || 'अज्ञात त्रुटि')
          : 'Failed to save booking: ' + (err?.message || 'Unknown error')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getMealStatusLabel = (status: string) => {
    if (language === 'hi') {
      if (status === 'PAID') return 'सशुल्क';
      if (status === 'COMPLIMENTARY') return 'शासकीय / वीआईपी';
      if (status === 'AS PER APPLICABLE' || status === 'AS_PER_APPLICABLE') return 'नियमानुसार';
      if (status === 'NOT REQUIRED') return 'लागू नहीं';
      if (status === 'FREE') return 'निःशुल्क';
      if (status === 'PENDING') return 'लंबित';
    } else {
      if (status === 'PAID') return 'Paid';
      if (status === 'COMPLIMENTARY') return 'Complimentary (Govt/VIP)';
      if (status === 'AS PER APPLICABLE' || status === 'AS_PER_APPLICABLE') return 'As per Applicable';
      if (status === 'NOT REQUIRED') return 'Not Required';
      if (status === 'FREE') return 'Free';
      if (status === 'PENDING') return 'Pending';
    }
    return status;
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        
        {/* Header with Reference and Dispatch */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold">
                {language === 'hi' ? 'नयी अतिथि बुकिंग' : 'New Guest Booking'}
              </h3>
              {autoRef && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">
                  {autoRef}
                </span>
              )}
              {autoDispatch && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                  {autoDispatch}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
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
                inputMode="numeric"
                maxLength={10}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
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

          {/* Stay Type Toggle: Standard vs Hourly */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setStayType('STANDARD');
                const next = getNextDayISO(checkInDate);
                setCheckOutDate(next);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                stayType === 'STANDARD'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'hi' ? 'पूर्ण दिवस / रात्रि ठहराव' : 'Standard Overnight Stay'}</span>
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  {language === 'hi' ? (stayType === 'HOURLY' ? 'ठहराव की तारीख' : 'आगमन तिथि') : (stayType === 'HOURLY' ? 'Stay Date' : 'Check-in Date')}
                </label>
                {checkInDate < today && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <History className="w-2.5 h-2.5 text-amber-700" />
                    <span>{language === 'hi' ? 'पूर्व तिथि प्रविष्टि' : 'Past Date Entry'}</span>
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                value={checkInDate}
                onChange={(e) => {
                  const newIn = e.target.value;
                  setCheckInDate(newIn);
                  if (stayType === 'HOURLY') {
                    setCheckOutDate(newIn);
                  } else if (checkOutDate <= newIn) {
                    setCheckOutDate(getNextDayISO(newIn));
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
                min={stayType === 'HOURLY' ? checkInDate : getNextDayISO(checkInDate)}
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                disabled={stayType === 'HOURLY'}
                className={`w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 ${
                  stayType === 'HOURLY' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>

            {/* Check-in & Check-out time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {language === 'hi' ? 'चेक-इन समय' : 'Check-in Time'}
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
                {language === 'hi' ? 'चेक-आउट समय' : 'Check-out Time'}
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
                  : (language === 'hi' ? 'सामान्य ठहराव: दोपहर 12:00 से अगले दिन 12:00' : 'Standard Stay: 12:00 PM to Next Day 12:00 PM')}
              </span>
              <span className="font-bold text-slate-800">
                {stayType === 'HOURLY'
                  ? (language === 'hi' ? `कुल अवधि: ${hourlyHours} घंटे (अल्पकालिक)` : `Total Stay: ${hourlyHours} Hour(s)`)
                  : (language === 'hi' ? `कुल प्रवास अवधि: ${totalDays} रात्रि (${totalDays} दिवस)` : `Total Stay: ${totalDays} Night(s)`)}
              </span>
            </div>
          </div>

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
                <div>
                  <label className="text-xs font-bold text-slate-800">
                    {language === 'hi' ? 'प्रति कमरा दैनिक किराया (₹)' : 'Room Rent Per Day (₹)'}
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
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
                      {Object.values(selectedSuits).filter(Boolean).length || 1} {language === 'hi' ? 'कमरा' : 'Room(s)'} × ₹{Number(manualAmount)} × {totalDays} {language === 'hi' ? 'दिन' : 'Day(s)'} = ₹{((Object.values(selectedSuits).filter(Boolean).length || 1) * Number(manualAmount) * totalDays).toLocaleString('en-IN')}/-
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Maintenance Mode Option */}
          <div className="pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 hover:text-slate-900 select-none">
              <input
                type="checkbox"
                checked={isMaintenance}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsMaintenance(checked);
                  if (checked) {
                    setGuestName(language === 'hi' ? 'कमरा मरम्मत / ब्लॉक' : 'Room Maintenance / Block');
                    setMobileNumber('8317041684');
                    setReference('MAINTENANCE');
                    setMealStatus('NOT REQUIRED');
                    setManualAmount('0');
                  } else {
                    setGuestName('');
                    setMobileNumber('');
                    setReference('SSP SIR');
                    setMealStatus('PAID');
                  }
                }}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-purple-600" />
                {language === 'hi' ? 'कमरा मरम्मत / ब्लॉक' : 'Maintenance / Block'}
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'hi' ? 'विशेष टिप्पणी' : 'Remarks'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'hi' ? 'आवश्यक टिप्पणी (वैकल्पिक)' : 'Remarks (optional)'}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-amber-500 outline-none"
            />
          </div>

          </div>

          {/* Fixed Footer */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 shrink-0">
            {/* Validation Status Message */}
            <div className="mb-2">
              {conflicts.length > 0 ? (
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {language === 'hi' ? 'कमरा पहले से आरक्षित है' : 'Room is already booked'}
                  </span>
                </span>
              ) : !Object.values(selectedSuits).some(Boolean) ? (
                <span className="text-xs font-semibold text-slate-500">
                  {language === 'hi' ? 'कृपया कम से कम एक कमरा चुनें' : 'Please select at least one suit'}
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {Object.values(selectedSuits).filter(Boolean).length} {language === 'hi' ? 'कमरा तैयार' : 'room(s) ready'}
                  </span>
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-10 sm:h-11 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-xl transition cursor-pointer"
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
                className="h-10 sm:h-11 px-6 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 flex items-center gap-2"
              >
                {submitting
                  ? (language === 'hi' ? 'पुष्टि की जा रही है...' : 'Confirming...')
                  : (language === 'hi' ? 'बुकिंग सुरक्षित करें' : 'Confirm & Save Booking')}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
