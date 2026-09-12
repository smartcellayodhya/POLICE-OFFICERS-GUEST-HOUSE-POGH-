'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Booking, BookingStatus } from '@/lib/types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  getLocalBookings,
  saveLocalBookings,
} from '@/lib/supabase';
import { exportBookingsToExcel } from '@/lib/excel';
import { extractGroupIdFromNotes } from '@/lib/bookingUtils';
import { AuthUser, getLoggedInUser, logoutUser } from '@/lib/auth';
import { formatToISODate } from '@/lib/dateUtils';

import { LoginPage } from '@/components/LoginPage';
import { Sidebar, NavTab } from '@/components/Sidebar';
import { TopHeader } from '@/components/TopHeader';
import { StatsCards } from '@/components/StatsCards';
import { RoomMatrix } from '@/components/RoomMatrix';
import { RoomStatus7Days } from '@/components/RoomStatus7Days';
import { DateWiseRoomSchedule } from '@/components/DateWiseRoomSchedule';
import { BookingsTable } from '@/components/BookingsTable';
import { BookingModal } from '@/components/BookingModal';
import { EditBookingModal } from '@/components/EditBookingModal';
import { HindiLetterModal } from '@/components/HindiLetterModal';
import { ReceiptModal } from '@/components/ReceiptModal';
import { AuditLogModal } from '@/components/AuditLogModal';
import { MonthlyCollectionPage } from '@/components/MonthlyCollectionPage';
import { SplashScreen } from '@/components/SplashScreen';
import { LanguageProvider } from '@/lib/languageContext';
import { logActivity } from '@/lib/auditLog';

export default function HomePage() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
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

  // Check login and sync URL route on mount
  useEffect(() => {
    const user = getLoggedInUser();
    if (user) {
      setCurrentUser(user);
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
      alert('केवल प्रशासक (Admin) को नई बुकिंग करने की अनुमति है।');
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
        return;
      }
    }

    // Local save
    const updated = [...newBookings, ...bookings];
    setBookings(updated);
    saveLocalBookings(updated);
  };

  // Handle Delete Booking (Admin Only)
  const handleDeleteBooking = async (id: string, groupId?: string) => {
    if (currentUser?.role !== 'admin') {
      alert('केवल प्रशासक (Admin) को रिकॉर्ड हटाने की अनुमति है।');
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

  // Handle Lifecycle Status Change (Admin Only)
  const handleUpdateStatus = async (
    booking: Booking,
    newStatus: BookingStatus,
    updateAllDates: boolean = false
  ) => {
    if (currentUser?.role !== 'admin') {
      alert('केवल प्रशासक (Admin) को स्थिति अद्यतन करने की अनुमति है।');
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
      alert('केवल प्रशासक (Admin) को विवरण संशोधित करने की अनुमति है।');
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

  // Related bookings for letter
  const refCode = selectedLetterBooking
    ? selectedLetterBooking.group_id || extractGroupIdFromNotes(selectedLetterBooking.notes)
    : '';

  const relatedBookings = selectedLetterBooking
    ? bookings.filter((b) => {
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
    return <SplashScreen />;
  }

  if (!currentUser) {
    return (
      <>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />
      </>
    );
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <LanguageProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
        
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
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-300">
          
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
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Tab 1: Dashboard (Stats + Room Matrix Inspector + Date-Wise Past & Future Schedule) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Upar ka hissa: Stats Cards */}
              <StatsCards bookings={bookings} />
              
              {/* Upar ka hissa: Room Status Matrix Inspector (Selected Date) */}
              <RoomMatrix
                bookings={bookings}
                isAdmin={isAdmin}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                onSelectBooking={handleOpenLetter}
              />

              {/* Niche ka hissa: Har date par kaun sa room book ya khali hai (Past & Future list) */}
              <DateWiseRoomSchedule
                bookings={bookings}
                isAdmin={isAdmin}
                onSelectBooking={handleOpenLetter}
                onQuickBook={handleQuickBook}
              />
            </div>
          )}

          {/* Tab 2: Room Occupancy Matrix Focus (7 Days Forecast) */}
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              <RoomStatus7Days
                bookings={bookings}
                isAdmin={isAdmin}
                onSelectBooking={handleOpenLetter}
                onQuickBook={handleQuickBook}
              />
            </div>
          )}

          {/* Tab 3: Date-Wise Booking Directory Focus */}
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <BookingsTable
                bookings={bookings}
                isAdmin={isAdmin}
                onOpenLetter={handleOpenLetter}
                onOpenReceipt={handleOpenReceipt}
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
                पुलिस ऑफिसर्स गेस्ट हाउस (POGH) • अयोध्या पुलिस
              </p>
              <p className="text-[11px] text-slate-500 font-hindi mt-0.5">
                कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या (उ0प्र0)
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
                {isAdmin ? 'प्रशासक' : 'ड्यूटी अधिकारी'}
              </span>
            </div>
          </div>
        </footer>

      </div>

      {/* Modals */}
      {isAdmin && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
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
      </LanguageProvider>
    </>
  );
}
