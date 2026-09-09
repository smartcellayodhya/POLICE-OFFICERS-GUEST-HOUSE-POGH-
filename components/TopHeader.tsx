'use client';

import React from 'react';
import { AuthUser } from '@/lib/auth';
import { Menu, Plus, Shield, User } from 'lucide-react';
import { NavTab } from './Sidebar';
import { formatToHindiDate } from '@/lib/dateUtils';

interface TopHeaderProps {
  currentUser: AuthUser;
  activeTab: NavTab;
  onOpenMobileMenu: () => void;
  onOpenBookingModal: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  activeTab,
  onOpenMobileMenu,
  onOpenBookingModal,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const todayHindi = formatToHindiDate(new Date());

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'प्रशासनिक डैशबोर्ड (Executive Overview)';
      case 'matrix':
        return 'कमरों की लाइव उपलब्धता स्थिति (Room Occupancy Matrix)';
      case 'bookings':
        return 'बुकिंग पंजिका एवं आवागमन इतिहास (Booking Directory)';
      default:
        return 'पुलिस ऑफिसर्स गेस्ट हाउस, जनपद अयोध्या';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        
        {/* Left: Mobile Menu Toggle & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition border border-slate-200"
            aria-label="Open Sidebar Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              {getTitle()}
            </h1>
            <p className="text-[11px] text-slate-500 font-hindi hidden sm:block">
              कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या • दिनांक: {todayHindi}
            </p>
          </div>
        </div>

        {/* Right: Status and Quick Actions */}
        <div className="flex items-center gap-2.5">
          
          {/* Subtle System Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>पोर्टल सक्रिय (Active)</span>
          </div>

          {/* Role Badge */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
              isAdmin
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            {isAdmin ? <Shield className="w-3.5 h-3.5 text-amber-600" /> : <User className="w-3.5 h-3.5 text-blue-600" />}
            <span>{isAdmin ? 'प्रशासक (Admin)' : 'ड्यूटी अधिकारी (Officer)'}</span>
          </div>

          {/* Quick New Booking Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={onOpenBookingModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm transition active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>नई बुकिंग</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
