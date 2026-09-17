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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 mb-6 font-sans">
      
      {/* Card 1: Total Bookings */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            {t('totalBookings')}
          </p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900">{activeBookings.length}</span>
          <span className="text-[11px] sm:text-xs text-slate-500">{language === 'hi' ? 'बुकिंग' : 'Bookings'}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 truncate">
          <span>{language === 'hi' ? 'सक्रिय आरक्षण' : 'Active records'}</span>
        </div>
      </div>

      {/* Card 2: Today's Occupancy */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            {language === 'hi' ? 'कमरों की स्थिति' : 'Occupancy'}
          </p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900">{todayRoomsOccupied} / 4</span>
          <span className={`text-[10px] sm:text-xs font-bold ${todayRoomsOccupied > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
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
        <div className="mt-1 text-[10px] sm:text-[11px] text-slate-500 truncate">
          <span>{language === 'hi' ? 'आज का आवंटन' : "Today's status"}</span>
        </div>
      </div>

      {/* Card 3: Total Expenditure (कुल व्यय / खर्च) */}
      <div
        onClick={onOpenMonthlyCollection}
        className={`bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 rounded-2xl p-3 sm:p-4 border border-rose-200 shadow-2xs hover:shadow-xs transition ${
          onOpenMonthlyCollection ? 'cursor-pointer hover:border-rose-300' : ''
        }`}
        title={language === 'hi' ? 'मासिक व्यय विवरण देखने हेतु क्लिक करें' : 'Click to view monthly expenditure details'}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-rose-900 uppercase tracking-wider truncate">
            {language === 'hi' ? 'कुल व्यय (खर्च)' : 'Total Expenditure'}
          </p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1 sm:gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-rose-950 truncate">
            ₹{stats.totalExpenditure.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded">
            {language === 'hi' ? 'कुल खर्च' : 'Expense'}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px]">
          <span className="font-semibold text-rose-700 truncate">
            {language === 'hi' ? 'चालू माह खर्च:' : 'This month exp:'} ₹{stats.currentMonthExpenditure.toLocaleString('en-IN')}
          </span>
          <ArrowDownRight className="w-3 h-3 text-rose-500 shrink-0" />
        </div>
      </div>

      {/* Card 4: Last Month Collection (गत माह कलेक्शन) */}
      <div
        onClick={onOpenMonthlyCollection}
        className={`bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 rounded-2xl p-3 sm:p-4 border border-purple-200 shadow-2xs hover:shadow-xs transition ${
          onOpenMonthlyCollection ? 'cursor-pointer hover:border-purple-300' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-purple-900 uppercase tracking-wider truncate">
            {language === 'hi' ? 'गत माह कलेक्शन (संग्रह)' : 'Last Month Collection'}
          </p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1 sm:gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-purple-950 truncate">
            ₹{stats.lastMonthRevenue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.5 rounded">
            {language === 'hi' ? 'कलेक्शन' : 'Collection'}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px]">
          <span className="font-semibold text-purple-700 truncate">{lastMonthName}</span>
          <span className="text-purple-600 font-medium shrink-0">
            {stats.lastMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
          </span>
        </div>
      </div>

      {/* Card 5: Current Month Collection (चालू माह संग्रह) */}
      <div
        onClick={onOpenMonthlyCollection}
        className={`bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 rounded-2xl p-3 sm:p-4 border border-amber-200 shadow-2xs hover:shadow-xs transition ${
          onOpenMonthlyCollection ? 'cursor-pointer hover:border-amber-300' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-amber-900 uppercase tracking-wider truncate">
            {language === 'hi' ? 'चालू माह कलेक्शन (संग्रह)' : 'This Month Collection'}
          </p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1 sm:gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-amber-950 truncate">
            ₹{stats.currentMonthRevenue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded">
            {language === 'hi' ? 'कलेक्शन' : 'Collection'}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px]">
          <span className="font-semibold text-amber-800 truncate">{currentMonthName}</span>
          <span className="text-amber-700 font-medium shrink-0">
            {stats.currentMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bks'}
          </span>
        </div>
      </div>

      {/* Card 6: Total Net Revenue (कुल शुद्ध संग्रह) */}
      <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
            {language === 'hi' ? 'कुल शुद्ध संग्रह (राजस्व)' : 'Total Net Collection'}
          </p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-xl sm:text-2xl font-black text-slate-900 truncate">
            ₹{stats.netRevenue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
            {language === 'hi' ? 'शुद्ध' : 'Net'}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 truncate">
          <span>{language === 'hi' ? 'सकल:' : 'Gross:'} ₹{stats.grossRevenue.toLocaleString('en-IN')}</span>
          {stats.totalExpenditure > 0 && (
            <span className="text-rose-600 font-medium truncate ml-1">
              -{stats.totalExpenditure.toLocaleString('en-IN')} {language === 'hi' ? 'खर्च' : 'exp'}
            </span>
          )}
        </div>
      </div>

    </div>
  );
};

export const StatsCards = React.memo(StatsCardsComponent);

