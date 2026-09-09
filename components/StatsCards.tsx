'use client';

import React from 'react';
import { Booking } from '@/lib/types';
import { formatToISODate } from '@/lib/dateUtils';
import { Building2, Users, IndianRupee, CalendarCheck, BedDouble } from 'lucide-react';

interface StatsCardsProps {
  bookings: Booking[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ bookings }) => {
  const todayStr = formatToISODate(new Date());

  // Calculate stats
  const activeBookings = bookings.filter((b) => b.status !== 'CANCELLED');

  const todayBookings = activeBookings.filter((b) => b.booking_date === todayStr);

  let todayRoomsOccupied = 0;
  todayBookings.forEach((b) => {
    if (b.suit_1 > 0) todayRoomsOccupied++;
    if (b.suit_2 > 0) todayRoomsOccupied++;
    if (b.suit_3 > 0) todayRoomsOccupied++;
    if (b.suit_4 > 0) todayRoomsOccupied++;
  });

  const totalRevenue = activeBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {/* Total Bookings */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">कुल बुकिंग दिवस</p>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900">{activeBookings.length}</span>
          <span className="text-xs text-slate-500 font-hindi">दिवस आरक्षित</span>
        </div>
      </div>

      {/* Today's Occupancy */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">आज की उपलब्धता</p>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <BedDouble className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900">{todayRoomsOccupied} / 4</span>
          <span className={`text-xs font-bold ${todayRoomsOccupied > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
            {todayRoomsOccupied === 4 ? 'पूर्ण आरक्षित' : todayRoomsOccupied > 0 ? `${4 - todayRoomsOccupied} कमरे खाली` : 'सभी कमरे उपलब्ध'}
          </span>
        </div>
      </div>

      {/* Guests Today */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">आज उपस्थित अतिथि</p>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900">{todayBookings.length}</span>
          <span className="text-xs text-slate-500 font-hindi">अधिकारी / अतिथि</span>
        </div>
      </div>

      {/* Total Revenue */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:shadow-sm transition">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">कुल निर्धारित किराया</p>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900">₹{totalRevenue.toLocaleString('en-IN')}</span>
          <span className="text-xs text-slate-500 font-hindi">राजस्व</span>
        </div>
      </div>
    </div>
  );
};
