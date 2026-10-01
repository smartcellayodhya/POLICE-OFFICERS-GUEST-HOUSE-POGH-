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
          if (suitsMap[s] !== undefined) suitsMap[s] = true;
        });
        setSelectedSuits(suitsMap);
      } else {
        setSelectedSuits({ suit_1: true, suit_2: false, suit_3: false, suit_4: false });
      }
      setErrorMsg('');
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const dates = request.stay_type === 'HOURLY'
    ? [request.check_in_date]
    : getStayDates(request.check_in_date, request.check_out_date);

  const stayNights = calculateStayNights(request.check_in_date, request.check_out_date);

  // Check suit conflicts for these dates
  const getSuitAvailability = (suitId: string) => {
    const res = findConflictingBooking(
      existingBookings,
      suitId,
      dates,
      undefined,
      request.check_in_time || '12:00 PM',
      request.check_out_time || '12:00 PM',
      request.stay_type === 'HOURLY'
    );
    return res;
  };

  const handleSuitToggle = (suitId: string) => {
    setSelectedSuits((prev) => ({
      ...prev,
      [suitId]: !prev[suitId],
    }));
  };

  const handleRateChange = (suitId: string, val: number) => {
    setSuitRates((prev) => ({
      ...prev,
      [suitId]: Math.max(0, val),
    }));
  };

  const assignedSuitKeys = Object.keys(selectedSuits).filter((k) => selectedSuits[k]);

  // Compute total rent
  let dailyTotal = 0;
  assignedSuitKeys.forEach((k) => {
    dailyTotal += Number(suitRates[k] || 0);
  });
  const totalRentAmount = dailyTotal * Math.max(1, stayNights);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-100 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500/20 via-slate-800 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                आरक्षण अनुरोध स्वीकृत करें (Approve Booking)
              </h3>
              <p className="text-[11px] text-amber-400 font-mono font-semibold">
                {request.request_number}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2 whitespace-pre-line">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Guest Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">{request.guest_name}</span>
                {request.designation && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-semibold text-[10px]">
                    {request.designation}
                  </span>
                )}
                {request.department && (
                  <span className="text-slate-400 text-[11px]">({request.department})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono font-bold">{request.mobile_number}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px] pt-1">
              <div>
                <span className="text-slate-400 block text-[10px]">आगमन:</span>
                <span className="font-bold text-white">{formatToDisplayDate(request.check_in_date)}</span>
                <span className="text-slate-400 block text-[10px]">{request.check_in_time}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">प्रस्थान:</span>
                <span className="font-bold text-white">{formatToDisplayDate(request.check_out_date)}</span>
                <span className="text-slate-400 block text-[10px]">{request.check_out_time}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">स्टे अवधि:</span>
                <span className="font-bold text-amber-300">
                  {request.stay_type === 'HOURLY' ? 'घंटेवार' : `${stayNights} रात्रि / दिवस`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">संदर्भ:</span>
                <span className="font-semibold text-amber-300 truncate block">
                  {request.reference || 'SSP SIR'}
                </span>
              </div>
            </div>
          </div>


          {/* Room Allocation Matrix with Conflict Warnings */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              कक्ष आवंटन एवं दैनिक दर (Select Suit & Rate per day)
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
                        ? 'bg-rose-950/20 border-rose-900/60 opacity-80'
                        : isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={isConflict}
                          checked={isSelected && !isConflict}
                          onChange={() => handleSuitToggle(suit.id)}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                        <div>
                          <span className={`text-xs font-bold block ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                            {suit.name}
                          </span>
                          <span className="text-[10px] text-slate-400">{suit.id === 'suit_4' ? 'वीआईपी सुइट' : 'मानक सुइट'}</span>
                        </div>
                      </label>

                      {isConflict ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          आरक्षित ({avail.guestName})
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-[10.5px] text-slate-400">₹</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            disabled={!isSelected}
                            value={suitRates[suit.id] ?? (suit.id === 'suit_4' ? 1200 : 800)}
                            onChange={(e) => handleRateChange(suit.id, Number(e.target.value))}
                            className="w-16 px-1.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold text-right disabled:opacity-40"
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
              <label className="block text-slate-300 font-semibold mb-1">
                आधिकारिक संदर्भ (Reference)
              </label>
              <select
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
              >
                {REFERENCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                डिस्पैच / पत्र संख्या (Dispatch No.)
              </label>
              <input
                type="text"
                value={dispatchNo}
                onChange={(e) => setDispatchNo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                भोजन स्थिति (Meal Status)
              </label>
              <select
                value={mealStatus}
                onChange={(e) => setMealStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
              >
                <option value="PAID">सशुल्क (Paid)</option>
                <option value="FREE">निःशुल्क / शासकीय (Complimentary / Govt)</option>
                <option value="PENDING">लंबित (Pending)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                स्वीकृति टिप्पणी (Admin Notes)
              </label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="विशेष टिप्पणी (यदि कोई हो)..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Amount Calculation Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">कुल देय कमरा किराया:</span>
              <span className="font-extrabold text-amber-300 text-base tabular-nums">
                ₹{totalRentAmount.toLocaleString('en-IN')}/-
              </span>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <span>आवंटित कमरे: <strong className="text-white">{assignedSuitKeys.length}</strong></span>
              <span className="mx-1">•</span>
              <span>दिन: <strong className="text-white">{Math.max(1, stayNights)}</strong></span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            रद्द करें (Cancel)
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-400/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>पुष्टि की जा रही है...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>स्वीकार करें व कमरा आरक्षित करें</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
