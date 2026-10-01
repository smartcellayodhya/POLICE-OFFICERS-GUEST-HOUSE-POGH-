'use client';

import React, { useState } from 'react';
import { BookingRequest } from '@/lib/types';
import { apiRejectBookingRequest } from '@/lib/requestUtils';
import { X, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface RejectRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: BookingRequest | null;
  onRejectSuccess: () => Promise<void>;
}

const PRESET_REASONS = [
  'उपरोक्त तिथियों में सभी कमरे पूर्ण आरक्षित हैं (All Rooms Occupied)',
  'अनुरोध संदर्भ अपुष्ट / विवरण अपूर्ण है (Unverified Reference)',
  'आपातकालीन वीआईपी मूवमेंट आरक्षण (Emergency VIP Reservation)',
  'गेस्ट हाउस अनुरक्षण / मरम्मत कार्य (Maintenance Work)',
  'अन्य प्रशासनिक कारण (Administrative Reasons)',
];

export const RejectRequestModal: React.FC<RejectRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  onRejectSuccess,
}) => {
  const { language } = useLanguage();
  const [selectedPreset, setSelectedPreset] = useState(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !request) return null;

  const handleReject = async () => {
    setErrorMsg('');
    const finalReason = customReason.trim()
      ? `${selectedPreset}: ${customReason.trim()}`
      : selectedPreset;

    setSubmitting(true);
    try {
      const res = await apiRejectBookingRequest({
        requestId: request.id,
        rejectionReason: finalReason,
      });

      if (res.success) {
        await onRejectSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'अस्वीकृत करने में विफलता।');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'नेटवर्क समस्या के कारण अस्वीकार नहीं हो सका।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-rose-500">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold border border-rose-500/30">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {language === 'hi' ? 'अनुरोध अस्वीकृत करें' : 'Reject Booking Request'}
              </h3>
              <p className="text-xs text-rose-300 font-mono">
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <p className="text-slate-600">
              अतिथि: <strong className="text-slate-900">{request.guest_name}</strong> ({request.mobile_number})
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              अस्वीकृति का प्राथमिक कारण (Primary Reason)
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-400 focus:outline-none"
            >
              {PRESET_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              अतिरिक्त स्पष्टीकरण (वैकल्पिक टिप्पणी)
            </label>
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="यदि कोई अन्य विशेष कारण हो तो यहां दर्ज करें..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-slate-400 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
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
            onClick={handleReject}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>अस्वीकार किया जा रहा है...</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                <span>अस्वीकृत करें (Confirm Reject)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
