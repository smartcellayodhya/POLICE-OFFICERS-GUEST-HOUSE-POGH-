'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  getLocalBookings,
  saveLocalBookings,
} from '@/lib/supabase';
import {
  extractGroupIdFromNotes,
  extractDispatchNoFromNotes,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  cleanNotesText,
  encodeNotesWithMeta,
  parseBookingMeta,
  extractStayHoursFromNotes,
  extractHourlyRateFromNotes,
} from '@/lib/bookingUtils';
import { AuthUser, getLoggedInUser, logoutUser } from '@/lib/auth';
import { formatToISODate } from '@/lib/dateUtils';
import {
  apiFetchBookings,
  apiCreateBookings,
  apiUpdateBooking,
  apiDeleteBooking,
} from '@/lib/apiClient';

import { LoginPage } from '@/components/LoginPage';
import { Sidebar, NavTab } from '@/components/Sidebar';
import { TopHeader } from '@/components/TopHeader';
import { StatsCards } from '@/components/StatsCards';
import { RoomMatrix } from '@/components/RoomMatrix';
import { TodayActivityWidget } from '@/components/TodayActivityWidget';
import { RoomStatus7Days } from '@/components/RoomStatus7Days';
import { DateWiseRoomSchedule } from '@/components/DateWiseRoomSchedule';
import { BookingsTable } from '@/components/BookingsTable';
import { BookingModal } from '@/components/BookingModal';
import { EditBookingModal } from '@/components/EditBookingModal';
import { RecordCollectionModal } from '@/components/RecordCollectionModal';
import { HindiLetterModal } from '@/components/HindiLetterModal';
import { ReceiptModal } from '@/components/ReceiptModal';
import { AuditLogModal } from '@/components/AuditLogModal';
import { MonthlyCollectionPage } from '@/components/MonthlyCollectionPage';
import { SplashScreen } from '@/components/SplashScreen';
import { LanguageProvider, useLanguage } from '@/lib/languageContext';
import { logActivity } from '@/lib/auditLog';

