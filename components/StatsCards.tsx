'use client';

import React, { useMemo } from 'react';
import { Booking } from '@/lib/types';
import { formatToISODate, formatMonthKey } from '@/lib/dateUtils';
import {
  calculateBookingRent,
  calculateBookingFoodAmount,
  calculateBookingExpenditure,
  extractGroupIdFromNotes,
  getBookingPaymentSplit,
  isBookingOccupyingDate,
  isSuitAllocatedInBooking,
} from '@/lib/bookingUtils';
import {
  IndianRupee,
  CalendarCheck,
  BedDouble,
  History,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface StatsCardsProps {
  bookings: Booking[];
  onOpenMonthlyCollection?: () => void;
}

const StatsCardsComponent: React.FC<StatsCardsProps> = ({ bookings, onOpenMonthlyCollection }) => {
  const { language, t } = useLanguage();

  const todayStr = formatToISODate(new Date());

  // Determine current and last month keys dynamically
  const { currentMonthKey, lastMonthKey } = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;
    const currentKey = `${currYear}-${String(currMonth).padStart(2, '0')}`;

    const lastMonthDate = new Date(currYear, currMonth - 2, 1);
    const lastKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    return { currentMonthKey: currentKey, lastMonthKey: lastKey };
  }, []);

  // Filter active bookings
  const activeBookings = useMemo(() => {
    return bookings.filter((b) => b.status !== 'CANCELLED');
  }, [bookings]);

  // Today's Occupancy (accurately accounts for single-day and multi-day spans)
  const todayRoomsOccupied = useMemo(() => {
    const todayBookings = activeBookings.filter((b) => isBookingOccupyingDate(b, todayStr));
    const occupiedSuitSet = new Set<string>();
    todayBookings.forEach((b) => {
      if (isSuitAllocatedInBooking(b, 'suit_1') || Number(b.suit_1) > 0) occupiedSuitSet.add('suit_1');
      if (isSuitAllocatedInBooking(b, 'suit_2') || Number(b.suit_2) > 0) occupiedSuitSet.add('suit_2');
      if (isSuitAllocatedInBooking(b, 'suit_3') || Number(b.suit_3) > 0) occupiedSuitSet.add('suit_3');
      if (isSuitAllocatedInBooking(b, 'suit_4') || Number(b.suit_4) > 0) occupiedSuitSet.add('suit_4');
    });
    return occupiedSuitSet.size;
  }, [activeBookings, todayStr]);

  // Map of groupId -> primary bookingId to prevent multi-day double-counting of food/expenditure
  const primaryGroupMap = useMemo(() => {
    const map: Record<string, string> = {};
    const sorted = [...activeBookings].sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || ''));
    for (const b of sorted) {
      const ref = b.group_id || extractGroupIdFromNotes(b.notes);
      if (ref && !map[ref]) {
        map[ref] = b.id;
      }
    }
    return map;
  }, [activeBookings]);

  // Revenue, Food, Expenditure & Monthly aggregations
  const stats = useMemo(() => {
    let totalRent = 0;
    let totalFood = 0;
    let totalExpenditure = 0;
    let totalBankRent = 0;
    let totalCashRent = 0;
    let totalBankRevenue = 0;
    let totalCashRevenue = 0;

    let currentMonthRent = 0;
    let currentMonthFood = 0;
    let currentMonthExpenditure = 0;
    let currentMonthBookingsCount = 0;
    let currentMonthBankRent = 0;
    let currentMonthCashRent = 0;
    let currentMonthBankRevenue = 0;
    let currentMonthCashRevenue = 0;

    let lastMonthRent = 0;
    let lastMonthFood = 0;
    let lastMonthExpenditure = 0;
    let lastMonthBookingsCount = 0;

    activeBookings.forEach((b) => {
      const ref = b.group_id || extractGroupIdFromNotes(b.notes);
      const isPrimary = !ref || primaryGroupMap[ref] === b.id;

      const rent = calculateBookingRent(b);
      const food = isPrimary ? calculateBookingFoodAmount(b) : 0;
      const exp = isPrimary ? calculateBookingExpenditure(b) : 0;

      totalRent += rent;
      totalFood += food;
      totalExpenditure += exp;

      const paySplit = getBookingPaymentSplit(b, isPrimary);
      totalBankRent += paySplit.bankRent;
      totalCashRent += paySplit.cashRent;
      totalBankRevenue += paySplit.bankAmount;
      totalCashRevenue += paySplit.cashAmount;

      const mKey = (b.booking_date || '').slice(0, 7);
      if (mKey === currentMonthKey) {
        currentMonthRent += rent;
        currentMonthFood += food;
        currentMonthExpenditure += exp;
        currentMonthBookingsCount += 1;
        currentMonthBankRent += paySplit.bankRent;
        currentMonthCashRent += paySplit.cashRent;
        currentMonthBankRevenue += paySplit.bankAmount;
        currentMonthCashRevenue += paySplit.cashAmount;
      } else if (mKey === lastMonthKey) {
        lastMonthRent += rent;
        lastMonthFood += food;
        lastMonthExpenditure += exp;
        lastMonthBookingsCount += 1;
      }
    });

    const grossRevenue = totalRent + totalFood;
    const netRevenue = Math.max(0, grossRevenue - totalExpenditure);

    const currentMonthGross = currentMonthRent + currentMonthFood;
    const currentMonthNet = Math.max(0, currentMonthGross - currentMonthExpenditure);

    const lastMonthGross = lastMonthRent + lastMonthFood;
    const lastMonthNet = Math.max(0, lastMonthGross - lastMonthExpenditure);

    return {
      totalRent,
      totalFood,
      totalExpenditure,
      totalBankRent,
      totalCashRent,
      totalBankRevenue,
      totalCashRevenue,
      grossRevenue,
      netRevenue,
      currentMonthRent,
      currentMonthFood,
      currentMonthExpenditure,
      currentMonthBankRent,
      currentMonthCashRent,
      currentMonthBankRevenue,
      currentMonthCashRevenue,
      currentMonthRevenue: currentMonthNet,
      currentMonthBookingsCount,
      lastMonthRent,
      lastMonthFood,
      lastMonthExpenditure,
      lastMonthRevenue: lastMonthNet,
      lastMonthBookingsCount,
    };
  }, [activeBookings, lastMonthKey, currentMonthKey, primaryGroupMap]);

  const lastMonthName = formatMonthKey(lastMonthKey, language === 'hi' ? 'hi' : 'en');
  const currentMonthName = formatMonthKey(currentMonthKey, language === 'hi' ? 'hi' : 'en');

  return (
    <div className="font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          1. MOBILE VIEW: Clean, Decluttered, No Truncation (md:hidden)
          Takes only ~170px height instead of ~550px!
         ───────────────────────────────────────────────────────────── */}
      <div className="block md:hidden space-y-2.5 mb-5">
        
        {/* Row 1: Live Occupancy & Active Bookings (2 Clean Cards) */}
        <div className="grid grid-cols-2 gap-2.5">
          
          {/* Card 1: Today's Occupancy */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {language === 'hi' ? 'कमरा स्थिति' : 'Occupancy'}
              </span>
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <BedDouble className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">{todayRoomsOccupied} / 4</span>
              <span className={`text-[10px] font-bold ${todayRoomsOccupied > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                {language === 'hi'
                  ? todayRoomsOccupied === 4
                    ? 'पूर्ण'
                    : todayRoomsOccupied > 0
                    ? `${4 - todayRoomsOccupied} रिक्त`
                    : 'सभी खाली'
                  : todayRoomsOccupied === 4
                  ? 'Full'
                  : todayRoomsOccupied > 0
                  ? `${4 - todayRoomsOccupied} Free`
                  : 'All Free'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {language === 'hi' ? 'आज का आवंटन' : "Today's status"}
            </p>
          </div>

          {/* Card 2: Active Bookings */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {language === 'hi' ? 'कुल बुकिंग्स' : 'Total Bookings'}
              </span>
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">{activeBookings.length}</span>
              <span className="text-[10px] font-semibold text-slate-500">
                {language === 'hi' ? 'बुकिंग्स' : 'Bookings'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {language === 'hi' ? 'सक्रिय आरक्षण' : 'Active records'}
            </p>
          </div>
        </div>

        {/* Row 2: Unified Executive Financial Card (Crystal Clean) */}
        <div 
          onClick={onOpenMonthlyCollection}
          className={`bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs ${
            onOpenMonthlyCollection ? 'cursor-pointer active:scale-[0.99] transition hover:border-indigo-300' : ''
          }`}
          title={language === 'hi' ? 'मासिक वित्तीय विवरण देखने के लिए क्लिक करें' : 'Click to view monthly financial details'}
        >
          {/* Main Top Header: Net Revenue + Action Button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {language === 'hi' ? 'कुल शुद्ध संग्रह (राजस्व)' : 'Total Net Collection'}
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-slate-950">
                  ₹{stats.netRevenue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full">
                  {language === 'hi' ? 'शुद्ध' : 'Net'}
                </span>
              </div>
            </div>

            {onOpenMonthlyCollection && (
              <div className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-indigo-200/80 shrink-0 shadow-2xs">
                <span>{language === 'hi' ? 'मासिक विवरण' : 'Monthly'}</span>
                <ArrowDownRight className="w-3 h-3 rotate-[-135deg]" />
              </div>
            )}
          </div>

          {/* 3 Clean Compact Metrics (No Truncation) */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1 bg-slate-50/90 rounded-xl p-2 border border-slate-100/80">
            {/* Current Month */}
            <div className="text-center min-w-0">
              <span className="text-[9px] font-bold text-amber-900 uppercase tracking-tight block truncate">
                {language === 'hi' ? 'चालू माह' : 'This Month'}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-amber-950 block mt-0.5 tabular-nums truncate">
                ₹{stats.currentMonthRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block truncate">
                {stats.currentMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
              </span>
            </div>

            {/* Last Month */}
            <div className="text-center border-x border-slate-200/60 px-0.5 min-w-0">
              <span className="text-[9px] font-bold text-purple-900 uppercase tracking-tight block truncate">
                {language === 'hi' ? 'गत माह' : 'Last Month'}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-purple-950 block mt-0.5 tabular-nums truncate">
                ₹{stats.lastMonthRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block truncate">
                {stats.lastMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
              </span>
            </div>

            {/* Total Expenditure */}
            <div className="text-center min-w-0">
              <span className="text-[9px] font-bold text-rose-900 uppercase tracking-tight block truncate">
                {language === 'hi' ? 'कुल व्यय' : 'Expenditure'}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-rose-950 block mt-0.5 tabular-nums truncate">
                ₹{stats.totalExpenditure.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block truncate">
                {language === 'hi' ? 'खर्च' : 'expense'}
              </span>
            </div>
          </div>
          {/* Mobile Bank vs Cash quick bar */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl py-1.5 px-2">
              <span className="text-[9px] font-bold text-blue-800 uppercase block tracking-wider">
                {language === 'hi' ? 'बैंक / ऑनलाइन' : 'Bank / Online'}
              </span>
              <span className="text-sm font-bold text-blue-950 tabular-nums block mt-0.5">
                ₹{stats.totalBankRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-blue-600 block">
                {language === 'hi' ? 'कमरा:' : 'Rent:'} ₹{stats.totalBankRent.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl py-1.5 px-2">
              <span className="text-[9px] font-bold text-emerald-800 uppercase block tracking-wider">
                {language === 'hi' ? 'नकद (Cash)' : 'Cash'}
              </span>
              <span className="text-sm font-bold text-emerald-950 tabular-nums block mt-0.5">
                ₹{stats.totalCashRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-emerald-600 block">
                {language === 'hi' ? 'कमरा:' : 'Rent:'} ₹{stats.totalCashRent.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DESKTOP & TABLET VIEW: Full 8 Executive Cards (hidden md:grid)
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        
        {/* Card 1: Total Bookings */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {t('totalBookings')}
            </p>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">{activeBookings.length}</span>
            <span className="text-xs text-slate-500">{language === 'hi' ? 'बुकिंग' : 'Bookings'}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            <span>{language === 'hi' ? 'सक्रिय आरक्षण' : 'Active records'}</span>
          </div>
        </div>

        {/* Card 2: Today's Occupancy */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कमरा स्थिति' : 'Occupancy'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">{todayRoomsOccupied} / 4</span>
            <span className={`text-xs font-bold ${todayRoomsOccupied > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {language === 'hi'
                ? todayRoomsOccupied === 4
                  ? 'पूर्ण'
                  : todayRoomsOccupied > 0
                  ? `${4 - todayRoomsOccupied} रिक्त`
                  : 'सभी खाली'
                : todayRoomsOccupied === 4
                ? 'Full'
                : todayRoomsOccupied > 0
                ? `${4 - todayRoomsOccupied} Free`
                : 'All Free'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            <span>{language === 'hi' ? 'आज का आवंटन' : "Today's status"}</span>
          </div>
        </div>

        {/* Card 3: Current Month Collection */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 rounded-2xl p-3.5 sm:p-4 border border-amber-200 shadow-2xs hover:shadow-xs transition ${
            onOpenMonthlyCollection ? 'cursor-pointer hover:border-amber-300' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider truncate">
              {language === 'hi' ? 'चालू माह संग्रह' : 'This Month'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-amber-950 tracking-tight tabular-nums">
              ₹{stats.currentMonthRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded">
              {language === 'hi' ? 'कलेक्शन' : 'Collection'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-amber-800 truncate">{currentMonthName}</span>
            <span className="text-amber-700 font-medium shrink-0">
              {stats.currentMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
            </span>
          </div>
        </div>

        {/* Card 4: Total Net Revenue */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कुल शुद्ध संग्रह' : 'Total Net Collection'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight tabular-nums">
              ₹{stats.netRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
              {language === 'hi' ? 'शुद्ध' : 'Net'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
            <span>{language === 'hi' ? 'सकल:' : 'Gross:'} ₹{stats.grossRevenue.toLocaleString('en-IN')}</span>
            {stats.totalExpenditure > 0 && (
              <span className="text-rose-600 font-medium ml-auto">
                -{stats.totalExpenditure.toLocaleString('en-IN')} {language === 'hi' ? 'खर्च' : 'exp'}
              </span>
            )}
          </div>
        </div>

        {/* Card 5: Bank / Online Collection */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 rounded-2xl p-3.5 sm:p-4 border border-blue-200 shadow-2xs hover:shadow-xs transition ${
            onOpenMonthlyCollection ? 'cursor-pointer hover:border-blue-300' : ''
          }`}
          title={language === 'hi' ? 'बैंक / ऑनलाइन संग्रह' : 'Bank / Online Collection'}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider truncate">
              {language === 'hi' ? 'बैंक / ऑनलाइन संग्रह' : 'Bank / Online'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-blue-950 tracking-tight tabular-nums">
              ₹{stats.totalBankRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded">
              UPI/Bank
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <span className="font-semibold text-blue-700">
              {language === 'hi' ? 'कमरा किराया:' : 'Room:'} ₹{stats.totalBankRent.toLocaleString('en-IN')}
            </span>
            <span className="text-blue-600 font-medium">
              {language === 'hi' ? 'चालू माह:' : 'This mo:'} ₹{stats.currentMonthBankRevenue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 6: Cash Collection */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 rounded-2xl p-3.5 sm:p-4 border border-emerald-200 shadow-2xs hover:shadow-xs transition ${
            onOpenMonthlyCollection ? 'cursor-pointer hover:border-emerald-300' : ''
          }`}
          title={language === 'hi' ? 'नकद संग्रह' : 'Cash Collection'}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider truncate">
              {language === 'hi' ? 'नकद संग्रह (Cash)' : 'Cash Collection'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-emerald-950 tracking-tight tabular-nums">
              ₹{stats.totalCashRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
              {language === 'hi' ? 'नकद' : 'Cash'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <span className="font-semibold text-emerald-700">
              {language === 'hi' ? 'कमरा किराया:' : 'Room:'} ₹{stats.totalCashRent.toLocaleString('en-IN')}
            </span>
            <span className="text-emerald-600 font-medium">
              {language === 'hi' ? 'चालू माह:' : 'This mo:'} ₹{stats.currentMonthCashRevenue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 7: Total Expenditure */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 rounded-2xl p-3.5 sm:p-4 border border-rose-200 shadow-2xs hover:shadow-xs transition ${
            onOpenMonthlyCollection ? 'cursor-pointer hover:border-rose-300' : ''
          }`}
          title={language === 'hi' ? 'मासिक व्यय विवरण देखने हेतु क्लिक करें' : 'Click to view monthly expenditure details'}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-rose-900 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कुल व्यय (खर्च)' : 'Total Expenditure'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-rose-950 tracking-tight tabular-nums">
              ₹{stats.totalExpenditure.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded">
              {language === 'hi' ? 'खर्च' : 'Expense'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-rose-700 truncate">
              {language === 'hi' ? 'चालू माह:' : 'This month:'} ₹{stats.currentMonthExpenditure.toLocaleString('en-IN')}
            </span>
            <ArrowDownRight className="w-3 h-3 text-rose-500 shrink-0" />
          </div>
        </div>

        {/* Card 8: Last Month Collection */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 rounded-2xl p-3.5 sm:p-4 border border-purple-200 shadow-2xs hover:shadow-xs transition ${
            onOpenMonthlyCollection ? 'cursor-pointer hover:border-purple-300' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-purple-900 uppercase tracking-wider truncate">
              {language === 'hi' ? 'गत माह संग्रह' : 'Last Month'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold text-purple-950 tracking-tight tabular-nums">
              ₹{stats.lastMonthRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.5 rounded">
              {language === 'hi' ? 'कलेक्शन' : 'Collection'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-purple-700 truncate">{lastMonthName}</span>
            <span className="text-purple-600 font-medium shrink-0">
              {stats.lastMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};

export const StatsCards = React.memo(StatsCardsComponent);
