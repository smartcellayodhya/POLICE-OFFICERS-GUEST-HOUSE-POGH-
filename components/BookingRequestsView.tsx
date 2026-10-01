'use client';

import React, { useState, useMemo } from 'react';
import { BookingRequest, Booking } from '@/lib/types';
import { formatToDisplayDate, calculateStayNights } from '@/lib/dateUtils';
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
  User,
  Inbox,
  AlertCircle,
  Briefcase,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { extractGroupIdFromNotes } from '@/lib/bookingUtils';
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
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

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
        ` सादर प्रणाम श्री ${req.guest_name} जी,\n` +
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

  // Booking Source Metrics: Online Form vs Direct Admin Bookings
  const sourceStats = useMemo(() => {
    const activeStaysMap = new Map<string, Booking[]>();
    existingBookings
      .filter((b) => b.status !== 'CANCELLED')
      .forEach((b) => {
        const gId = b.group_id || extractGroupIdFromNotes(b.notes) || b.id;
        if (!activeStaysMap.has(gId)) {
          activeStaysMap.set(gId, []);
        }
        activeStaysMap.get(gId)!.push(b);
      });

    let onlineStaysCount = 0;
    let directStaysCount = 0;

    activeStaysMap.forEach((dayBookings) => {
      const isOnline = dayBookings.some((b) =>
        (b.notes || '').includes('Approved from Request:') ||
        (b.notes || '').includes('POGH-REQ-')
      );
      if (isOnline) {
        onlineStaysCount++;
      } else {
        directStaysCount++;
      }
    });

    const approvedRequestsCount = requests.filter((r) => r.status === 'APPROVED').length;
    const finalOnlineCount = Math.max(onlineStaysCount, approvedRequestsCount);

    return {
      totalActiveStays: activeStaysMap.size,
      onlineBookingsCount: finalOnlineCount,
      directAdminBookingsCount: directStaysCount,
    };
  }, [existingBookings, requests]);

  return (
    <div className="space-y-5">
      {/* 1. Header Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {language === 'hi' ? 'बुकिंग अनुरोध प्रबंधन' : 'Booking Requests Management'}
            </h2>
            {stats.pending > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                {stats.pending} {language === 'hi' ? 'प्रतीक्षारत' : 'Pending'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'hi'
              ? 'अधिकारियों एवं आगंतुकों द्वारा सबमिट किए गए आरक्षण अनुरोधों की समीक्षा एवं आवंटन'
              : 'Review online booking requests submitted by officers & guests and allocate suits'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition border border-slate-200 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-slate-900' : 'text-slate-600'}`} />
          <span>{language === 'hi' ? 'रिफ्रेश' : 'Refresh'}</span>
        </button>
      </div>

      {/* 2. Two Cards: Booking Source Breakdown (Online vs Direct Admin) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card A: Online Portal Bookings */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-blue-200/90 shadow-2xs hover:shadow-xs transition relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === 'hi' ? 'ऑनलाइन फॉर्म से बुकिंग' : 'Online Form Bookings'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {language === 'hi' ? 'वेबसाइट / ऑनलाइन पोर्टल द्वारा प्राप्त' : 'Via Public Request Portal'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-bold text-blue-900 tabular-nums">
                {sourceStats.onlineBookingsCount}
              </span>
              <span className="text-xs text-slate-500 block">
                {language === 'hi' ? 'स्वीकृत बुकिंग' : 'Approved'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              {language === 'hi' ? 'कुल ऑनलाइन आवेदन: ' : 'Total Submissions: '}
              <strong className="text-slate-900">{stats.total}</strong>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200">
              {stats.pending} {language === 'hi' ? 'लंबित अनुरोध' : 'Pending'}
            </span>
          </div>
        </div>

        {/* Card B: Direct Admin Bookings */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === 'hi' ? 'प्रत्यक्ष एडमिन बुकिंग' : 'Direct Admin Bookings'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {language === 'hi' ? 'कार्यालय / ऑपरेटर द्वारा सीधे आरक्षित' : 'Created Directly by Admin / Desk'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {sourceStats.directAdminBookingsCount}
              </span>
              <span className="text-xs text-slate-500 block">
                {language === 'hi' ? 'सीधे आरक्षित' : 'Direct Stays'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              {language === 'hi' ? 'कुल सक्रिय पंजिका प्रवास: ' : 'Total Registered Stays: '}
              <strong className="text-slate-900">{sourceStats.totalActiveStays}</strong>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
              {sourceStats.directAdminBookingsCount > 0
                ? Math.round((sourceStats.directAdminBookingsCount / Math.max(1, sourceStats.totalActiveStays)) * 100)
                : 0}% {language === 'hi' ? 'प्रत्यक्ष' : 'Direct'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Stat Cards (Matches StatsCardsComponent design) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Requests */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कुल अनुरोध' : 'Total Requests'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900 tabular-nums">{stats.total}</span>
            <span className="text-xs text-slate-500">{language === 'hi' ? 'अनुरोध' : 'Requests'}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {language === 'hi' ? 'सभी ऑनलाइन आवेदन' : 'All submissions'}
          </p>
        </div>

        {/* Pending Review */}
        <div
          onClick={() => setStatusFilter('PENDING')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'border-amber-300 ring-2 ring-amber-100 shadow-xs'
              : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider truncate">
              {language === 'hi' ? 'प्रतीक्षारत' : 'Pending Review'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-amber-900 tabular-nums">{stats.pending}</span>
            <span className="text-xs font-semibold text-amber-700">
              {language === 'hi' ? 'लंबित' : 'Pending'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {language === 'hi' ? 'कार्रवाई हेतु प्रतीक्षारत' : 'Awaiting review'}
          </p>
        </div>

        {/* Approved */}
        <div
          onClick={() => setStatusFilter('APPROVED')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'border-emerald-300 ring-2 ring-emerald-100 shadow-xs'
              : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider truncate">
              {language === 'hi' ? 'स्वीकृत' : 'Approved'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-900 tabular-nums">{stats.approved}</span>
            <span className="text-xs font-semibold text-emerald-700">
              {language === 'hi' ? 'कमरा आवंटित' : 'Allocated'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {language === 'hi' ? 'स्वीकृत बुकिंग्स' : 'Approved stays'}
          </p>
        </div>

        {/* Rejected */}
        <div
          onClick={() => setStatusFilter('REJECTED')}
          className={`bg-white rounded-2xl p-4 border transition cursor-pointer ${
            statusFilter === 'REJECTED'
              ? 'border-rose-300 ring-2 ring-rose-100 shadow-xs'
              : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider truncate">
              {language === 'hi' ? 'अस्वीकृत' : 'Rejected'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-rose-900 tabular-nums">{stats.rejected}</span>
            <span className="text-xs font-semibold text-rose-700">
              {language === 'hi' ? 'अस्वीकृत' : 'Declined'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {language === 'hi' ? 'निरस्त अनुरोध' : 'Declined requests'}
          </p>
        </div>
      </div>

      {/* 3. Search and Status Filter Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'hi' ? 'अतिथि नाम, मोबाइल, अनुरोध संख्या से खोजें...' : 'Search by name, mobile, reference number...'}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none transition"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {st === 'ALL'
                ? (language === 'hi' ? 'सभी' : 'All')
                : st === 'PENDING'
                ? (language === 'hi' ? 'प्रतीक्षारत' : 'Pending')
                : st === 'APPROVED'
                ? (language === 'hi' ? 'स्वीकृत' : 'Approved')
                : (language === 'hi' ? 'अस्वीकृत' : 'Rejected')}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {language === 'hi' ? 'कोई आरक्षण अनुरोध नहीं मिला' : 'No Booking Requests Found'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {searchTerm
              ? (language === 'hi' ? 'कृपया खोज शब्द बदलकर पुनः प्रयास करें।' : 'Try adjusting your search terms.')
              : (language === 'hi' ? 'वर्तमान में इस श्रेणी में कोई अनुरोध नहीं है।' : 'There are no requests in this category.')}
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
                key={req.id || req.request_number}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition p-4 sm:p-5"
              >
                {/* Header: ID, Status Badge & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {req.request_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : isRejected
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isApproved
                        ? (language === 'hi' ? 'स्वीकृत' : 'Approved')
                        : isRejected
                        ? (language === 'hi' ? 'अस्वीकृत' : 'Rejected')
                        : (language === 'hi' ? 'प्रतीक्षारत (Pending)' : 'Pending Review')}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400">
                    {req.created_at ? new Date(req.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    }) : ''}
                  </span>
                </div>

                {/* Main Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-3.5">
                  {/* Guest Info */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {language === 'hi' ? 'अतिथि विवरण' : 'Guest Details'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{req.guest_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{req.mobile_number}</span>
                    </div>
                    {(req.designation || req.department) && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{[req.designation, req.department].filter(Boolean).join(', ')}</span>
                      </p>
                    )}
                  </div>

                  {/* Arrival Schedule */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {language === 'hi' ? 'आगमन (Check-in)' : 'Arrival'}
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span>{formatToDisplayDate(req.check_in_date)}</span>
                    </p>
                    <p className="text-xs text-slate-500 pl-3.5 mt-0.5">
                      {req.check_in_time || '12:00 PM'}
                    </p>
                  </div>

                  {/* Departure Schedule */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {language === 'hi' ? 'प्रस्थान (Check-out)' : 'Departure'}
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span>{formatToDisplayDate(req.check_out_date)}</span>
                    </p>
                    <p className="text-xs text-slate-500 pl-3.5 mt-0.5">
                      {req.check_out_time || '12:00 PM'} ({nights} {language === 'hi' ? 'रात्रि' : 'night(s)'})
                    </p>
                  </div>

                  {/* Reference */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {language === 'hi' ? 'संदर्भ (Reference)' : 'Reference'}
                    </span>
                    <div className="mt-1">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold border border-slate-200 text-xs">
                        {req.reference || 'SSP SIR'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remarks if any */}
                {req.notes && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 mb-3">
                    <strong className="text-slate-700">{language === 'hi' ? 'टिप्पणी: ' : 'Remarks: '}</strong>
                    <span>{req.notes}</span>
                  </div>
                )}

                {/* Approved Box */}
                {isApproved && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div>
                      <span>{language === 'hi' ? 'आवंटित कमरे: ' : 'Allocated Suits: '}</span>
                      <strong className="text-emerald-950 font-bold">
                        {req.approved_suits && req.approved_suits.length > 0
                          ? req.approved_suits.map((s) => s.toUpperCase()).join(', ')
                          : 'Suit Allocated'}
                      </strong>
                      {req.action_by && (
                        <span className="text-emerald-700 ml-2">
                          ({language === 'hi' ? 'स्वीकृतकर्ता' : 'By'}: {req.action_by})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejected Box */}
                {isRejected && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 mb-3">
                    <span>{language === 'hi' ? 'अस्वीकृति कारण: ' : 'Reason: '}</span>
                    <strong className="text-rose-950 font-bold">{req.rejection_reason || 'कमरे अनुपलब्ध हैं'}</strong>
                    {req.action_by && (
                      <span className="text-rose-700 ml-2">
                        ({language === 'hi' ? 'कार्रवाई' : 'By'}: {req.action_by})
                      </span>
                    )}
                  </div>
                )}

                {/* Bottom Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <a
                    href={getRequestWhatsAppUrl(req)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer w-fit"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{language === 'hi' ? 'व्हाट्सएप सूचना भेजें' : 'Send WhatsApp'}</span>
                  </a>

                  {(isAdmin || isOperator) && isPending && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedForReject(req)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{language === 'hi' ? 'अस्वीकार करें' : 'Reject'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedForApprove(req)}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{language === 'hi' ? 'स्वीकार करें (Approve)' : 'Approve & Assign'}</span>
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
