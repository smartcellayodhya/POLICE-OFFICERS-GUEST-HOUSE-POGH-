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

import { LoginPage } from '@/components/LoginPage';
import { Sidebar, NavTab } from '@/components/Sidebar';
import { TopHeader } from '@/components/TopHeader';
import { StatsCards } from '@/components/StatsCards';
import { RoomMatrix } from '@/components/RoomMatrix';
import { BookingsTable } from '@/components/BookingsTable';
import { BookingModal } from '@/components/BookingModal';
import { HindiLetterModal } from '@/components/HindiLetterModal';
import { Phone, Shield } from 'lucide-react';

export default function HomePage() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [initialBookingDate, setInitialBookingDate] = useState<string | undefined>();
  const [initialBookingSuit, setInitialBookingSuit] = useState<string | undefined>();

  const [selectedLetterBooking, setSelectedLetterBooking] = useState<Booking | null>(null);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);

  // Check login on mount
  useEffect(() => {
    const user = getLoggedInUser();
    if (user) {
      setCurrentUser(user);
    }
    setAuthChecked(true);
  }, []);

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

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        if (groupId) {
          const confirmAll = window.confirm(
            `क्या आप इस बुकिंग समूह (${groupId}) के सभी दिवस रिकॉर्ड हटाना चाहते हैं?`
          );
          if (confirmAll) {
            const { error } = await client
              .from('pogh_bookings')
              .delete()
              .ilike('notes', `%${groupId}%`);
            if (error) alert('त्रुटि: ' + error.message);
            await fetchBookings();
            return;
          }
        }

        const { error } = await client.from('pogh_bookings').delete().eq('id', id);
        if (error) {
          alert('त्रुटि: ' + error.message);
          return;
        }
        await fetchBookings();
        return;
      }
    }

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

    setBookings(updated);
    saveLocalBookings(updated);
  };

  // Quick Book from Matrix (Admin only)
  const handleQuickBook = (dateStr: string, suitKey: string) => {
    if (currentUser?.role !== 'admin') return;
    setInitialBookingDate(dateStr);
    setInitialBookingSuit(suitKey);
    setIsBookingModalOpen(true);
  };

  // Open Letter Modal
  const handleOpenLetter = (booking: Booking) => {
    setSelectedLetterBooking(booking);
    setIsLetterModalOpen(true);
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

  if (!authChecked) return null;

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      
      {/* 1. Side Navigation Menu */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenBookingModal={() => {
          if (!isAdmin) return;
          setInitialBookingDate(undefined);
          setInitialBookingSuit(undefined);
          setIsBookingModalOpen(true);
        }}
        onExportExcel={() => exportBookingsToExcel(bookings)}
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
            setInitialBookingDate(undefined);
            setInitialBookingSuit(undefined);
            setIsBookingModalOpen(true);
          }}
        />

        {/* Dynamic Main Body Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Officer Notification */}
          {!isAdmin && (
            <div className="mb-5 p-3 rounded-2xl bg-blue-900 text-blue-100 border-l-4 border-blue-400 flex items-center gap-3 shadow-xs">
              <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white">ड्यूटी अधिकारी दृश्य (Officer Mode): </span>
                <span className="text-blue-200">
                  आप कमरों की उपलब्धता स्थिति, बुकिंग पंजिका एवं आधिकारिक आवंटन पत्र देख सकते हैं। नई बुकिंग एवं संशोधन प्रशासक (Admin) द्वारा प्रबंधित हैं।
                </span>
              </div>
            </div>
          )}

          {/* Tab 1: Dashboard Overview */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <StatsCards bookings={bookings} />
              <RoomMatrix
                bookings={bookings}
                isAdmin={isAdmin}
                onQuickBook={handleQuickBook}
                onSelectBooking={handleOpenLetter}
              />
              <BookingsTable
                bookings={bookings}
                isAdmin={isAdmin}
                onOpenLetter={handleOpenLetter}
                onDeleteBooking={handleDeleteBooking}
                onUpdateStatus={handleUpdateStatus}
              />
            </div>
          )}

          {/* Tab 2: Room Occupancy Matrix Focus */}
          {activeTab === 'matrix' && (
            <div className="space-y-6">
              <StatsCards bookings={bookings} />
              <RoomMatrix
                bookings={bookings}
                isAdmin={isAdmin}
                onQuickBook={handleQuickBook}
                onSelectBooking={handleOpenLetter}
              />
            </div>
          )}

          {/* Tab 3: Bookings Directory Focus */}
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <BookingsTable
                bookings={bookings}
                isAdmin={isAdmin}
                onOpenLetter={handleOpenLetter}
                onDeleteBooking={handleDeleteBooking}
                onUpdateStatus={handleUpdateStatus}
              />
            </div>
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

            <div className="flex items-center gap-4 text-slate-400 text-xs">
              <div className="flex items-center gap-1.5 font-hindi">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>संपर्क सूत्र: उ0नि0 यदुनाथ मो0न0-8317041684</span>
              </div>
              <span>•</span>
              <span className="text-slate-400 font-medium">
                {currentUser.displayName}
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
          initialDate={initialBookingDate}
          initialSuit={initialBookingSuit}
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
    </div>
  );
}
