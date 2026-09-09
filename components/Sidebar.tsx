'use client';

import React from 'react';
import Image from 'next/image';
import { AuthUser } from '@/lib/auth';
import {
  LayoutDashboard,
  BedDouble,
  BookOpenCheck,
  PlusCircle,
  FileSpreadsheet,
  Settings,
  LogOut,
  Shield,
  User,
  X,
  Phone
} from 'lucide-react';

export type NavTab = 'dashboard' | 'matrix' | 'bookings';

interface SidebarProps {
  currentUser: AuthUser;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenBookingModal: () => void;
  onOpenConfigModal: () => void;
  onExportExcel: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  isOpenMobile,
  onCloseMobile,
  onOpenBookingModal,
  onOpenConfigModal,
  onExportExcel,
  onLogout,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'डैशबोर्ड (Overview)',
      icon: LayoutDashboard,
    },
    {
      id: 'matrix' as NavTab,
      label: 'कमरा उपलब्धता (Rooms)',
      icon: BedDouble,
    },
    {
      id: 'bookings' as NavTab,
      label: 'बुकिंग पंजिका (Directory)',
      icon: BookOpenCheck,
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 border-r-2 border-amber-500/40 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header / Emblem */}
        <div>
          <div className="p-5 border-b border-slate-800 relative bg-gradient-to-b from-slate-800/60 to-transparent">
            {/* Close button on mobile */}
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex-shrink-0 bg-white rounded-full p-1 border-2 border-amber-400 shadow-md flex items-center justify-center overflow-hidden">
                <Image
                  src="/up_police_logo.png"
                  alt="UP Police Crest"
                  width={42}
                  height={42}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white tracking-wide leading-tight">
                  POLICE OFFICERS<br />GUEST HOUSE
                </h2>
                <p className="text-[11px] text-amber-400 font-bold font-hindi mt-0.5">
                  जनपद अयोध्या
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-hindi mt-2.5 pt-2 border-t border-slate-800/80">
              कार्यालय वरिष्ठ पुलिस अधीक्षक, अयोध्या
            </p>
          </div>

          {/* Quick Action: New Booking (Admin Only) */}
          {isAdmin && (
            <div className="px-4 pt-4 pb-2">
              <button
                onClick={() => {
                  onOpenBookingModal();
                  onCloseMobile();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center gap-2 transition active:scale-98"
              >
                <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                <span>नई बुकिंग दर्ज करें</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <p className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              मुख्य मेनू (Navigation)
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Extra Menu Actions */}
            <div className="pt-3">
              <p className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                रिपोर्ट्स व सेटिंग्स
              </p>

              {/* Export Excel */}
              <button
                onClick={() => {
                  onExportExcel();
                  onCloseMobile();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 hover:text-white transition text-left"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>एक्सेल रिपोर्ट डाउनलोड</span>
              </button>

              {/* Database Settings (Admin only) */}
              {isAdmin && (
                <button
                  onClick={() => {
                    onOpenConfigModal();
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/80 hover:text-white transition text-left"
                >
                  <Settings className="w-4 h-4 text-amber-400" />
                  <span>डेटाबेस सेटिंग्स</span>
                </button>
              )}
            </div>
          </nav>
        </div>

        {/* Bottom Section: User Profile Card & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
          
          {/* User Profile Info */}
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                isAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
              }`}
            >
              {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {currentUser.displayName}
              </div>
              <div className="text-[10px] text-amber-300/80 font-medium truncate">
                {isAdmin ? 'प्रशासक (Admin)' : 'ड्यूटी अधिकारी (Officer)'}
              </div>
            </div>
          </div>

          {/* Contact Helpline */}
          <div className="px-2 text-[10px] text-slate-400 flex items-center gap-1.5 font-hindi">
            <Phone className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="truncate">उ0नि0 यदुनाथ: 8317041684</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-950/50 hover:text-rose-200 border border-rose-900/40 transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>लॉगआउट (Logout)</span>
          </button>
        </div>

      </aside>
    </>
  );
};
