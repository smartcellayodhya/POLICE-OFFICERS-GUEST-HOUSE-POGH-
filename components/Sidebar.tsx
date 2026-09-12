'use client';

import React from 'react';
import { AuthUser } from '@/lib/auth';
import {
  LayoutDashboard,
  BedDouble,
  BookOpenCheck,
  X,
  BarChart3,
} from 'lucide-react';

import { useLanguage } from '@/lib/languageContext';

export type NavTab = 'dashboard' | 'matrix' | 'bookings' | 'monthly';

interface SidebarProps {
  currentUser?: AuthUser;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { language, t } = useLanguage();

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: t('dashboard'),
      icon: LayoutDashboard,
    },
    {
      id: 'matrix' as NavTab,
      label: t('matrix'),
      icon: BedDouble,
    },
    {
      id: 'bookings' as NavTab,
      label: t('bookings'),
      icon: BookOpenCheck,
    },
    {
      id: 'monthly' as NavTab,
      label: language === 'hi' ? 'माह-वार कलेक्शन' : 'Monthly Collection',
      icon: BarChart3,
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 border-r-2 border-amber-500/40 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header / Emblem */}
        <div>
          <div className="p-5 border-b border-slate-800 relative bg-gradient-to-b from-slate-800/60 to-transparent">
            {/* Close button on mobile */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white p-1.5 shadow-md flex-shrink-0 flex items-center justify-center border border-amber-400/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/up_police_logo.png"
                  alt="UP Police Crest"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white tracking-wide leading-tight">
                  POLICE OFFICERS<br />GUEST HOUSE
                </h2>
                <p className="text-[11px] text-amber-400 font-bold mt-0.5">
                  {t('ayodhyaPolice')}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/80">
              {t('sspOffice')}
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
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
          </nav>
        </div>

      </aside>
    </>
  );
};
