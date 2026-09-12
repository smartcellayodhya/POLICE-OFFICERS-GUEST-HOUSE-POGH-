'use client';

import React, { useState, useMemo } from 'react';
import { Booking } from '@/lib/types';
import { formatToISODate, formatMonthKey } from '@/lib/dateUtils';
import { calculateBookingRent, getBookingRoomsCount } from '@/lib/bookingUtils';
import {
  IndianRupee,
  CalendarCheck,
  BedDouble,
  History,
  TrendingUp,
  BarChart3,
  ArrowUpRight
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { MonthlyCollectionModal } from './MonthlyCollectionModal';

interface StatsCardsProps {
  bookings: Booking[];
  onSelectBooking?: (booking: Booking) => void;
  onOpenMonthlyModal?: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  bookings,
  onSelectBooking,
  onOpenMonthlyModal,
}) => {
  const { language, t } = useLanguage();
  const [internalModalOpen, setInternalModalOpen] = useState(false);

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

  // Revenue & Monthly aggregations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let lastMonthRevenue = 0;
    let lastMonthBookingsCount = 0;
    let currentMonthRevenue = 0;
    let currentMonthBookingsCount = 0;

    activeBookings.forEach((b) => {
      const rent = calculateBookingRent(b);
      totalRevenue += rent;

      const mKey = (b.booking_date || '').slice(0, 7);
      if (mKey === lastMonthKey) {
        lastMonthRevenue += rent;
        lastMonthBookingsCount += 1;
      } else if (mKey === currentMonthKey) {
        currentMonthRevenue += rent;
        currentMonthBookingsCount += 1;
      }
    });

    return {
      totalRevenue,
      lastMonthRevenue,
      lastMonthBookingsCount,
      currentMonthRevenue,
      currentMonthBookingsCount,
    };
  }, [activeBookings, lastMonthKey, currentMonthKey]);

  const lastMonthName = formatMonthKey(lastMonthKey, language === 'hi' ? 'hi' : 'en');
  const currentMonthName = formatMonthKey(currentMonthKey, language === 'hi' ? 'hi' : 'en');

  const handleOpenModal = () => {
    if (onOpenMonthlyModal) {
      onOpenMonthlyModal();
    } else {
      setInternalModalOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 mb-6 font-sans">
        
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
          <p className="mt-1 text-[10px] text-slate-400 truncate">कुल दर्ज आवंटन</p>
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
                  ? 'पूर्ण आरक्षित'
                  : todayRoomsOccupied > 0
                  ? `${4 - todayRoomsOccupied} खाली`
                  : 'सभी उपलब्ध'
                : todayRoomsOccupied === 4
                ? 'Fully Booked'
                : todayRoomsOccupied > 0
                ? `${4 - todayRoomsOccupied} Available`
                : 'All Available'}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400 truncate">आज के आरक्षित सूट</p>
        </div>

        {/* Card 3: Last Month Collection (गत माह कलेक्शन - Specifically requested by User) */}
        <div
          onClick={handleOpenModal}
          className="bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 rounded-2xl p-3 sm:p-4 border border-purple-200 shadow-2xs hover:shadow-md hover:border-purple-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold text-purple-900 uppercase tracking-wider truncate">
                {language === 'hi' ? 'गत माह कलेक्शन' : 'Last Month'}
              </p>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-purple-950 truncate">
              ₹{stats.lastMonthRevenue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px]">
            <span className="font-semibold text-purple-700 truncate">{lastMonthName}</span>
            <span className="text-purple-600 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              <span>विवरण</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Current Month Collection (चालू माह संग्रह) */}
        <div
          onClick={handleOpenModal}
          className="bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 rounded-2xl p-3 sm:p-4 border border-amber-200 shadow-2xs hover:shadow-md hover:border-amber-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] font-bold text-amber-900 uppercase tracking-wider truncate">
              {language === 'hi' ? 'चालू माह संग्रह' : 'This Month'}
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1 sm:gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-amber-950 truncate">
              ₹{stats.currentMonthRevenue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px]">
            <span className="font-semibold text-amber-800 truncate">{currentMonthName}</span>
            <span className="text-amber-700 font-medium shrink-0">
              {stats.currentMonthBookingsCount} {language === 'hi' ? 'बुकिंग' : 'bookings'}
            </span>
          </div>
        </div>

        {/* Card 5: Total Revenue & Month-wise Breakdown Button */}
        <div className="col-span-2 sm:col-span-1 md:col-span-2 lg:col-span-1 bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                {t('totalRevenue')}
              </p>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                ₹{stats.totalRevenue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Month-Wise Breakdown Action Trigger */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleOpenModal}
              className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-[11px] font-bold transition active:scale-95"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'माह-वार कलेक्शन' : 'Month Breakdown'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Internal Month-Wise Breakdown Modal */}
      <MonthlyCollectionModal
        isOpen={internalModalOpen}
        onClose={() => setInternalModalOpen(false)}
        bookings={bookings}
        onSelectBooking={(b) => {
          setInternalModalOpen(false);
          if (onSelectBooking) onSelectBooking(b);
        }}
      />
    </>
  );
};
