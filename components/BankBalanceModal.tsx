'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, Calendar, FileText, CheckCircle2, History, Pencil, ShieldCheck } from 'lucide-react';
import {
  BankBalanceRecord,
  BankBalanceHistoryItem,
  getLocalBankBalance,
  saveLocalBankBalance,
  getLocalBankBalanceHistory,
  fetchServerBankBalance,
} from '@/lib/bankBalance';
import { formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import { useLanguage } from '@/lib/languageContext';
import { getAuthToken } from '@/lib/auth';

interface BankBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { displayName?: string; name?: string; username?: string; role?: string };
}

export const BankBalanceModal: React.FC<BankBalanceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { language } = useLanguage();
  const isHindi = language === 'hi';

  const [activeTab, setActiveTab] = useState<'update' | 'history'>('update');
  const [balanceRecord, setBalanceRecord] = useState<BankBalanceRecord>(getLocalBankBalance());
  const [historyList, setHistoryList] = useState<BankBalanceHistoryItem[]>([]);

  // Form State
  const [amountInput, setAmountInput] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const rec = getLocalBankBalance();
      setBalanceRecord(rec);
      setAmountInput(String(rec.current_balance || 0));
      setAccountName(rec.account_name || '');
      setAccountNumber(rec.account_number || '');
      setAsOfDate(rec.as_of_date || new Date().toISOString().slice(0, 10));
      setNotes(rec.notes || 'पासबुक प्रविष्टि के अनुसार');
      setHistoryList(getLocalBankBalanceHistory());
      setSaveSuccess(false);
      setActiveTab('update');

      // Fetch remote bank balance from Supabase database via API
      fetchServerBankBalance().then((serverRec) => {
        if (serverRec) {
          setBalanceRecord(serverRec);
          setAmountInput(String(serverRec.current_balance || 0));
          setAccountName(serverRec.account_name || '');
          setAccountNumber(serverRec.account_number || '');
          setAsOfDate(serverRec.as_of_date || new Date().toISOString().slice(0, 10));
          setNotes(serverRec.notes || 'पासबुक प्रविष्टि के अनुसार');
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amountInput) || 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const updated: BankBalanceRecord = {
        ...balanceRecord,
        account_name: accountName.trim() || 'SBI - पुलिस ऑफिसर्स गेस्ट हाउस संचालन खाता',
        account_number: accountNumber.trim() || 'XXXX4589',
        current_balance: parsedAmount,
        as_of_date: asOfDate || new Date().toISOString().slice(0, 10),
        notes: notes.trim() || (isHindi ? 'पासबुक प्रविष्टि के अनुसार' : 'As per passbook entry'),
        updated_by: currentUser?.displayName || currentUser?.name || currentUser?.username || 'SSP Office',
      };

      // Save locally & broadcast event
      saveLocalBankBalance(updated);
      setBalanceRecord(updated);
      setHistoryList(getLocalBankBalanceHistory());

      // Attempt remote sync in background
      try {
        const token = getAuthToken();
        fetch('/api/bank-balance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(updated),
        }).catch(() => {});
      } catch {}

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {isHindi ? 'गेस्ट हाउस बैंक खाता बैलेंस' : 'Guest House Bank Balance'}
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                {isHindi ? 'पासबुक / नेट बैंकिंग अवशेष प्रबंधन' : 'Passbook / Bank Account Ledger'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance Hero Card */}
        <div className="bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50/50 p-4 sm:p-5 border-b border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {isHindi ? 'वर्तमान उपलब्ध बैंक बैलेंस' : 'Current Available Bank Balance'}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {balanceRecord.as_of_date ? (isHindi ? formatToHindiDate(balanceRecord.as_of_date) : formatToDisplayDate(balanceRecord.as_of_date)) : ''}
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums mt-1">
            ₹{balanceRecord.current_balance.toLocaleString('en-IN')}
          </div>

          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-emerald-100">
            <span className="font-medium text-slate-700 truncate max-w-[260px]">
              {balanceRecord.account_name}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              A/c: {balanceRecord.account_number}
            </span>
          </div>
        </div>

        {/* Tabs: Update vs History */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('update')}
            className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'update'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            {isHindi ? 'बैलेंस अपडेट करें' : 'Update Balance'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            {isHindi ? 'इतिहास (Log)' : 'History Log'}
            {historyList.length > 0 && (
              <span className="text-[10px] bg-slate-200 text-slate-700 rounded-full px-1.5 py-0.2">
                {historyList.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {activeTab === 'update' ? (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isHindi ? 'पासबुक / नेटबैंकिंग अनुसार वर्तमान बैलेंस (₹) *' : 'Current Balance as per Passbook (₹) *'}
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold">
                    ₹
                  </div>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="उदा. 145200"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl text-base font-bold text-slate-900 transition tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isHindi ? 'शब्दों में अनुमानित: ' : 'Formatted: '}
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    ₹{parsedAmount.toLocaleString('en-IN')}
                  </span>
                </p>
              </div>

              {/* Account Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isHindi ? 'बैंक एवं खाता विवरण' : 'Bank & Account Title'}
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="SBI - पुलिस ऑफिसर्स गेस्ट हाउस खाता"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 rounded-xl text-xs text-slate-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isHindi ? 'खाता संख्या (वैकल्पिक / अंतिम 4 अंक)' : 'Account Number (Optional / Last 4)'}
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="XXXX4589"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 rounded-xl text-xs text-slate-900 font-mono transition"
                  />
                </div>
              </div>

              {/* As Of Date & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {isHindi ? 'सत्यापन दिनांक (As of Date)' : 'Verification Date'}
                  </label>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 rounded-xl text-xs text-slate-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    {isHindi ? 'टिप्पणी / संदर्भ' : 'Remarks / Reference'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="पासबुक प्रविष्टि के अनुसार"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 rounded-xl text-xs text-slate-900 transition"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  {isHindi ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-95 ${
                    saveSuccess
                      ? 'bg-emerald-600'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {isHindi ? 'सफलतापूर्वक अपडेट हुआ!' : 'Updated!'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {isHindi ? 'बैलेंस सेव करें' : 'Save Balance'}
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* History Tab */
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-3">
                {isHindi
                  ? 'बैंक बैलेंस में किए गए पूर्व संशोधनों का रिकॉर्ड:'
                  : 'Previous bank balance modification log:'}
              </p>

              {historyList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {isHindi ? 'कोई पूर्व इतिहास उपलब्ध नहीं है।' : 'No history log available.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {historyList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900 tabular-nums text-sm">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>
                            {isHindi ? 'दिनांक: ' : 'Date: '}
                            {item.as_of_date ? (isHindi ? formatToHindiDate(item.as_of_date) : formatToDisplayDate(item.as_of_date)) : '-'}
                          </span>
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                          {item.updated_by}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
