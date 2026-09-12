'use client';

import React from 'react';
import { AuthUser } from '@/lib/auth';
import { Menu, Plus, BarChart3 } from 'lucide-react';
import { NavTab } from './Sidebar';
import { formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import { useLanguage } from '@/lib/languageContext';
import { UserMenu } from './UserMenu';

interface TopHeaderProps {
  currentUser: AuthUser;
  activeTab: NavTab;
  onOpenMobileMenu: () => void;
  onOpenBookingModal: () => void;
  onOpenAuditLog?: () => void;
  onOpenMonthlyCollection?: () => void;
  onLogout: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  activeTab,
  onOpenMobileMenu,
  onOpenBookingModal,
  onOpenAuditLog,
  onOpenMonthlyCollection,
  onLogout,
}) => {
  const { language, t } = useLanguage();
  const isAdmin = currentUser.role === 'admin';
  const todayFormatted = language === 'hi' ? formatToHindiDate(new Date()) : formatToDisplayDate(new Date());

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return t('dashboard');
      case 'matrix':
        return t('matrix');
      case 'bookings':
        return t('bookings');
      case 'monthly':
        return language === 'hi' ? 'माह-वार किराया संग्रह आख्या' : 'Monthly Collection';
      default:
        return t('portalTitle');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left: Mobile Menu Toggle & Clean Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition border border-slate-200 shrink-0"
            aria-label="Open Sidebar Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 leading-tight truncate">
              {getTitle()}
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block truncate">
              {t('sspOffice')} • {todayFormatted}
            </p>
          </div>
        </div>

        {/* Right: Actions & User Dropdown Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

          {/* Quick New Booking Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={onOpenBookingModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xs transition active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden xs:inline sm:inline">{t('newBooking')}</span>
            </button>
          )}

          {/* Interactive User Dropdown Menu (Profile + Language Switcher + Logout) */}
          <UserMenu
            currentUser={currentUser}
            onLogout={onLogout}
            onOpenAuditLog={onOpenAuditLog}
            onOpenMonthlyCollection={onOpenMonthlyCollection}
          />

        </div>

      </div>
    </header>
  );
};

