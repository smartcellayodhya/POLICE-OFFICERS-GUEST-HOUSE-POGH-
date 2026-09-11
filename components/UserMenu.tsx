'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AuthUser } from '@/lib/auth';
import { useLanguage } from '@/lib/languageContext';
import {
  User,
  Shield,
  LogOut,
  ChevronDown,
  Languages,
  Check,
  Building2,
  KeyRound,
  History,
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

interface UserMenuProps {
  currentUser: AuthUser;
  onLogout: () => void;
  onOpenAuditLog?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ currentUser, onLogout, onOpenAuditLog }) => {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser.role === 'admin';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition shadow-2xs group"
        title="यूज़र मेन्यू एवं भाषा विकल्प"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
          isAdmin ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
        }`}>
          {isAdmin ? <Shield className="w-4 h-4 text-amber-700" /> : <User className="w-4 h-4 text-blue-700" />}
        </div>

        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold text-slate-800 leading-tight">
            {currentUser.displayName}
          </p>
          <p className="text-[10px] text-slate-500 font-medium leading-none">
            {isAdmin ? t('admin') : t('officer')}
          </p>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${
          isOpen ? 'rotate-180 text-amber-600' : ''
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans">
          {/* User Info Header */}
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900">
              {currentUser.displayName}
            </p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <span>{isAdmin ? t('admin') : t('officer')}</span>
              <span>•</span>
              <span className="text-amber-700 font-semibold">{t('ayodhyaPolice')}</span>
            </p>
          </div>

          {/* Language Selection Section */}
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('language')} / Language</span>
            </p>

            <div className="grid grid-cols-2 gap-1 bg-slate-100/80 p-1 rounded-xl">
              <button
                onClick={() => {
                  setLanguage('hi');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  language === 'hi'
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>हिंदी</span>
                {language === 'hi' && <Check className="w-3.5 h-3.5 text-amber-600" />}
              </button>

              <button
                onClick={() => {
                  setLanguage('en');
                }}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  language === 'en'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>English</span>
                {language === 'en' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            </div>
          </div>

          {/* Security & System Section */}
          <div className="px-2 py-1.5 border-b border-slate-100 space-y-0.5">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsPasswordModalOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition text-left"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>{language === 'hi' ? 'पासवर्ड बदलें' : 'Change Password'}</span>
            </button>

            {isAdmin && onOpenAuditLog && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenAuditLog();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <History className="w-3.5 h-3.5 text-blue-600" />
                <span>{language === 'hi' ? 'ऑडिट एवं एक्टिविटी लॉग' : 'Audit & Activity Log'}</span>
              </button>
            )}
          </div>

          {/* Logout Action */}
          <div className="px-2 pt-1.5">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
};
