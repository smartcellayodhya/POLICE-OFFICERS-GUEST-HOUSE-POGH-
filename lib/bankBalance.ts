'use client';

export interface BankBalanceRecord {
  id?: string;
  account_name: string;
  account_number: string;
  current_balance: number;
  as_of_date: string;
  notes?: string;
  updated_by: string;
  updated_at: string;
}

export interface BankBalanceHistoryItem {
  id: string;
  amount: number;
  as_of_date: string;
  notes?: string;
  updated_by: string;
  timestamp: string;
}

const STORAGE_KEY_RECORD = 'pogh_bank_balance_record';
const STORAGE_KEY_HISTORY = 'pogh_bank_balance_history';
export const BANK_BALANCE_CHANGE_EVENT = 'pogh_bank_balance_changed';

export const DEFAULT_BANK_BALANCE: BankBalanceRecord = {
  account_name: 'भारतीय स्टेट बैंक (SBI) - पुलिस ऑफिसर्स गेस्ट हाउस संचालन खाता',
  account_number: 'XXXX4589',
  current_balance: 145000,
  as_of_date: new Date().toISOString().slice(0, 10),
  notes: 'पासबुक प्रविष्टि के अनुसार',
  updated_by: 'SSP Office Administrator',
  updated_at: new Date().toISOString(),
};

export function getLocalBankBalance(): BankBalanceRecord {
  if (typeof window === 'undefined') return DEFAULT_BANK_BALANCE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORD);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_RECORD, JSON.stringify(DEFAULT_BANK_BALANCE));
      return DEFAULT_BANK_BALANCE;
    }
    const parsed = JSON.parse(raw);
    return {
      account_name: parsed.account_name || DEFAULT_BANK_BALANCE.account_name,
      account_number: parsed.account_number || DEFAULT_BANK_BALANCE.account_number,
      current_balance: typeof parsed.current_balance === 'number' ? parsed.current_balance : DEFAULT_BANK_BALANCE.current_balance,
      as_of_date: parsed.as_of_date || DEFAULT_BANK_BALANCE.as_of_date,
      notes: parsed.notes || DEFAULT_BANK_BALANCE.notes,
      updated_by: parsed.updated_by || DEFAULT_BANK_BALANCE.updated_by,
      updated_at: parsed.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to read local bank balance:', err);
    return DEFAULT_BANK_BALANCE;
  }
}

export function saveLocalBankBalance(record: BankBalanceRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const updated = {
      ...record,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_RECORD, JSON.stringify(updated));

    // Also append to audit history
    const history = getLocalBankBalanceHistory();
    const historyItem: BankBalanceHistoryItem = {
      id: 'bb_hist_' + Date.now(),
      amount: record.current_balance,
      as_of_date: record.as_of_date,
      notes: record.notes,
      updated_by: record.updated_by || 'Admin',
      timestamp: new Date().toISOString(),
    };
    const newHistory = [historyItem, ...history.slice(0, 19)]; // Keep latest 20
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));

    // Dispatch custom event for real-time reactive sync across components
    window.dispatchEvent(new CustomEvent(BANK_BALANCE_CHANGE_EVENT, { detail: updated }));
  } catch (err) {
    console.error('Failed to save local bank balance:', err);
  }
}

export function getLocalBankBalanceHistory(): BankBalanceHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read bank balance history:', err);
    return [];
  }
}

export async function fetchServerBankBalance(): Promise<BankBalanceRecord | null> {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('pogh_auth_token');
    const res = await fetch('/api/bank-balance', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    if (res.ok && data.success && data.data) {
      const serverRec: BankBalanceRecord = {
        account_name: data.data.account_name || DEFAULT_BANK_BALANCE.account_name,
        account_number: data.data.account_number || DEFAULT_BANK_BALANCE.account_number,
        current_balance: Number(data.data.current_balance) || 0,
        as_of_date: data.data.as_of_date || new Date().toISOString().slice(0, 10),
        notes: data.data.notes || DEFAULT_BANK_BALANCE.notes,
        updated_by: data.data.updated_by || 'Admin',
        updated_at: data.data.updated_at || new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY_RECORD, JSON.stringify(serverRec));
      window.dispatchEvent(new CustomEvent(BANK_BALANCE_CHANGE_EVENT, { detail: serverRec }));
      return serverRec;
    }
  } catch (err) {
    console.warn('Could not fetch remote bank balance, using local cache:', err);
  }
  return null;
}

