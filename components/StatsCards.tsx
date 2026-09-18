'use client';

import React, { useMemo } from 'react';
import { Booking } from '@/lib/types';
import { formatToISODate, formatMonthKey } from '@/lib/dateUtils';
import {
  calculateBookingRent,
  calculateBookingFoodAmount,
  calculateBookingExpenditure,
  extractGroupIdFromNotes,
} from '@/lib/bookingUtils';
import {
  IndianRupee,
  CalendarCheck,
  BedDouble,
  History,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
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

  // Today's Occupancy
  const todayRoomsOccupied = useMemo(() => {
    const todayBookings = activeBookings.filter((b) => b.booking_date === todayStr);
    const occupiedSuitSet = new Set<string>();
    todayBookings.forEach((b) => {
      if (Number(b.suit_1) > 0) occupiedSuitSet.add('suit_1');
      if (Number(b.suit_2) > 0) occupiedSuitSet.add('suit_2');
      if (Number(b.suit_3) > 0) occupiedSuitSet.add('suit_3');
      if (Number(b.suit_4) > 0) occupiedSuitSet.add('suit_4');
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

    let currentMonthRent = 0;
    let currentMonthFood = 0;
    let currentMonthExpenditure = 0;
    let currentMonthBookingsCount = 0;

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

      const mKey = (b.booking_date || '').slice(0, 7);
      if (mKey === currentMonthKey) {
        currentMonthRent += rent;
        currentMonthFood += food;
        currentMonthExpenditure += exp;
        currentMonthBookingsCount += 1;
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
      grossRevenue,
      netRevenue,
      currentMonthRent,
      currentMonthFood,
      currentMonthExpenditure,
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
          <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1.5 bg-slate-50/90 rounded-xl p-2 border border-slate-100/80">
            {/* Current Month */}
            <div className="text-center">
              <span className="text-[9px] font-bold text-amber-900 uppercase tracking-tight block">
                {language === 'hi' ? 'चालू माह' : 'This Month'}
              </span>
              <span className="text-xs font-black text-amber-950 block mt-0.5">
                ₹{stats.currentMonthRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block">
                {stats.currentMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
              </span>
            </div>

            {/* Last Month */}
            <div className="text-center border-x border-slate-200/60 px-1">
              <span className="text-[9px] font-bold text-purple-900 uppercase tracking-tight block">
                {language === 'hi' ? 'गत माह' : 'Last Month'}
              </span>
              <span className="text-xs font-black text-purple-950 block mt-0.5">
                ₹{stats.lastMonthRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block">
                {stats.lastMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
              </span>
            </div>

            {/* Total Expenditure */}
            <div className="text-center">
              <span className="text-[9px] font-bold text-rose-900 uppercase tracking-tight block">
                {language === 'hi' ? 'कुल व्यय' : 'Expenditure'}
              </span>
              <span className="text-xs font-black text-rose-950 block mt-0.5">
                ₹{stats.totalExpenditure.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block">
                {language === 'hi' ? 'खर्च' : 'expense'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DESKTOP & TABLET VIEW: Full 6 Executive Cards (hidden md:grid)
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6">
        
        {/* Card 1: Total Bookings */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {t('totalBookings')}
            </p>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{activeBookings.length}</span>
            <span className="text-xs text-slate-500">{language === 'hi' ? 'बुकिंग' : 'Bookings'}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            <span>{language === 'hi' ? 'सक्रिय आरक्षण' : 'Active records'}</span>
          </div>
        </div>

        {/* Card 2: Today's Occupancy */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कमरा स्थिति' : 'Occupancy'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{todayRoomsOccupied} / 4</span>
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

        {/* Card 3: Total Expenditure */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 rounded-2xl p-3 sm:p-4 border border-rose-200 shadow-2xs hover:shadow-xs transition ${
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
            <span className="text-xl xl:text-2xl font-black text-rose-950">
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

        {/* Card 4: Last Month Collection */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 rounded-2xl p-3 sm:p-4 border border-purple-200 shadow-2xs hover:shadow-xs transition ${
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
            <span className="text-xl xl:text-2xl font-black text-purple-950">
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

        {/* Card 5: Current Month Collection */}
        <div
          onClick={onOpenMonthlyCollection}
          className={`bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 rounded-2xl p-3 sm:p-4 border border-amber-200 shadow-2xs hover:shadow-xs transition ${
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
            <span className="text-xl xl:text-2xl font-black text-amber-950">
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

        {/* Card 6: Total Net Revenue */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {language === 'hi' ? 'कुल शुद्ध संग्रह' : 'Total Net Collection'}
            </p>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl xl:text-2xl font-black text-slate-900">
              ₹{stats.netRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
              {language === 'hi' ? 'शुद्ध' : 'Net'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 truncate">
            <span>{language === 'hi' ? 'सकल:' : 'Gross:'} ₹{stats.grossRevenue.toLocaleString('en-IN')}</span>
            {stats.totalExpenditure > 0 && (
              <span className="text-rose-600 font-medium truncate ml-1">
                -{stats.totalExpenditure.toLocaleString('en-IN')} {language === 'hi' ? 'खर्च' : 'exp'}
              </span>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export const StatsCards = React.memo(StatsCardsComponent);
