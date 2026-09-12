'use client';

import React, { useState, useEffect } from 'react';
import { changeUserPassword, adminResetUserPassword, AuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/auditLog';
import { X, Lock, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, User } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AuthUser | null;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { language } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';
  
  const [targetUser, setTargetUser] = useState<'admin' | 'officer'>('admin');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetUser(currentUser?.username === 'officer' ? 'officer' : 'admin');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Admin resetting officer password directly without needing old password
  const isAdminResettingOfficer = isAdmin && targetUser === 'officer';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg(language === 'hi' ? 'नया पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते।' : 'New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg(language === 'hi' ? 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' : 'New password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    setTimeout(() => {
      let res: { success: boolean; message: string };

      if (isAdminResettingOfficer) {
        res = adminResetUserPassword('officer', newPassword);
      } else {
        res = changeUserPassword(targetUser, oldPassword, newPassword);
      }

      setSubmitting(false);

      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg(language === 'hi' ? 'पासवर्ड सफलतापूर्वक बदल दिया गया है!' : 'Password updated successfully!');
        logActivity(
          'UPDATE',
          `पासवर्ड बदला गया (${targetUser})`,
          `उपयोगकर्ता: ${targetUser === 'admin' ? 'SSP Office' : 'Duty Officer'}`,
          currentUser?.displayName || 'System'
        );
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    }, 300);
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-400 text-slate-950">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold">
              {language === 'hi' ? 'लॉगिन पासवर्ड बदलें' : 'Change Password'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Account Selector (Shown on Login Screen or when Admin is logged in) */}
          {(!currentUser || isAdmin) && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'hi' ? 'उपयोगकर्ता खाता चुनें' : 'Select Account'}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetUser('admin');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition border text-center ${
                    targetUser === 'admin'
                      ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  प्रशासक (SSP Office)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetUser('officer');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition border text-center ${
                    targetUser === 'officer'
                      ? 'bg-blue-50 border-blue-400 text-blue-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ड्यूटी अधिकारी (Officer)
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current / Old Password (Not required if Admin is resetting Officer) */}
          {!isAdminResettingOfficer && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>{language === 'hi' ? 'वर्तमान पासवर्ड *' : 'Current Password *'}</span>
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'hi' ? 'नया पासवर्ड *' : 'New Password *'}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3.5 pr-10 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {language === 'hi' ? 'नए पासवर्ड की पुष्टि करें *' : 'Confirm New Password *'}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold rounded-xl text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {submitting
                ? (language === 'hi' ? 'सहेज रहे हैं...' : 'Updating...')
                : (language === 'hi' ? 'पासवर्ड सहेजें' : 'Update Password')}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
