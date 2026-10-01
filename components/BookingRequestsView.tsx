'use client';

import React, { useState, useMemo } from 'react';
import { BookingRequest, Booking } from '@/lib/types';
import { formatToDisplayDate, calculateStayNights } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Calendar,
  Building2,
  Tag,
  Share2,
  RefreshCw,
  Filter,
  Check,
  BedDouble,
  UserCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { ApproveRequestModal } from './ApproveRequestModal';
import { RejectRequestModal } from './RejectRequestModal';

interface BookingRequestsViewProps {
  requests: BookingRequest[];
  existingBookings: Booking[];
  isAdmin: boolean;
  isOperator: boolean;
  onRefresh: () => Promise<void>;
  onNavigateToBookings?: () => void;
  onOpenLetter?: (booking: Booking) => void;
}

export const BookingRequestsView: React.FC<BookingRequestsViewProps> = ({
  requests,
  existingBookings,
  isAdmin,
  isOperator,
  onRefresh,
  onNavigateToBookings,
  onOpenLetter,
}) => {
  const { language } = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [selectedForApprove, setSelectedForApprove] = useState<BookingRequest | null>(null);
  const [selectedForReject, setSelectedForReject] = useState<BookingRequest | null>(null);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Metrics
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Status filter
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const nameMatch = (r.guest_name || '').toLowerCase().includes(query);
        const mobileMatch = (r.mobile_number || '').includes(query);
        const reqNumMatch = (r.request_number || '').toLowerCase().includes(query);
        const refMatch = (r.reference || '').toLowerCase().includes(query);
        const deptMatch = (r.department || '').toLowerCase().includes(query);
        const desigMatch = (r.designation || '').toLowerCase().includes(query);
        if (!nameMatch && !mobileMatch && !reqNumMatch && !refMatch && !deptMatch && !desigMatch) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, searchTerm]);

  // WhatsApp Message Generator
  const getRequestWhatsAppUrl = (req: BookingRequest) => {
    let msg = '';
    const cleanMobile = req.mobile_number.replace(/\D/g, '');
    const fullPhone = cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`;

    if (req.status === 'APPROVED') {
      msg = `*पुलिस ऑफिसर्स गेस्ट हाउस (POGH) अयोध्या*\n\n` +
        `सादर प्रणाम श्री ${req.guest_name} जी,\n` +
        `आपके द्वारा POGH अयोध्या में कमरा आरक्षण हेतु दिया गया अनुरोध संख्या *${req.request_number}* स्वीकृत कर लिया गया है।\n\n` +
        `📅 आगमन तिथि: ${formatToDisplayDate(req.check_in_date)} (${req.check_in_time || '12:00 PM'})\n` +
        `📅 प्रस्थान तिथि: ${formatToDisplayDate(req.check_out_date)} (${req.check_out_time || '12:00 PM'})\n` +
        `🏛️ आवंटित कक्ष: ${req.approved_suits && req.approved_suits.length > 0 ? req.approved_suits.join(', ').toUpperCase() : 'Suit Allocated'}\n\n` +
        `कृपया आगमन पर गेस्ट हाउस काउंटर पर संपर्क करें।\n` +
        `_कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या_`;
    } else if (req.status === 'REJECTED') {
      msg = `*पुलिस ऑफिसर्स गेस्ट हाउस (POGH) अयोध्या*\n\n` +
        `सादर प्रणाम श्री ${req.guest_name} जी,\n` +
        `आपके द्वारा POGH अयोध्या में कमरा आरक्षण अनुरोध संख्या *${req.request_number}* की समीक्षा की गई।\n\n` +
        `खेद सहित सूचित करना है कि ${req.rejection_reason || 'कमरे उपलब्ध न होने / प्रशासनिक कारणों'} से आपका अनुरोध इस बार स्वीकार नहीं किया जा सका। असुविधा के लिए खेद है।\n\n` +
        `_कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या_`;
    } else {
      msg = `*पुलिस ऑफिसर्स गेस्ट हाउस (POGH) अयोध्या*\n\n` +
        `सादर प्रणाम श्री ${req.guest_name} जी,\n` +
        `आपका कमरा आरक्षण अनुरोध संख्या *${req.request_number}* प्राप्त हो गया है और वर्तमान में समीक्षाधीन है। निर्णय होते ही आपको सूचित किया जाएगा।\n\n` +
        `_कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या_`;
    }

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-white">
              {language === 'hi' ? 'बुकिंग अनुरोध प्रबंधन' : 'Booking Requests Management'}
            </h2>
            {stats.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
                {stats.pending} नए अनुरोध
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {language === 'hi'
              ? 'अधिकारियों एवं आगंतुकों द्वारा सबमिट किए गए आरक्षण अनुरोधों की समीक्षा व कमरा आवंटन'
              : 'Review guest booking requests and assign rooms'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          <span>{language === 'hi' ? 'रिफ्रेश' : 'Refresh'}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-800 border-amber-400 shadow-md shadow-amber-400/10'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-slate-400 font-semibold block">कुल अनुरोध</span>
          <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('PENDING')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer relative overflow-hidden ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          {stats.pending > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
          <span className="text-[11px] text-amber-300 font-semibold block">प्रतीक्षारत (Pending)</span>
          <span className="text-xl sm:text-2xl font-black text-amber-400 mt-1 block">
            {stats.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-500/15 border-emerald-400 shadow-md shadow-emerald-500/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-emerald-300 font-semibold block">स्वीकृत (Approved)</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 block">
            {stats.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-500/15 border-rose-400 shadow-md shadow-rose-500/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] text-rose-300 font-semibold block">अस्वीकृत (Rejected)</span>
          <span className="text-xl sm:text-2xl font-black text-rose-400 mt-1 block">
            {stats.rejected}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="नाम, मोबाइल, अनुरोध संख्या अथवा विभाग से खोजें..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st === 'ALL'
                ? 'सभी'
                : st === 'PENDING'
                ? 'प्रतीक्षारत'
                : st === 'APPROVED'
                ? 'स्वीकृत'
                : 'अस्वीकृत'}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">कोई आरक्षण अनुरोध नहीं मिला</p>
          <p className="text-xs text-slate-500 mt-1">
            {searchTerm ? 'कृपया खोज शब्द बदलकर पुनः प्रयास करें।' : 'वर्तमान में इस श्रेणी में कोई अनुरोध लंबित नहीं है।'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRequests.map((req) => {
            const isApproved = req.status === 'APPROVED';
            const isRejected = req.status === 'REJECTED';
            const isPending = req.status === 'PENDING';
            const nights = calculateStayNights(req.check_in_date, req.check_out_date);

            return (
              <div
                key={req.id}
                className={`p-4 sm:p-5 rounded-2xl bg-slate-900 border transition shadow-lg ${
                  isPending
                    ? 'border-amber-500/50 shadow-amber-500/5'
                    : isApproved
                    ? 'border-emerald-500/40'
                    : 'border-slate-800 opacity-80'
                }`}
              >
                {/* Header: Request ID, Dates, Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-black text-amber-400 font-mono tracking-wider">
                      {req.request_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                        isApproved
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : isRejected
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>स्वीकृत (APPROVED)</span>
                        </>
                      ) : isRejected ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>अस्वीकृत (REJECTED)</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>प्रतीक्षारत (PENDING)</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>प्राप्त तिथि:</span>
                    <span className="font-semibold text-slate-300">
                      {req.created_at ? new Date(req.created_at).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 border-b border-slate-800 text-xs">
                  {/* Guest Info */}
                  <div>
                    <span className="text-[10.5px] text-slate-400 block font-semibold">अतिथि का विवरण:</span>
                    <div className="font-bold text-white text-sm mt-0.5">{req.guest_name}</div>
                    {req.designation && (
                      <div className="text-amber-300 font-semibold text-[11px]">{req.designation}</div>
                    )}
                    {req.department && (
                      <div className="text-slate-400 text-[11px]">{req.department}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <a
                        href={`tel:${req.mobile_number}`}
                        className="flex items-center gap-1 text-slate-300 hover:text-white font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded-md"
                      >
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>{req.mobile_number}</span>
                      </a>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <span className="text-[10.5px] text-slate-400 block font-semibold">प्रवास अनुसूची:</span>
                    <div className="text-slate-200 mt-0.5">
                      <strong>आगमन:</strong> {formatToDisplayDate(req.check_in_date)} ({req.check_in_time})
                    </div>
                    <div className="text-slate-200 mt-0.5">
                      <strong>प्रस्थान:</strong> {formatToDisplayDate(req.check_out_date)} ({req.check_out_time})
                    </div>
                    <div className="text-amber-300 font-semibold mt-1">
                      अवधि: {req.stay_type === 'HOURLY' ? 'घंटेवार' : `${nights} रात्रि`} • अतिथि: {req.number_of_guests || 1}
                    </div>
                  </div>

                  {/* Reference */}
                  <div>
                    <span className="text-[10.5px] text-slate-400 block font-semibold">अनुमोदन संदर्भ:</span>
                    <div className="text-slate-200 mt-1">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 text-xs">
                        {req.reference || 'SSP SIR'}
                      </span>
                    </div>
                  </div>
                </div>



                {/* Notes or Approval / Rejection details */}
                {req.notes && (
                  <div className="pt-2 text-[11.5px] text-slate-300 italic">
                    <span className="text-slate-500 not-italic font-semibold">टिप्पणी:</span> {req.notes}
                  </div>
                )}

                {isApproved && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-xs flex items-center justify-between flex-wrap gap-2 text-emerald-200">
                    <div>
                      <span>आवंटित कमरे: </span>
                      <strong className="text-white">
                        {req.approved_suits && req.approved_suits.length > 0
                          ? req.approved_suits.map((s) => s.toUpperCase()).join(', ')
                          : 'कमरा आवंटित'}
                      </strong>
                      {req.action_by && (
                        <span className="text-slate-400 ml-2">
                          (स्वीकृतकर्ता: {req.action_by})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {isRejected && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-200">
                    <span>अस्वीकृति कारण: </span>
                    <strong className="text-rose-100">{req.rejection_reason || 'कमरे अनुपलब्ध हैं'}</strong>
                    {req.action_by && (
                      <span className="text-slate-400 ml-2">
                        (कार्रवाई: {req.action_by})
                      </span>
                    )}
                  </div>
                )}

                {/* Footer Action Bar */}
                <div className="mt-3.5 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    {/* WhatsApp Notify */}
                    <a
                      href={getRequestWhatsAppUrl(req)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>व्हाट्सएप संदेश भेजें</span>
                    </a>
                  </div>

                  {/* Actions for Admin and Operator */}
                  {(isAdmin || isOperator) && isPending && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedForReject(req)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>अस्वीकार करें</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedForApprove(req)}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-400/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>स्वीकार करें (Approve)</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Approve Modal */}
      <ApproveRequestModal
        isOpen={!!selectedForApprove}
        onClose={() => setSelectedForApprove(null)}
        request={selectedForApprove}
        existingBookings={existingBookings}
        onApproveSuccess={async (approvedBooking) => {
          await onRefresh();
          setSelectedForApprove(null);
          if (approvedBooking && onOpenLetter) {
            onOpenLetter(approvedBooking);
          }
        }}
      />

      {/* Reject Modal */}
      <RejectRequestModal
        isOpen={!!selectedForReject}
        onClose={() => setSelectedForReject(null)}
        request={selectedForReject}
        onRejectSuccess={async () => {
          await onRefresh();
          setSelectedForReject(null);
        }}
      />
    </div>
  );
};
