'use client';

import React, { useState, useEffect } from 'react';
import { BookingRequest, Booking } from '@/lib/types';
import { SUITS, REFERENCES } from '@/lib/constants';
import { formatToDisplayDate, getStayDates, calculateStayNights } from '@/lib/dateUtils';
import { findConflictingBooking, generateDispatchNumber } from '@/lib/bookingUtils';
import { apiApproveBookingRequest } from '@/lib/requestUtils';
import { X, CheckCircle2, AlertTriangle, BedDouble, Calendar, User, Phone, Tag, Hash, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface ApproveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: BookingRequest | null;
  existingBookings: Booking[];
  onApproveSuccess: (approvedBooking?: Booking) => Promise<void>;
}

export const ApproveRequestModal: React.FC<ApproveRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  existingBookings,
  onApproveSuccess,
}) => {
  const { language } = useLanguage();

  const [selectedSuits, setSelectedSuits] = useState<Record<string, boolean>>({
    suit_1: true,
    suit_2: false,
    suit_3: false,
    suit_4: false,
  });

  const [suitRates, setSuitRates] = useState<Record<string, number>>({
    suit_1: 800,
    suit_2: 800,
    suit_3: 800,
    suit_4: 1200,
  });

  const [reference, setReference] = useState('SSP SIR');
  const [dispatchNo, setDispatchNo] = useState('');
  const [mealStatus, setMealStatus] = useState('PAID');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Set default values when request opens
  useEffect(() => {
    if (request) {
      setReference(request.reference || 'SSP SIR');
      setDispatchNo(generateDispatchNumber(existingBookings));

      // If user preferred suits in request, pre-select them
      if (request.requested_suits && request.requested_suits.length > 0) {
        const suitsMap: Record<string, boolean> = {
          suit_1: false,
          suit_2: false,
          suit_3: false,
          suit_4: false,
        };
        request.requested_suits.forEach((s) => {
          const key = s.toLowerCase();
          if (suitsMap[key] !== undefined) suitsMap[key] = true;
        });
        setSelectedSuits(suitsMap);
      } else {
        setSelectedSuits({ suit_1: true, suit_2: false, suit_3: false, suit_4: false });
      }

      setErrorMsg('');
    }
  }, [request, existingBookings]);

  if (!isOpen || !request) return null;

  const stayDates = getStayDates(request.check_in_date, request.check_out_date);
  const stayNights = calculateStayNights(request.check_in_date, request.check_out_date);

  // Check room conflict
  const getSuitAvailability = (suitKey: string) => {
    const conflict = findConflictingBooking(
      existingBookings,
      suitKey,
      stayDates,
      undefined,
      request.check_in_time,
      request.check_out_time,
      request.stay_type === 'HOURLY'
    );
    if (conflict.isBooked && conflict.booking) {
      return {
        isBooked: true,
        conflictingDate: conflict.conflictingDate,
        booking: conflict.booking,
        guestName: conflict.booking.guest_name,
      };
    }
    return { isBooked: false };
  };

  const handleSuitToggle = (suitKey: string) => {
    setSelectedSuits((prev) => ({
      ...prev,
      [suitKey]: !prev[suitKey],
    }));
  };

  const handleRateChange = (suitKey: string, rate: number) => {
    setSuitRates((prev) => ({
      ...prev,
      [suitKey]: Math.max(0, rate),
    }));
  };

  // Calculation
  const assignedSuitKeys = Object.keys(selectedSuits).filter((k) => selectedSuits[k]);
  const totalDailyRent = assignedSuitKeys.reduce((sum, key) => sum + (suitRates[key] || 0), 0);
  const totalRentAmount = totalDailyRent * Math.max(1, stayNights);

  const handleApprove = async () => {
    setErrorMsg('');
    if (assignedSuitKeys.length === 0) {
      setErrorMsg('कृपया कम से कम एक कमरा (Suit) आवंटित करें।');
      return;
    }

    // Check if any assigned suit has conflict
    const conflictErrors: string[] = [];
    assignedSuitKeys.forEach((sKey) => {
      const avail = getSuitAvailability(sKey);
      if (avail.isBooked && avail.booking) {
        conflictErrors.push(
          `${sKey.toUpperCase()} दिनांक ${formatToDisplayDate(avail.conflictingDate || '')} को ${avail.guestName || avail.booking.guest_name} के लिए पहले से आरक्षित है।`
        );
      }
    });

    if (conflictErrors.length > 0) {
      setErrorMsg(`कमरा टकराव:\n${conflictErrors.join('\n')}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiApproveBookingRequest({
        requestId: request.id,
        assignedSuits: assignedSuitKeys,
        suitRates,
        reference,
        dispatchNo,
        mealStatus,
        notes: adminNotes,
      });

      if (res.success) {
        await onApproveSuccess(res.approvedBooking);
        onClose();
      } else {
        setErrorMsg(res.error || 'अनुरोध स्वीकृत करने में विफलता।');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'नेटवर्क त्रुटि के कारण कार्रवाई पूर्ण नहीं हो सकी।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-800 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {language === 'hi' ? 'आरक्षण अनुरोध स्वीकृत करें' : 'Approve Booking Request'}
              </h3>
              <p className="text-xs text-amber-300 font-mono">
                {request.request_number}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 whitespace-pre-line">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Guest Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{request.guest_name}</span>
                {request.designation && (
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-[11px]">
                    {request.designation}
                  </span>
                )}
                {request.department && (
                  <span className="text-slate-500 text-[11px]">({request.department})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold">{request.mobile_number}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px] pt-1">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">आगमन (Check-in):</span>
                <span className="font-bold text-slate-800">{formatToDisplayDate(request.check_in_date)}</span>
                <span className="text-slate-500 block text-[10px]">{request.check_in_time}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">प्रस्थान (Check-out):</span>
                <span className="font-bold text-slate-800">{formatToDisplayDate(request.check_out_date)}</span>
                <span className="text-slate-500 block text-[10px]">{request.check_out_time}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">अवधि (Nights):</span>
                <span className="font-bold text-slate-800">
                  {request.stay_type === 'HOURLY' ? 'घंटेवार' : `${stayNights} रात्रि`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">संदर्भ (Reference):</span>
                <span className="font-bold text-slate-800 truncate block">
                  {request.reference || 'SSP SIR'}
                </span>
              </div>
            </div>
          </div>

          {/* Room Allocation Matrix with Conflict Warnings */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              कक्ष आवंटन एवं दैनिक दर (Select Suit & Daily Tariff)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUITS.map((suit) => {
                const isSelected = !!selectedSuits[suit.id];
                const avail = getSuitAvailability(suit.id);
                const isConflict = avail.isBooked;

                return (
                  <div
                    key={suit.id}
                    className={`p-3 rounded-xl border transition ${
                      isConflict
                        ? 'bg-rose-50 border-rose-200 text-rose-800 opacity-80'
                        : isSelected
                        ? 'bg-amber-50/70 border-amber-400 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={isConflict}
                          checked={isSelected && !isConflict}
                          onChange={() => handleSuitToggle(suit.id)}
                          className="w-4 h-4 rounded text-slate-900 focus:ring-0 border-slate-300 cursor-pointer"
                        />
                        <div>
                          <span className={`text-xs font-bold block ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                            {suit.name}
                          </span>
                          <span className="text-[10px] text-slate-400">{suit.id === 'suit_4' ? 'वीआईपी सुइट' : 'मानक सुइट'}</span>
                        </div>
                      </label>

                      {isConflict ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          आरक्षित ({avail.guestName})
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500 font-semibold">₹</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            disabled={!isSelected}
                            value={suitRates[suit.id] ?? (suit.id === 'suit_4' ? 1200 : 800)}
                            onChange={(e) => handleRateChange(suit.id, Number(e.target.value))}
                            className="w-18 px-2 py-1 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold text-right disabled:opacity-40 focus:bg-white focus:border-slate-400 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reference & Dispatch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                आधिकारिक संदर्भ (Reference)
              </label>
              <select
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-400 focus:outline-none"
              >
                {REFERENCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                डिस्पैच / पत्र संख्या (Dispatch No.)
              </label>
              <input
                type="text"
                value={dispatchNo}
                onChange={(e) => setDispatchNo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-400 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                भोजन स्थिति (Meal Status)
              </label>
              <select
                value={mealStatus}
                onChange={(e) => setMealStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-400 focus:outline-none"
              >
                <option value="PAID">सशुल्क (Paid)</option>
                <option value="FREE">निःशुल्क / शासकीय (Complimentary / Govt)</option>
                <option value="PENDING">लंबित (Pending)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                स्वीकृति टिप्पणी (Admin Notes)
              </label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="विशेष निर्देश अथवा टिप्पणी..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Amount Calculation Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[10.5px]">कुल देय कमरा किराया:</span>
              <span className="font-extrabold text-slate-900 text-base tabular-nums">
                ₹{totalRentAmount.toLocaleString('en-IN')}/-
              </span>
            </div>
            <div className="text-right text-xs text-slate-500">
              <span>कमरे: <strong className="text-slate-800">{assignedSuitKeys.length}</strong></span>
              <span className="mx-1.5">•</span>
              <span>दिन: <strong className="text-slate-800">{Math.max(1, stayNights)}</strong></span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
          >
            रद्द करें (Cancel)
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>पुष्टि की जा रही है...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>स्वीकार करें व कमरा आरक्षित करें</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
