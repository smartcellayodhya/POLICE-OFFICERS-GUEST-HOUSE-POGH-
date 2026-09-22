'use client';

import React, { useState, useEffect } from 'react';
import { AuthUser } from '@/lib/auth';
import { Menu, Plus, Building2, Pencil } from 'lucide-react';
import { NavTab } from './Sidebar';
import { formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import { useLanguage } from '@/lib/languageContext';
import { UserMenu } from './UserMenu';
import {
  BankBalanceRecord,
  getLocalBankBalance,
  BANK_BALANCE_CHANGE_EVENT,
  DEFAULT_BANK_BALANCE,
  fetchServerBankBalance,
} from '@/lib/bankBalance';
import { BankBalanceModal } from './BankBalanceModal';

interface TopHeaderProps {
  currentUser: AuthUser;
  activeTab: NavTab;
  onOpenMobileMenu: () => void;
  onOpenBookingModal: () => void;
  onOpenAuditLog?: () => void;
  onOpenMonthlyCollection?: () => void;
  onLogout: () => void;
}

const TopHeaderComponent: React.FC<TopHeaderProps> = ({
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

  const [bankBalance, setBankBalance] = useState<BankBalanceRecord>(DEFAULT_BANK_BALANCE);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  useEffect(() => {
    setBankBalance(getLocalBankBalance());
    fetchServerBankBalance().catch(() => {});

    const handleBalanceChange = (e: any) => {
      if (e?.detail) {
        setBankBalance(e.detail);
      } else {
        setBankBalance(getLocalBankBalance());
      }
    };

    window.addEventListener(BANK_BALANCE_CHANGE_EVENT, handleBalanceChange);
    return () => window.removeEventListener(BANK_BALANCE_CHANGE_EVENT, handleBalanceChange);
  }, []);

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
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs font-sans">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: Mobile Menu Toggle & Clean Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onOpenMobileMenu}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition border border-slate-200 shrink-0"
              aria-label={language === 'hi' ? 'साइडबार मेन्यू खोलें' : 'Open Sidebar Menu'}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 leading-tight truncate">
                {getTitle()}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate font-medium">
                {todayFormatted}
              </p>
            </div>
          </div>

          {/* Right: Actions & User Dropdown Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

            {/* Guest House Bank Balance Widget */}
            <button
              type="button"
              onClick={() => setIsBankModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/80 text-slate-800 transition shadow-xs group shrink-0"
              title={
                language === 'hi'
                  ? `गेस्ट हाउस बैंक बैलेंस: ₹${bankBalance.current_balance.toLocaleString('en-IN')} (क्लिक करके देखें या बदलें)`
                  : `Guest House Bank Balance: ₹${bankBalance.current_balance.toLocaleString('en-IN')} (Click to update)`
              }
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-600/15 text-emerald-700 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
              </div>
              <div className="text-left">
                <div className="text-[9px] sm:text-[10px] font-bold text-emerald-800 leading-none hidden sm:block">
                  {language === 'hi' ? 'बैंक बैलेंस' : 'Bank Balance'}
                </div>
                <div className="text-xs sm:text-[13px] font-extrabold text-slate-900 leading-tight tabular-nums flex items-center gap-1">
                  <span>₹{bankBalance.current_balance.toLocaleString('en-IN')}</span>
                  <Pencil className="w-2.5 h-2.5 text-emerald-600 opacity-60 group-hover:opacity-100 transition hidden sm:inline" />
                </div>
              </div>
            </button>

            {/* Quick New Booking Button (Admin Only) */}
            {isAdmin && (
              <button
                onClick={onOpenBookingModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-xs transition active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="sm:hidden">{language === 'hi' ? 'बुक' : 'Book'}</span>
                <span className="hidden sm:inline">{t('newBooking')}</span>
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

      {/* Bank Balance Modal */}
      <BankBalanceModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
};

export const TopHeader = React.memo(TopHeaderComponent);


