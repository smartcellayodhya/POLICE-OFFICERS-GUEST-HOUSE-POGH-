'use client';

import React from 'react';
import { Booking } from '@/lib/types';
import { formatToISODate } from '@/lib/dateUtils';
import { Building2, Users, IndianRupee, CalendarCheck, BedDouble } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface StatsCardsProps {
  bookings: Booking[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ bookings }) => {
  const { language, t } = useLanguage();
  const todayStr = formatToISODate(new Date());

  // Calculate stats
  const activeBookings = bookings.filter((b) => b.status !== 'CANCELLED');
  const todayBookings = activeBookings.filter((b) => b.booking_date === todayStr);

  const occupiedSuitSet = new Set<string>();
  todayBookings.forEach((b) => {
    if (Number(b.suit_1) > 0) occupiedSuitSet.add('suit_1');
    if (Number(b.suit_2) > 0) occupiedSuitSet.add('suit_2');
    if (Number(b.suit_3) > 0) occupiedSuitSet.add('suit_3');
    if (Number(b.suit_4) > 0) occupiedSuitSet.add('suit_4');
  });
  const todayRoomsOccupied = occupiedSuitSet.size;

  const totalRevenue = activeBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6 font-sans">
      {/* Total Bookings */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{t('totalBookings')}</p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900">{activeBookings.length}</span>
          <span className="text-[11px] sm:text-xs text-slate-500">{language === 'hi' ? 'दिन' : 'Days'}</span>
        </div>
      </div>

      {/* Today's Occupancy */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{language === 'hi' ? 'कमरों की स्थिति' : 'Occupancy'}</p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <BedDouble className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900">{todayRoomsOccupied} / 4</span>
          <span className={`text-[10px] sm:text-xs font-bold ${todayRoomsOccupied > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
            {language === 'hi'
              ? (todayRoomsOccupied === 4 ? 'पूर्ण आरक्षित' : todayRoomsOccupied > 0 ? `${4 - todayRoomsOccupied} खाली` : 'सभी उपलब्ध')
              : (todayRoomsOccupied === 4 ? 'Fully Booked' : todayRoomsOccupied > 0 ? `${4 - todayRoomsOccupied} Available` : 'All Available')
            }
          </span>
        </div>
      </div>

      {/* Guests Today */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{t('activeGuests')}</p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900">{todayBookings.length}</span>
          <span className="text-[11px] sm:text-xs text-slate-500">{language === 'hi' ? 'अतिथि' : 'Guests'}</span>
        </div>
      </div>

      {/* Total Revenue */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{t('totalRevenue')}</p>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
            <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900 truncate">₹{totalRevenue.toLocaleString('en-IN')}</span>
          <span className="text-[11px] sm:text-xs text-slate-500">{language === 'hi' ? 'किराया' : 'Revenue'}</span>
        </div>
      </div>
    </div>
  );
};
