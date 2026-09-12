'use client';

import React, { useState, useEffect } from 'react';
import { ActivityLog, getActivityLogs, clearActivityLogs } from '@/lib/auditLog';
import { formatToDisplayDate } from '@/lib/dateUtils';
import { X, History, Trash2, Shield, Clock, Search, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filterQuery, setFilterQuery] = useState('');

  const refreshLogs = () => {
    setLogs(getActivityLogs());
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClear = () => {
    if (window.confirm('क्या आप सभी एक्टिविटी लॉग हटाना चाहते हैं?')) {
      clearActivityLogs();
      refreshLogs();
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      log.title.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.user.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  const getActionBadge = (action: ActivityLog['action']) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DELETE':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'STATUS_CHANGE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'MAINTENANCE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'LOGIN':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getActionLabel = (action: ActivityLog['action']) => {
    if (language === 'hi') {
      switch (action) {
        case 'CREATE':
          return 'नई प्रविष्टि';
        case 'UPDATE':
          return 'संशोधन';
        case 'DELETE':
          return 'हटाया गया';
        case 'STATUS_CHANGE':
          return 'स्थिति परिवर्तन';
        case 'MAINTENANCE':
          return 'मरम्मत';
        case 'LOGIN':
          return 'लॉगिन';
        default:
          return action;
      }
    }
    return action;
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-1 sm:my-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <History className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {language === 'hi' ? 'सिस्टम गतिविधि एवं ऑडिट लॉग' : 'System Activity & Audit Trail'}
              </h3>
              <p className="text-xs text-slate-400">
                {logs.length} {language === 'hi' ? 'गतिविधियां दर्ज हैं' : 'recorded events'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshLogs}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={language === 'hi' ? 'रिफ्रेश करें' : 'Refresh'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title={language === 'hi' ? 'सभी लॉग हटाएं' : 'Clear all logs'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={language === 'hi' ? 'बंद करें' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={language === 'hi' ? 'लॉग में खोजें (नाम, पत्रांक, स्थिति)...' : 'Search logs...'}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-amber-500 outline-none bg-white"
            />
          </div>
        </div>

        {/* Log List */}
        <div className="p-4 overflow-y-auto divide-y divide-slate-100 flex-1">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {language === 'hi' ? 'कोई लॉग उपलब्ध नहीं है।' : 'No activity logs found.'}
            </div>
          ) : (
            filteredLogs.map((item) => {
              const dateObj = new Date(item.timestamp);
              const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

              return (
                <div key={item.id} className="py-3 px-2 hover:bg-slate-50 rounded-lg transition flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getActionBadge(item.action)}`}>
                        {getActionLabel(item.action)}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-600">{item.details}</p>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 whitespace-nowrap flex sm:flex-col items-center sm:items-end justify-between">
                    <span className="font-semibold text-slate-600">{item.user}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dateStr} {timeStr}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