function HomePageContent() {
  const { language } = useLanguage();
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [logoutReason, setLogoutReason] = useState<'manual' | 'inactivity' | null>(null);

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [matrixViewMode, setMatrixViewMode] = useState<'7days' | 'schedule'>('7days');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Date Selection State (Default: Today)
  const [selectedDate, setSelectedDate] = useState<string>(() => formatToISODate(new Date()));

  // Data State - Stale-while-revalidate for instant 0ms initial render
  const [bookings, setBookings] = useState<Booking[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = getLocalBookings();
        if (cached && cached.length > 0) return cached;
      } catch {
        // ignore
      }
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = getLocalBookings();
        return !cached || cached.length === 0;
      } catch {
        return true;
      }
    }
    return true;
  });

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [initialBookingDate, setInitialBookingDate] = useState<string | undefined>();
  const [initialBookingSuit, setInitialBookingSuit] = useState<string | undefined>();

  const [selectedLetterBooking, setSelectedLetterBooking] = useState<Booking | null>(null);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);

  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const [selectedEditBooking, setSelectedEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [selectedCollectionBooking, setSelectedCollectionBooking] = useState<Booking | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);

  // Check login and sync URL route on mount
  useEffect(() => {
    const user = getLoggedInUser();
    if (user) {
      setCurrentUser(user);
      setShowSplash(false);
    } else {
      setShowSplash(true);
    }
    setAuthChecked(true);

    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');

      if (path === 'monthly' || path === 'monthly-collection' || tabParam === 'monthly') {
        setActiveTab('monthly');
      } else if (path === 'matrix' || tabParam === 'matrix') {
        setActiveTab('matrix');
      } else if (path === 'bookings' || tabParam === 'bookings') {
        setActiveTab('bookings');
      } else if (path === 'dashboard' || tabParam === 'dashboard') {
        setActiveTab('dashboard');
      }
    }
  }, []);

  // 15-Minute Inactivity Auto-Logout with Sleep/Wake-up & Cross-Tab Sync
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

  useEffect(() => {
    if (!currentUser) return;

    const checkAndEnforceInactivity = () => {
      const last = parseInt(localStorage.getItem('pogh_last_activity') || '0', 10);
      const now = Date.now();
      if (last > 0 && now - last > INACTIVITY_TIMEOUT_MS) {
        setLogoutReason('inactivity');
        logoutUser();
        try {
          localStorage.removeItem('pogh_bookings_cache');
        } catch {}
        setBookings([]);
        setCurrentUser(null);
        return true;
      }
      return false;
    };

    const updateActivity = () => {
      const now = Date.now();
      try {
        localStorage.setItem('pogh_last_activity', now.toString());
      } catch {}
    };

    updateActivity();

    let lastRecorded = Date.now();
    const handleUserActivity = () => {
      // Check for timeout FIRST before recording new activity (prevents waking up after 1 hour and bypassing auto-logout)
      if (checkAndEnforceInactivity()) return;

      const now = Date.now();
      if (now - lastRecorded > 3000) {
        lastRecorded = now;
        updateActivity();
      }
    };

    // Listen for tab visibility changes (e.g. laptop wake-from-sleep or switching tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndEnforceInactivity();
      }
    };

    const handleWindowFocus = () => {
      checkAndEnforceInactivity();
    };

    // Instant cross-tab logout synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pogh_session_v2' && !e.newValue) {
        setCurrentUser(null);
        setLogoutReason(null);
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('storage', handleStorageChange);

    const intervalId = setInterval(checkAndEnforceInactivity, 10000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [currentUser]);

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = tab === 'dashboard' ? '/' : `/${tab}`;
      window.history.pushState({}, '', url);
    }
  };

  const handleLogout = () => {
    setLogoutReason('manual');
    logoutUser();
    try {
      localStorage.removeItem('pogh_bookings_cache');
    } catch {}
    setBookings([]);
    setCurrentUser(null);
    setShowSplash(false);
  };

  // Load Bookings
  const fetchBookings = useCallback(async () => {
    const configured = isSupabaseConfigured();

    const hydrateBooking = (b: any): Booking => {
      const meta = parseBookingMeta(b.notes);
      const isHr = b.booking_type === 'HOURLY' || meta.bookingType === 'HOURLY' || (meta.stayHours !== undefined && meta.stayHours > 0);
      return {
        ...b,
        group_id: b.group_id || meta.groupId || extractGroupIdFromNotes(b.notes),
        dispatch_no: b.dispatch_no || meta.dispatchNo || extractDispatchNoFromNotes(b.notes),
        booking_type: isHr ? 'HOURLY' : (b.booking_type || 'STANDARD'),
        stay_hours: b.stay_hours || meta.stayHours || extractStayHoursFromNotes(b.notes) || undefined,
        hourly_rate: b.hourly_rate || meta.hourlyRate || extractHourlyRateFromNotes(b.notes) || undefined,
        food_amount: b.food_amount !== undefined && Number(b.food_amount) > 0 ? Number(b.food_amount) : meta.foodAmount,
        expenditure: b.expenditure !== undefined && Number(b.expenditure) > 0 ? Number(b.expenditure) : meta.expenditure,
        payment_mode: b.payment_mode || meta.paymentMode,
        collected_by: b.collected_by || meta.collectedBy,
        check_in_time: b.check_in_time || meta.checkInTime || '12:00 PM',
        check_out_time: b.check_out_time || meta.checkOutTime || '12:00 PM',
      };
    };

    // 1. Try secure Server API first
    try {
      const serverRes = await apiFetchBookings();
      if (serverRes.success && serverRes.bookings && Array.isArray(serverRes.bookings)) {
        const hydrated = (serverRes.bookings as any[]).map(hydrateBooking);
        setBookings(hydrated);
        saveLocalBookings(hydrated);
        setLoading(false);
        return;
      }
    } catch (apiErr) {
      console.warn('Server bookings API unavailable, trying direct connection / cache:', apiErr);
    }

    if (configured) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data, error } = await client
            .from('pogh_bookings')
            .select('*')
            .order('booking_date', { ascending: false });

          if (!error && data) {
            const hydrated = (data as any[]).map(hydrateBooking);
            setBookings(hydrated);
            saveLocalBookings(hydrated);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Error fetching Supabase bookings directly:', err);
        }
      }
    }

    // Fallback to local storage
    const local = getLocalBookings();
    const hydratedLocal = (local || []).map(hydrateBooking);
    setBookings(hydratedLocal);
    setLoading(false);
  }, []);

  // Realtime Sync Listener
  useEffect(() => {
    if (!currentUser) return;

    fetchBookings();

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchBookings();
      }, 350);
    };

    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      const channel = client
        .channel('pogh_realtime_bookings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pogh_bookings' },
          () => {
            debouncedFetch();
          }
        )
        .subscribe();

      return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        client.removeChannel(channel);
      };
    }
  }, [currentUser, fetchBookings]);

  // Handle New Bookings Save (Admin Only - Strictly via Server API using Private Key)
  const handleSaveBookings = async (newBookings: Booking[]) => {
    if (currentUser?.role !== 'admin') {
      alert('केवल एडमिन को नई बुकिंग करने की अनुमति है।');
      return;
    }

    // Secure Server API call with Private Service Role Key
    const apiRes = await apiCreateBookings(newBookings);
    if (apiRes.success) {
      await fetchBookings();
      if (newBookings.length > 0 && !newBookings[0].is_maintenance) {
        setSelectedLetterBooking(newBookings[0]);
        setIsLetterModalOpen(true);
      }
      return;
    }

    // Do NOT fall back to client-side anon insert which violates RLS and is vulnerable to tampering!
    throw new Error(apiRes.error || 'सर्वर पर बुकिंग सुरक्षित करने में विफल।');
  };

  // Handle Delete Booking (Admin Only - Strictly via Server API using Private Key)
  const handleDeleteBooking = async (id: string, groupId?: string) => {
    if (currentUser?.role !== 'admin') {
      alert('केवल एडमिन को रिकॉर्ड हटाने की अनुमति है।');
      return;
    }

    if (groupId) {
      const confirmDelete = window.confirm(`क्या आप इस बुकिंग समूह (${groupId}) के सभी दिवस रिकॉर्ड हटाना चाहते हैं?`);
      if (!confirmDelete) return;

      const apiRes = await apiDeleteBooking({ id, groupId });
      if (apiRes.success) {
        logActivity('DELETE', `बुकिंग समूह हटाया गया`, `ग्रुप: ${groupId}`);
        await fetchBookings();
        return;
      }
      alert('त्रुटि: ' + (apiRes.error || 'सर्वर पर रिकॉर्ड हटाने में विफल'));
      return;
    }

    const confirmSingle = window.confirm('क्या आप यह बुकिंग रिकॉर्ड स्थायी रूप से हटाना चाहते हैं?');
    if (!confirmSingle) return;

    const apiRes = await apiDeleteBooking({ id });
    if (apiRes.success) {
      logActivity('DELETE', `बुकिंग हटाई गई`, `आईडी: ${id}`);
      await fetchBookings();
      return;
    }
    alert('त्रुटि: ' + (apiRes.error || 'सर्वर पर रिकॉर्ड हटाने में विफल'));
  };

  // Handle Lifecycle Status Change (Admin & Operator)
  const handleUpdateStatus = async (
    booking: Booking,
    newStatus: BookingStatus,
    updateAllDates: boolean = false,
    extraUpdates?: Partial<Booking>
  ) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'operator') {
      alert('केवल एडमिन व ऑपरेटर को स्थिति अद्यतन करने की अनुमति है।');
      return;
    }

    const refCode = booking.group_id || extractGroupIdFromNotes(booking.notes);

    const apiRes = await apiUpdateBooking({
      id: booking.id,
      groupId: refCode,
      updatedData: { status: newStatus, ...(extraUpdates || {}) },
      applyToAll: updateAllDates && Boolean(refCode),
    });

    if (apiRes.success) {
      logActivity('STATUS_CHANGE', `स्थिति बदली: ${newStatus}`, `अतिथि: ${booking.guest_name}, संदर्भ: ${refCode}`);
      await fetchBookings();
      return;
    }

    alert('त्रुटि: ' + (apiRes.error || 'सर्वर पर स्थिति बदलने में विफल'));
  };

  // Open Letter Modal
  const handleOpenLetter = (booking: Booking) => {
    setSelectedLetterBooking(booking);
    setIsLetterModalOpen(true);
  };

  // Quick booking from room matrix / 7-days forecast view
  const handleQuickBook = (dateStr: string, suitKey: string) => {
    if (currentUser?.role !== 'admin') return;
    setInitialBookingDate(dateStr);
    setInitialBookingSuit(suitKey);
    setIsBookingModalOpen(true);
  };

  // Open Receipt Modal
  const handleOpenReceipt = (booking: Booking) => {
    setSelectedReceiptBooking(booking);
    setIsReceiptModalOpen(true);
  };

  // Open Edit Booking Modal (Admin Only)
  const handleOpenEdit = (booking: Booking) => {
    if (currentUser?.role !== 'admin') {
      alert('केवल एडमिन को विवरण संशोधित करने की अनुमति है।');
      return;
    }
    setSelectedEditBooking(booking);
    setIsEditModalOpen(true);
  };

  // Save Modified Booking Details (Admin Only - Strictly via Server API using Private Key)
  const handleSaveEdit = async (updatedData: Partial<Booking>, applyToAll: boolean) => {
    if (!selectedEditBooking) return;
    const refCode = selectedEditBooking.group_id || extractGroupIdFromNotes(selectedEditBooking.notes);

    const apiRes = await apiUpdateBooking({
      id: selectedEditBooking.id,
      groupId: refCode,
      updatedData,
      applyToAll: applyToAll && Boolean(refCode),
    });

    if (apiRes.success) {
      await fetchBookings();
      return;
    }

    throw new Error(apiRes.error || 'सर्वर पर बुकिंग अद्यतन करने में विफल');
  };

  // Open Collection Modal (Admin & Operator)
  const handleOpenCollection = (booking: Booking) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'operator') {
      alert(
        language === 'hi'
          ? 'केवल एडमिन व ऑपरेटर को कलेक्शन दर्ज करने की अनुमति है।'
          : 'Only Admin and Counter Operator are authorized to record collection.'
      );
      return;
    }
    setSelectedCollectionBooking(booking);
    setIsCollectionModalOpen(true);
  };

  // Save Collection (Desk Operator & Admin)
  const handleSaveCollection = async (data: {
    roomRentPerDay: number;
    foodAmount: number;
    expenditure: number;
    paymentMode: string;
    remarks?: string;
    markCheckedOut?: boolean;
  }) => {
    if (!selectedCollectionBooking) return;
    const targetBooking = selectedCollectionBooking;
    const targetRef = targetBooking.group_id || extractGroupIdFromNotes(targetBooking.notes);
    const dispNo = targetBooking.dispatch_no || extractDispatchNoFromNotes(targetBooking.notes);
    const cinDate = extractCheckInDateFromNotes(targetBooking.notes) || targetBooking.booking_date;
    const coutDate = extractCheckOutDateFromNotes(targetBooking.notes) || targetBooking.booking_date;
    const currentNotesClean = cleanNotesText(targetBooking.notes);

    const collectorName = currentUser?.displayName || 'Guest House Operator';

    // Safely preserve hourly stay metadata
    const existingMeta = parseBookingMeta(targetBooking.notes);
    const bType = (targetBooking.booking_type || existingMeta.bookingType) as ('STANDARD' | 'HOURLY') || 'STANDARD';
    const sHours = targetBooking.stay_hours || existingMeta.stayHours;
    const hRate = targetBooking.hourly_rate || existingMeta.hourlyRate;

    const finalNotes = encodeNotesWithMeta(
      currentNotesClean,
      targetRef,
      dispNo,
      cinDate,
      coutDate,
      data.roomRentPerDay,
      data.foodAmount,
      data.paymentMode,
      collectorName,
      data.remarks,
      data.expenditure,
      bType,
      sHours,
      hRate
    );

    const roomsCount =
      (Number(targetBooking.suit_1) > 0 ? 1 : 0) +
      (Number(targetBooking.suit_2) > 0 ? 1 : 0) +
      (Number(targetBooking.suit_3) > 0 ? 1 : 0) +
      (Number(targetBooking.suit_4) > 0 ? 1 : 0) || 1;

    const dayRentAmount = data.roomRentPerDay * roomsCount;
    const newStatus = data.markCheckedOut ? 'CHECKED_OUT' : targetBooking.status;

    const dbPayload: Record<string, any> = {
      total_amount: dayRentAmount > 0 ? dayRentAmount : data.roomRentPerDay,
      status: newStatus,
      notes: finalNotes,
      suit_1: Number(targetBooking.suit_1) > 0 ? (data.roomRentPerDay > 0 ? data.roomRentPerDay : 1) : 0,
      suit_2: Number(targetBooking.suit_2) > 0 ? (data.roomRentPerDay > 0 ? data.roomRentPerDay : 1) : 0,
      suit_3: Number(targetBooking.suit_3) > 0 ? (data.roomRentPerDay > 0 ? data.roomRentPerDay : 1) : 0,
      suit_4: Number(targetBooking.suit_4) > 0 ? (data.roomRentPerDay > 0 ? data.roomRentPerDay : 1) : 0,
      booking_type: bType,
      stay_hours: sHours,
      hourly_rate: hRate,
      food_amount: data.foodAmount,
      expenditure: data.expenditure,
      payment_mode: data.paymentMode,
      collected_by: collectorName,
    };

    // Secure Server API update with Private Key
    const apiRes = await apiUpdateBooking({
      id: targetBooking.id,
      groupId: targetRef,
      updatedData: dbPayload,
      applyToAll: Boolean(targetRef),
    });

    if (apiRes.success) {
      await fetchBookings();

      const gross = dayRentAmount + data.foodAmount;
      const net = gross <= 0 ? 0 : Math.max(0, gross - data.expenditure);

      logActivity(
        'UPDATE',
        `कलेक्शन दर्ज: शुद्ध ₹${net} (सकल: ₹${gross}, व्यय: ₹${data.expenditure})`,
        `अतिथि: ${targetBooking.guest_name}, कमरा: ₹${dayRentAmount}, भोजन: ₹${data.foodAmount}, व्यय: ₹${data.expenditure}, माध्यम: ${data.paymentMode}`
      );

      // Open receipt modal immediately so the operator can print or download
      setSelectedReceiptBooking({
        ...targetBooking,
        ...dbPayload,
        food_amount: data.foodAmount,
        expenditure: data.expenditure,
        payment_mode: data.paymentMode,
        collected_by: collectorName,
        collection_date: formatToISODate(new Date()),
      });
      setIsReceiptModalOpen(true);
      return;
    }

    alert('त्रुटि: ' + (apiRes.error || 'सर्वर पर भुगतान रिकॉर्ड करने में विफल'));
  };

  // Related bookings for letter
  const refCode = selectedLetterBooking
    ? selectedLetterBooking.group_id || extractGroupIdFromNotes(selectedLetterBooking.notes)
    : '';

  const relatedBookings = selectedLetterBooking
    ? (bookings.some((b) => {
        const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
        return (
          (refCode && bRef && refCode === bRef) ||
          ((b.guest_name || '').toLowerCase() === (selectedLetterBooking.guest_name || '').toLowerCase() &&
            b.mobile_number === selectedLetterBooking.mobile_number)
        );
      })
        ? bookings
        : [selectedLetterBooking, ...bookings]
      ).filter((b) => {
        if (b.status === 'CANCELLED') return false;
        const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
        if (refCode && bRef && refCode === bRef) return true;
        return (
          (b.guest_name || '').toLowerCase() === (selectedLetterBooking.guest_name || '').toLowerCase() &&
          b.mobile_number === selectedLetterBooking.mobile_number
        );
      })
    : [];

  // Memoized related bookings - computed unconditionally to adhere to React Rules of Hooks
  const editRelatedBookings = useMemo(() => {
    if (!isEditModalOpen || !selectedEditBooking) return [];
    const targetRef = selectedEditBooking.group_id || extractGroupIdFromNotes(selectedEditBooking.notes);
    const targetName = (selectedEditBooking.guest_name || '').toLowerCase();
    const targetMobile = selectedEditBooking.mobile_number;
    return bookings.filter((b) => {
      const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
      return (
        (targetRef && bRef === targetRef) ||
        ((b.guest_name || '').toLowerCase() === targetName && b.mobile_number === targetMobile)
      );
    });
  }, [isEditModalOpen, selectedEditBooking, bookings]);

  const collectionRelatedBookings = useMemo(() => {
    if (!isCollectionModalOpen || !selectedCollectionBooking) return [];
    const targetRef = selectedCollectionBooking.group_id || extractGroupIdFromNotes(selectedCollectionBooking.notes);
    const targetName = (selectedCollectionBooking.guest_name || '').toLowerCase();
    const targetMobile = selectedCollectionBooking.mobile_number;
    return bookings.filter((b) => {
      if (b.status === 'CANCELLED') return false;
      const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
      return (
        (targetRef && bRef === targetRef) ||
        ((b.guest_name || '').toLowerCase() === targetName && b.mobile_number === targetMobile)
      );
    });
  }, [isCollectionModalOpen, selectedCollectionBooking, bookings]);

  const receiptRelatedBookings = useMemo(() => {
    if (!isReceiptModalOpen || !selectedReceiptBooking) return [];
    const targetRef = selectedReceiptBooking.group_id || extractGroupIdFromNotes(selectedReceiptBooking.notes);
    const targetName = (selectedReceiptBooking.guest_name || '').toLowerCase();
    const targetMobile = selectedReceiptBooking.mobile_number;
    return bookings.filter((b) => {
      if (b.status === 'CANCELLED') return false;
      const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
      return (
        (targetRef && bRef === targetRef) ||
        ((b.guest_name || '').toLowerCase() === targetName && b.mobile_number === targetMobile)
      );
    });
  }, [isReceiptModalOpen, selectedReceiptBooking, bookings]);

  const isAdmin = currentUser?.role === 'admin';
  const isOperator = currentUser?.role === 'operator';

  if (!authChecked) {
    return null;
  }

  if (!currentUser) {
    return (
      <>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <LoginPage
          logoutReason={logoutReason}
          onLoginSuccess={(user) => {
            setLogoutReason(null);
            setShowSplash(false);
            setCurrentUser(user);
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans overflow-x-hidden max-w-full">
        
        {/* 1. Side Navigation Menu */}
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        {/* 2. Main Content Layout (Padded for Desktop Sidebar) */}
        <div className="flex-1 flex flex-col min-w-0 max-w-full lg:pl-64 transition-all duration-300 overflow-x-hidden">
          
          {/* Top Header */}
          <TopHeader
            currentUser={currentUser}
            activeTab={activeTab}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenBookingModal={() => {
              if (!isAdmin) return;
              setInitialBookingDate(selectedDate);
              setInitialBookingSuit(undefined);
              setIsBookingModalOpen(true);
            }}
            onOpenAuditLog={() => setIsAuditModalOpen(true)}
            onOpenMonthlyCollection={() => handleSelectTab('monthly')}
            onLogout={handleLogout}
          />

        {/* Dynamic Main Body Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
          
          {/* Tab 1: Executive Dashboard (Stats + Room Matrix + Today's Active Guests Widget) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <StatsCards 
                bookings={bookings} 
                onOpenMonthlyCollection={() => handleSelectTab('monthly')}
              />
              
              <RoomMatrix
                bookings={bookings}
                isAdmin={isAdmin}
                isOperator={isOperator}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                onSelectBooking={handleOpenLetter}
                onOpenRecordCollection={handleOpenCollection}
              />

              <TodayActivityWidget
                bookings={bookings}
                isAdmin={isAdmin}
                onSelectBooking={handleOpenLetter}
                onQuickBook={handleQuickBook}
                onViewAllSchedule={() => handleSelectTab('matrix')}
                onViewBookings={() => handleSelectTab('bookings')}
              />
            </div>
          )}

          {/* Tab 2: Dedicated Room Occupancy & Forecast Matrix */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              {/* Clean View Mode Toggle */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {matrixViewMode === '7days'
                      ? (language === 'hi' ? 'कमरा आवंटन व पूर्वानुमान (7-दिवसीय)' : 'Room Allotment & 7-Day Forecast')
                      : (language === 'hi' ? 'दैनिक कमरा उपलब्धता पंजिका' : 'Daily Room Availability Schedule')}
                  </h2>
                </div>

                <div className="bg-slate-200/90 p-1 rounded-xl flex items-center gap-1 text-xs font-bold shadow-2xs">
                  <button
                    onClick={() => setMatrixViewMode('7days')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      matrixViewMode === '7days'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {language === 'hi' ? '7-दिवसीय दृश्य' : '7 Days View'}
                  </button>
                  <button
                    onClick={() => setMatrixViewMode('schedule')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      matrixViewMode === 'schedule'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {language === 'hi' ? 'दैनिक सूची' : 'Daily Schedule'}
                  </button>
                </div>
              </div>

              {matrixViewMode === '7days' ? (
                <RoomStatus7Days
                  bookings={bookings}
                  isAdmin={isAdmin}
                  onSelectBooking={handleOpenLetter}
                  onQuickBook={handleQuickBook}
                />
              ) : (
                <DateWiseRoomSchedule
                  bookings={bookings}
                  isAdmin={isAdmin}
                  onSelectBooking={handleOpenLetter}
                  onQuickBook={handleQuickBook}
                />
              )}
            </div>
          )}

          {/* Tab 3: Date-Wise Booking Directory Focus */}
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <BookingsTable
                bookings={bookings}
                isAdmin={isAdmin}
                isOperator={isOperator}
                onOpenLetter={handleOpenLetter}
                onOpenReceipt={handleOpenReceipt}
                onOpenRecordCollection={handleOpenCollection}
                onEditBooking={handleOpenEdit}
                onDeleteBooking={handleDeleteBooking}
                onUpdateStatus={handleUpdateStatus}
              />
            </div>
          )}

          {/* Tab 4: Month-Wise Revenue & Collection Page */}
          {activeTab === 'monthly' && (
            <MonthlyCollectionPage
              bookings={bookings}
              onSelectBooking={handleOpenLetter}
            />
          )}

        </main>

        {/* Clean Official Footer */}
        <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <p className="font-bold text-slate-200">
                {language === 'hi' ? 'पुलिस ऑफिसर्स गेस्ट हाउस (POGH) • अयोध्या पुलिस' : 'Police Officers Guest House (POGH) • Ayodhya Police'}
              </p>
              <p className="text-[11px] text-slate-500 font-hindi mt-0.5">
                {language === 'hi' ? 'कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या (उ0प्र0)' : 'Office of SSP, Ayodhya District (U.P.)'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-slate-400 text-xs">
              <span className="text-amber-400 font-semibold">
                Designed & Developed by Rahul Yadav
              </span>
              <span className="hidden sm:inline text-slate-600">•</span>
              <span className="text-slate-300 font-medium">
                {currentUser.displayName}
              </span>
              <span>•</span>
              <span className="text-amber-400/90 font-semibold">
                {isAdmin ? (language === 'hi' ? 'एडमिन' : 'Admin') : (isOperator ? (language === 'hi' ? 'काउंटर ऑपरेटर' : 'Counter Operator') : (language === 'hi' ? 'ड्यूटी अधिकारी' : 'Duty Officer'))}
              </span>
            </div>
          </div>
        </footer>

      </div>

      {/* Modals */}
      {isAdmin && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setInitialBookingDate(null);
            setInitialBookingSuit(undefined);
          }}
          onSave={handleSaveBookings}
          existingBookings={bookings}
          initialDate={initialBookingDate || selectedDate}
          initialSuit={initialBookingSuit}
        />
      )}

      {isAdmin && (
        <EditBookingModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedEditBooking(null);
          }}
          booking={selectedEditBooking}
          existingBookings={bookings}
          relatedBookings={editRelatedBookings}
          onSave={handleSaveEdit}
        />
      )}

      <HindiLetterModal
        isOpen={isLetterModalOpen}
        onClose={() => {
          setIsLetterModalOpen(false);
          setSelectedLetterBooking(null);
        }}
        booking={selectedLetterBooking}
        relatedBookings={relatedBookings}
      />

      <RecordCollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => {
          setIsCollectionModalOpen(false);
          setSelectedCollectionBooking(null);
        }}
        booking={selectedCollectionBooking}
        currentUserDisplayName={currentUser.displayName}
        relatedBookings={collectionRelatedBookings}
        onSaveCollection={handleSaveCollection}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedReceiptBooking(null);
        }}
        booking={selectedReceiptBooking}
        relatedBookings={receiptRelatedBookings}
      />

        <AuditLogModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
        />
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <LanguageProvider>
      <HomePageContent />
    </LanguageProvider>
  );
}
