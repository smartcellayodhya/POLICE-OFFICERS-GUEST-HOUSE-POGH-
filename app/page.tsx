'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
} from '@/lib/bookingUtils';
import { AuthUser, getLoggedInUser, logoutUser } from '@/lib/auth';
import { formatToISODate } from '@/lib/dateUtils';

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

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [matrixViewMode, setMatrixViewMode] = useState<'7days' | 'schedule'>('7days');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Date Selection State (Default: Today)
  const [selectedDate, setSelectedDate] = useState<string>(() => formatToISODate(new Date()));

  // Data State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = tab === 'dashboard' ? '/' : `/${tab}`;
      window.history.pushState({}, '', url);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setShowSplash(false);
  };

  // Load Bookings
  const fetchBookings = useCallback(async () => {
    const configured = isSupabaseConfigured();

    if (configured) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data, error } = await client
            .from('pogh_bookings')
            .select('*')
            .order('booking_date', { ascending: false });

          if (!error && data) {
            setBookings(data);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Error fetching Supabase bookings:', err);
        }
      }
    }

    // Fallback to local storage
    const local = getLocalBookings();
    setBookings(local);
    setLoading(false);
  }, []);

  // Realtime Sync Listener
  useEffect(() => {
    if (!currentUser) return;

    fetchBookings();

    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      const channel = client
        .channel('pogh_realtime_bookings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pogh_bookings' },
          () => {
            fetchBookings();
          }
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    }
  }, [currentUser, fetchBookings]);

  // Handle New Bookings Save (Admin Only)
  const handleSaveBookings = async (newBookings: Booking[]) => {
    if (currentUser?.role !== 'admin') {
      alert('केवल एडमिन को नई बुकिंग करने की अनुमति है।');
      return;
    }

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        const payload = newBookings.map((b) => ({
          booking_date: b.booking_date,
          guest_name: b.guest_name,
          mobile_number: b.mobile_number,
          reference: b.reference,
          suit_1: b.suit_1,
          suit_2: b.suit_2,
          suit_3: b.suit_3,
          suit_4: b.suit_4,
          total_amount: b.total_amount,
          meal_type_status: b.meal_type_status,
          status: b.status || 'CONFIRMED',
          notes: b.notes || '',
        }));

        const { error } = await client.from('pogh_bookings').insert(payload);
        if (error) {
          throw new Error(error.message);
        }
        await fetchBookings();

        // Redirect to Letter Modal with Print & PDF options
        if (newBookings.length > 0 && !newBookings[0].is_maintenance) {
          setSelectedLetterBooking(newBookings[0]);
          setIsLetterModalOpen(true);
        }
        return;
      }
    }

    // Local save
    const updated = [...newBookings, ...bookings];
    setBookings(updated);
    saveLocalBookings(updated);

    // Redirect to Letter Modal with Print & PDF options
    if (newBookings.length > 0 && !newBookings[0].is_maintenance) {
      setSelectedLetterBooking(newBookings[0]);
      setIsLetterModalOpen(true);
    }
  };

  // Handle Delete Booking (Admin Only)
  const handleDeleteBooking = async (id: string, groupId?: string) => {
    if (currentUser?.role !== 'admin') {
      alert('केवल एडमिन को रिकॉर्ड हटाने की अनुमति है।');
      return;
    }

    if (groupId) {
      const confirmDelete = window.confirm(`क्या आप इस बुकिंग समूह (${groupId}) के सभी दिवस रिकॉर्ड हटाना चाहते हैं?`);
      if (!confirmDelete) return;

      if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
          const { error } = await client
            .from('pogh_bookings')
            .delete()
            .ilike('notes', `%${groupId}%`);
          if (error) {
            alert('त्रुटि: ' + error.message);
            return;
          }
          logActivity('DELETE', `बुकिंग समूह हटाया गया`, `ग्रुप: ${groupId}`);
          await fetchBookings();
          return;
        }
      }

      logActivity('DELETE', `बुकिंग समूह हटाया गया`, `ग्रुप: ${groupId}`);
      const filtered = bookings.filter((b) => {
        const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
        return bRef !== groupId && b.id !== id;
      });
      setBookings(filtered);
      saveLocalBookings(filtered);
      return;
    }

    const confirmSingle = window.confirm('क्या आप यह बुकिंग रिकॉर्ड स्थायी रूप से हटाना चाहते हैं?');
    if (!confirmSingle) return;

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client.from('pogh_bookings').delete().eq('id', id);
        if (error) {
          alert('त्रुटि: ' + error.message);
          return;
        }
        logActivity('DELETE', `बुकिंग हटाई गई`, `आईडी: ${id}`);
        await fetchBookings();
        return;
      }
    }

    logActivity('DELETE', `बुकिंग हटाई गई`, `आईडी: ${id}`);
    const filtered = bookings.filter((b) => b.id !== id);
    setBookings(filtered);
    saveLocalBookings(filtered);
  };

  // Handle Lifecycle Status Change (Admin & Operator)
  const handleUpdateStatus = async (
    booking: Booking,
    newStatus: BookingStatus,
    updateAllDates: boolean = false
  ) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'operator') {
      alert('केवल एडमिन व ऑपरेटर को स्थिति अद्यतन करने की अनुमति है।');
      return;
    }

    const refCode = booking.group_id || extractGroupIdFromNotes(booking.notes);

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        if (updateAllDates && refCode) {
          const { error } = await client
            .from('pogh_bookings')
            .update({ status: newStatus })
            .ilike('notes', `%${refCode}%`);
          if (error) {
            alert('त्रुटि: ' + error.message);
            return;
          }
        } else {
          const { error } = await client
            .from('pogh_bookings')
            .update({ status: newStatus })
            .eq('id', booking.id);
          if (error) {
            alert('त्रुटि: ' + error.message);
            return;
          }
        }
        logActivity('STATUS_CHANGE', `स्थिति बदली: ${newStatus}`, `अतिथि: ${booking.guest_name}, संदर्भ: ${refCode}`);
        await fetchBookings();
        return;
      }
    }

    const updated = bookings.map((b) => {
      if (updateAllDates && refCode) {
        const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
        if (bRef === refCode) {
          return { ...b, status: newStatus };
        }
      }
      return b.id === booking.id ? { ...b, status: newStatus } : b;
    });

    logActivity('STATUS_CHANGE', `स्थिति बदली: ${newStatus}`, `अतिथि: ${booking.guest_name}, संदर्भ: ${refCode}`);
    setBookings(updated);
    saveLocalBookings(updated);
  };

  // Open Letter Modal
  const handleOpenLetter = (booking: Booking) => {
    setSelectedLetterBooking(booking);
    setIsLetterModalOpen(true);
  };

  // Quick booking from room matrix / 7-days forecast view
  const handleQuickBook = (dateStr: string, suitKey: string) => {
    if (currentUser?.role !== 'admin') return;
    const today = formatToISODate(new Date());
    if (dateStr < today) {
      alert('बीती तारीख में नया आरक्षण नहीं किया जा सकता। कृपया आज या आगामी तारीख चुनें।');
      return;
    }
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

  // Save Modified Booking Details
  const handleSaveEdit = async (updatedData: Partial<Booking>, applyToAll: boolean) => {
    if (!selectedEditBooking) return;
    const refCode = selectedEditBooking.group_id || extractGroupIdFromNotes(selectedEditBooking.notes);

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        if (applyToAll && refCode) {
          const { error } = await client
            .from('pogh_bookings')
            .update(updatedData)
            .ilike('notes', `%${refCode}%`);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await client
            .from('pogh_bookings')
            .update(updatedData)
            .eq('id', selectedEditBooking.id);
          if (error) throw new Error(error.message);
        }
        await fetchBookings();
        return;
      }
    }

    // Local storage fallback
    const updated = bookings.map((b) => {
      if (applyToAll && refCode) {
        const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
        if (bRef === refCode) {
          return { ...b, ...updatedData };
        }
      }
      return b.id === selectedEditBooking.id ? { ...b, ...updatedData } : b;
    });

    setBookings(updated);
    saveLocalBookings(updated);
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
      data.expenditure
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
    };

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        if (targetRef) {
          const { error } = await client
            .from('pogh_bookings')
            .update(dbPayload)
            .ilike('notes', `%${targetRef}%`);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await client
            .from('pogh_bookings')
            .update(dbPayload)
            .eq('id', targetBooking.id);
          if (error) throw new Error(error.message);
        }
        await fetchBookings();
      }
    }

    // Local / in-memory state update
    const updated = bookings.map((b) => {
      const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
      const isTarget = (targetRef && bRef === targetRef) || b.id === targetBooking.id;
      if (isTarget) {
        return {
          ...b,
          ...dbPayload,
          food_amount: data.foodAmount,
          expenditure: data.expenditure,
          payment_mode: data.paymentMode,
          collected_by: collectorName,
          collection_date: formatToISODate(new Date()),
        };
      }
      return b;
    });

    setBookings(updated);
    saveLocalBookings(updated);

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
          (b.guest_name.toLowerCase() === selectedLetterBooking.guest_name.toLowerCase() &&
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
          b.guest_name.toLowerCase() === selectedLetterBooking.guest_name.toLowerCase() &&
          b.mobile_number === selectedLetterBooking.mobile_number
        );
      })
    : [];

  if (!authChecked) {
    return null;
  }

  if (!currentUser) {
    return (
      <>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <LoginPage
          onLoginSuccess={(user) => {
            setShowSplash(false);
            setCurrentUser(user);
          }}
        />
      </>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const isOperator = currentUser.role === 'operator';

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
              <StatsCards bookings={bookings} />
              
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
          relatedBookings={
            selectedEditBooking
              ? bookings.filter((b) => {
                  const targetRef = selectedEditBooking.group_id || extractGroupIdFromNotes(selectedEditBooking.notes);
                  const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
                  return (
                    (targetRef && bRef === targetRef) ||
                    (b.guest_name.toLowerCase() === selectedEditBooking.guest_name.toLowerCase() &&
                      b.mobile_number === selectedEditBooking.mobile_number)
                  );
                })
              : []
          }
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
        relatedBookings={
          selectedCollectionBooking
            ? bookings.filter((b) => {
                if (b.status === 'CANCELLED') return false;
                const targetRef = selectedCollectionBooking.group_id || extractGroupIdFromNotes(selectedCollectionBooking.notes);
                const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
                return (
                  (targetRef && bRef === targetRef) ||
                  (b.guest_name.toLowerCase() === selectedCollectionBooking.guest_name.toLowerCase() &&
                    b.mobile_number === selectedCollectionBooking.mobile_number)
                );
              })
            : []
        }
        onSaveCollection={handleSaveCollection}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedReceiptBooking(null);
        }}
        booking={selectedReceiptBooking}
        relatedBookings={
          selectedReceiptBooking
            ? bookings.filter((b) => {
                if (b.status === 'CANCELLED') return false;
                const targetRef = selectedReceiptBooking.group_id || extractGroupIdFromNotes(selectedReceiptBooking.notes);
                const bRef = b.group_id || extractGroupIdFromNotes(b.notes);
                return (
                  (targetRef && bRef === targetRef) ||
                  (b.guest_name.toLowerCase() === selectedReceiptBooking.guest_name.toLowerCase() &&
                    b.mobile_number === selectedReceiptBooking.mobile_number)
                );
              })
            : []
        }
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
