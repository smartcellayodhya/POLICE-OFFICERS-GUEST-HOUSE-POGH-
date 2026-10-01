'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  User,
  Phone,
  Send,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Copy,
  Loader2,
  Clock,
  Languages,
} from 'lucide-react';
import { REFERENCES } from '@/lib/constants';
import { formatToISODate, formatToDisplayDate } from '@/lib/dateUtils';
import { apiSubmitBookingRequest, apiTrackBookingRequest } from '@/lib/requestUtils';
import { BookingRequest } from '@/lib/types';

export default function RequestBookingPage() {
  const today = formatToISODate(new Date());
  const tomorrow = formatToISODate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  // Language state: English by default ('en'), switchable to Hindi ('hi')
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  const [activeTab, setActiveTab] = useState<'request' | 'track'>('request');

  // Form State - Ultra minimal & clean
  const [guestName, setGuestName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [reference, setReference] = useState('SSP SIR');
  const [customRef, setCustomRef] = useState('');
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutDate, setCheckOutDate] = useState(tomorrow);
  const [checkOutTime, setCheckOutTime] = useState('12:00 PM');
  const [notes, setNotes] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState<BookingRequest | null>(null);
  const [copied, setCopied] = useState(false);

  // Tracking State
  const [trackQuery, setTrackQuery] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackResults, setTrackResults] = useState<BookingRequest[] | null>(null);
  const [trackError, setTrackError] = useState('');

  const isEn = lang === 'en';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!guestName.trim()) {
      setErrorMsg(isEn ? 'Please enter guest name.' : 'कृपया अतिथि का नाम दर्ज करें।');
      return;
    }

    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      setErrorMsg(isEn ? 'Please enter a valid 10-digit mobile number.' : 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।');
      return;
    }

    if (checkOutDate < checkInDate) {
      setErrorMsg(isEn ? 'Check-out date cannot be earlier than check-in date.' : 'प्रस्थान तिथि आगमन तिथि से पहले नहीं हो सकती।');
      return;
    }

    if (!reference.trim() || (reference === 'OTHER' && !customRef.trim())) {
      setErrorMsg(isEn ? 'Please select or enter a valid reference.' : 'कृपया संदर्भ (Reference) अवश्य चुनें अथवा दर्ज करें।');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<BookingRequest> = {
        guest_name: guestName.trim(),
        designation: designation.trim() || undefined,
        department: department.trim() || undefined,
        mobile_number: cleanMobile.slice(-10),
        reference: reference === 'OTHER' ? customRef.trim() || 'OTHER' : reference,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        check_in_time: checkInTime.trim() || '12:00 PM',
        check_out_time: checkOutTime.trim() || '12:00 PM',
        stay_type: 'STANDARD',
        notes: notes.trim() || undefined,
      };

      const res = await apiSubmitBookingRequest(payload);
      if (res.success && res.request) {
        setSubmittedRequest(res.request);
      } else {
        setErrorMsg(res.error || (isEn ? 'Failed to submit request. Please try again.' : 'अनुरोध सबमिट करने में विफल। कृपया पुनः प्रयास करें।'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isEn ? 'Network error. Could not submit request.' : 'नेटवर्क समस्या के कारण सबमिट नहीं हो सका।'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackQuery.trim()) return;

    setTrackingLoading(true);
    setTrackError('');
    setTrackResults(null);

    try {
      const res = await apiTrackBookingRequest(trackQuery.trim());
      if (res.success && res.requests) {
        setTrackResults(res.requests);
        if (res.requests.length === 0) {
          setTrackError(isEn ? 'No booking request found with the entered details.' : 'कोई अनुरोध नहीं मिला। कृपया संदर्भ संख्या अथवा मोबाइल नंबर पुनः जांचें।');
        }
      } else {
        setTrackError(res.error || (isEn ? 'Failed to fetch tracking details.' : 'ट्रैकिंग जानकारी प्राप्त करने में विफल।'));
      }
    } catch (err: any) {
      setTrackError(isEn ? 'Server communication error.' : 'सर्वर से संपर्क करने में समस्या हुई।');
    } finally {
      setTrackingLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 font-sans">
      
      {/* Modern Top Header with Language Switcher */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-1 shadow-md border border-amber-400/40 flex-shrink-0 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/up_police_logo.png" alt="UP Police" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-wide leading-tight">
                {isEn ? 'Police Officers Guest House (POGH)' : 'पुलिस ऑफिसर्स गेस्ट हाउस (POGH)'}
              </h1>
              <p className="text-[11px] text-amber-400 font-medium">
                {isEn ? 'Ayodhya Police • Booking Request Portal' : 'अयोध्या पुलिस • आरक्षण अनुरोध पोर्टल'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-amber-300 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={isEn ? 'Switch to Hindi (हिंदी में देखें)' : 'Switch to English'}
            >
              <Languages className="w-3.5 h-3.5 text-amber-400" />
              <span>{isEn ? 'हिंदी' : 'English'}</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isEn ? 'Login' : 'लॉगिन'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto w-full px-4 py-6 sm:py-8 flex-1">
        
        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {isEn ? 'Guest Booking Request' : 'कमरा आरक्षण अनुरोध'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isEn
              ? 'Submit your stay details. Room allocation will be processed upon approval.'
              : 'विवरण भरें, अनुमोदन के पश्चात आपका कमरा आरक्षित कर दिया जाएगा।'}
          </p>
        </div>

        {/* Clean Pill Tab Switcher */}
        <div className="p-1 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-center max-w-sm mx-auto mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'request'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isEn ? 'New Request' : 'नया अनुरोध'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('track')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'track'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isEn ? 'Track Status' : 'स्थिति जांचें'}</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: MINIMAL CLEAN REQUEST FORM                       */}
        {/* ======================================================== */}
        {activeTab === 'request' && (
          <div>
            {submittedRequest ? (
              /* Success Confirmation Card */
              <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/90 border border-emerald-500/40 shadow-2xl text-center backdrop-blur-md animate-in zoom-in-95">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {isEn ? 'Request Submitted Successfully!' : 'अनुरोध सफलतापूर्वक दर्ज हो गया!'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {isEn
                    ? 'Your booking request has been sent for review by SSP Office / Guest House Operator.'
                    : 'आपका आवेदन समीक्षा हेतु वरिष्ठ पुलिस अधीक्षक कार्यालय / ऑपरेटर के पास पहुंच गया है।'}
                </p>

                {/* Tracking ID Box */}
                <div className="my-5 p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30">
                  <span className="text-[10.5px] text-slate-400 font-semibold block uppercase tracking-wider">
                    {isEn ? 'Booking Request Reference ID' : 'आपकी संदर्भ संख्या (Request ID)'}
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-xl font-black text-amber-400 font-mono tracking-widest">
                      {submittedRequest.request_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(submittedRequest.request_number)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title={isEn ? 'Copy ID' : 'कॉपी करें'}
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {copied && (
                    <span className="text-[11px] text-emerald-400 block mt-1">
                      {isEn ? 'Copied to clipboard!' : 'आईडी कॉपी हो गई!'}
                    </span>
                  )}
                </div>

                {/* Quick Details */}
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-left text-xs space-y-2 mb-5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isEn ? 'Guest Name:' : 'अतिथि:'}</span>
                    <span className="font-bold text-white">{submittedRequest.guest_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isEn ? 'Mobile No.:' : 'मोबाइल:'}</span>
                    <span className="font-mono text-white">{submittedRequest.mobile_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isEn ? 'Dates:' : 'तारीख:'}</span>
                    <span className="font-medium text-white">
                      {formatToDisplayDate(submittedRequest.check_in_date)} ({submittedRequest.check_in_time}) → {formatToDisplayDate(submittedRequest.check_out_date)} ({submittedRequest.check_out_time})
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <span className="text-slate-400">{isEn ? 'Status:' : 'स्थिति:'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                      {isEn ? 'Pending Review' : 'प्रतीक्षारत (Pending)'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedRequest(null);
                      setGuestName('');
                      setMobileNumber('');
                      setDesignation('');
                      setDepartment('');
                      setCheckInTime('12:00 PM');
                      setCheckOutTime('12:00 PM');
                      setNotes('');
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  >
                    {isEn ? 'Submit Another Request' : 'नया अनुरोध भरें'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrackQuery(submittedRequest.request_number);
                      setActiveTab('track');
                      setTimeout(() => handleTrackSearch(), 100);
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition"
                  >
                    {isEn ? 'Track Status' : 'स्थिति ट्रैक करें'}
                  </button>
                </div>
              </div>
            ) : (
              /* Ultra-Clean Modern Form */
              <form onSubmit={handleSubmit} className="p-5 sm:p-7 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* 1. Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isEn ? 'Guest Name' : 'अतिथि का नाम'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={isEn ? 'e.g. Rahul Yadav' : 'उदा. राहुल यादव'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-amber-400 focus:outline-none transition"
                  />
                </div>

                {/* 2. Mobile */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isEn ? 'Mobile Number' : 'मोबाइल नंबर'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder={isEn ? '10-digit active mobile number' : '10 अंकों का सक्रिय मोबाइल नंबर'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-amber-400 focus:outline-none transition font-mono"
                  />
                </div>

                {/* 3. Designation & Department (Split) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        {isEn ? 'Designation' : 'पदनाम (Designation)'}
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">{isEn ? '(Optional)' : '(वैकल्पिक)'}</span>
                    </div>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder={isEn ? 'e.g. Dy. SP / Inspector' : 'उदा. पुलिस उपाधीक्षक / निरीक्षक'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-amber-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300">
                        {isEn ? 'Department / Unit' : 'विभाग / इकाई (Department)'}
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">{isEn ? '(Optional)' : '(वैकल्पिक)'}</span>
                    </div>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder={isEn ? 'e.g. UP Police, Varanasi' : 'उदा. यूपी पुलिस, वाराणसी'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-amber-400 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* 4. Arrival Date & Time */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isEn ? 'Check-In Date' : 'आगमन तिथि'} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isEn ? 'Check-In Time' : 'आगमन समय (Time)'}
                    </label>
                    <input
                      type="text"
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      placeholder="12:00 PM"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none transition font-medium"
                    />
                  </div>
                </div>

                {/* 5. Departure Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isEn ? 'Check-Out Date' : 'प्रस्थान तिथि'} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={checkInDate}
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isEn ? 'Check-Out Time' : 'प्रस्थान समय (Time)'}
                    </label>
                    <input
                      type="text"
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      placeholder="12:00 PM"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none transition font-medium"
                    />
                  </div>
                </div>

                {/* 6. Reference (Mandatory) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isEn ? 'Reference' : 'संदर्भ (Reference)'} <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none transition"
                  >
                    {REFERENCES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {reference === 'OTHER' && (
                    <input
                      type="text"
                      required
                      value={customRef}
                      onChange={(e) => setCustomRef(e.target.value)}
                      placeholder={isEn ? 'Enter officer or reference name *' : 'अधिकारी अथवा संदर्भ का नाम दर्ज करें *'}
                      className="mt-2 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-400 focus:outline-none"
                    />
                  )}
                </div>

                {/* 7. Remarks (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      {isEn ? 'Special Remarks' : 'विशेष टिप्पणी'}
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">{isEn ? '(Optional)' : '(वैकल्पिक)'}</span>
                  </div>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isEn ? 'Any special requirement or notes...' : 'कोई विशेष आवश्यकता अथवा विवरण...'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none transition"
                  />
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-400/20 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>{isEn ? 'Submitting request...' : 'सबमिट हो रहा है...'}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>{isEn ? 'Submit Booking Request' : 'अनुरोध सबमिट करें'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: TRACK STATUS                                     */}
        {/* ======================================================== */}
        {activeTab === 'track' && (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isEn ? 'Enter Request ID or Mobile Number:' : 'अनुरोध संदर्भ संख्या अथवा मोबाइल नंबर:'}
              </label>

              <form onSubmit={handleTrackSearch} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  placeholder={isEn ? 'Request ID or 10-digit Mobile No.' : 'Request ID या 10 अंकों का मोबाइल नंबर'}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={trackingLoading || !trackQuery.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {trackingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>{isEn ? 'Search' : 'खोजें'}</span>
                </button>
              </form>

              {trackError && (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{trackError}</span>
                </div>
              )}
            </div>

            {/* Results */}
            {trackResults && trackResults.length > 0 && (
              <div className="space-y-3">
                {trackResults.map((req) => {
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';

                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-2xl bg-slate-900 border transition shadow-lg ${
                        isApproved
                          ? 'border-emerald-500/50'
                          : isRejected
                          ? 'border-rose-500/50'
                          : 'border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                        <span className="font-mono font-black text-amber-400 text-sm">
                          {req.request_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1 ${
                            isApproved
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : isRejected
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {isApproved
                            ? (isEn ? 'APPROVED' : 'स्वीकृत (APPROVED)')
                            : isRejected
                            ? (isEn ? 'REJECTED' : 'अस्वीकृत (REJECTED)')
                            : (isEn ? 'PENDING' : 'प्रतीक्षारत (PENDING)')}
                        </span>
                      </div>

                      <div className="py-2.5 text-xs space-y-1 text-slate-300">
                        <div>
                          {isEn ? 'Guest:' : 'अतिथि:'} <strong className="text-white">{req.guest_name}</strong>
                          {req.designation && <span className="text-amber-300"> • {req.designation}</span>}
                          {req.department && <span className="text-slate-400"> ({req.department})</span>}
                        </div>
                        <div>
                          {isEn ? 'Dates:' : 'तारीख:'} <strong>{formatToDisplayDate(req.check_in_date)}</strong> → <strong>{formatToDisplayDate(req.check_out_date)}</strong>
                        </div>
                        <div>
                          {isEn ? 'Reference:' : 'संदर्भ:'} <span className="text-amber-300 font-semibold">{req.reference || '-'}</span>
                        </div>
                      </div>

                      {/* Status note */}
                      {isApproved && (
                        <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-[11.5px] text-emerald-200">
                          {isEn ? (
                            <>
                              🎉 <strong>Congratulations!</strong> Your booking request has been approved.
                              {req.approved_suits && req.approved_suits.length > 0 && (
                                <span className="block mt-0.5">
                                  Allocated Room(s): <strong>{req.approved_suits.join(', ').toUpperCase()}</strong>
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              🎉 <strong>बधाई!</strong> आपका कमरा आरक्षण स्वीकार कर लिया गया है।
                              {req.approved_suits && req.approved_suits.length > 0 && (
                                <span className="block mt-0.5">
                                  आवंटित कक्ष: <strong>{req.approved_suits.join(', ').toUpperCase()}</strong>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {isRejected && (
                        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-[11.5px] text-rose-200">
                          {isEn
                            ? 'Request was declined due to room occupancy or administrative constraints.'
                            : 'कमरे उपलब्ध न होने अथवा प्रशासनिक कारणों से अनुरोध अस्वीकृत किया गया है।'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-3.5 text-center text-xs text-slate-600">
        <p>&copy; {new Date().getFullYear()} {isEn ? 'Ayodhya Police • Police Officers Guest House' : 'अयोध्या पुलिस • पुलिस ऑफिसर्स गेस्ट हाउस'}</p>
      </footer>
    </div>
  );
}
