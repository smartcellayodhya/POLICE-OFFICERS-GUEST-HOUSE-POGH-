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
import { Navbar } from '@/components/Navbar';
import { StatsCards } from '@/components/StatsCards';
import { RoomMatrix } from '@/components/RoomMatrix';
import { BookingsTable } from '@/components/BookingsTable';
import { BookingModal } from '@/components/BookingModal';
import { HindiLetterModal } from '@/components/HindiLetterModal';
import { SupabaseConfigModal } from '@/components/SupabaseConfigModal';
import { Phone, Shield, ExternalLink, RefreshCw } from 'lucide-react';

export default function HomePage() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Data & Dashboard State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [initialBookingDate, setInitialBookingDate] = useState<string | undefined>();
  const [initialBookingSuit, setInitialBookingSuit] = useState<string | undefined>();

  const [selectedLetterBooking, setSelectedLetterBooking] = useState<Booking | null>(null);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

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
    setIsConfigured(configured);

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

  // Setup Realtime or Polling
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
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeActive(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsRealtimeActive(false);
          }
        });

      return () => {
        client.removeChannel(channel);
      };
    }
  }, [currentUser, fetchBookings]);

  // Handle New Bookings Save (Admin Only)
  const handleSaveBookings = async (newBookings: Booking[]) => {
    if (currentUser?.role !== 'admin') {
      alert('Only Admin has permissions to create bookings.');
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
      alert('Only Admin has permissions to delete bookings.');
      return;
    }

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        if (groupId) {
          const confirmAll = window.confirm(
            `Delete all dates for this booking group (${groupId})? Click OK for All dates, Cancel for this single date.`
          );
          if (confirmAll) {
            const { error } = await client
              .from('pogh_bookings')
              .delete()
              .ilike('notes', `%${groupId}%`);
            if (error) alert('Delete error: ' + error.message);
            await fetchBookings();
            return;
          }
        }

        const { error } = await client.from('pogh_bookings').delete().eq('id', id);
        if (error) {
          alert('Could not delete from Supabase: ' + error.message);
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
      alert('Only Admin has permissions to update booking status.');
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
            alert('Update error: ' + error.message);
            return;
          }
        } else {
          const { error } = await client
            .from('pogh_bookings')
            .update({ status: newStatus })
            .eq('id', booking.id);
          if (error) {
            alert('Update error: ' + error.message);
            return;
          }
        }
        await fetchBookings();
        return;
      }
    }

    // Local state fallback
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

  // Open Letter Modal (Both Admin and Officer)
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

  // Wait for client storage check
  if (!authChecked) {
    return null;
  }

  // Show login page if not authenticated
  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <Navbar
        currentUser={currentUser}
        isRealtimeActive={isRealtimeActive}
        isSupabaseConfigured={isConfigured}
        onOpenBookingModal={() => {
          if (!isAdmin) return;
          setInitialBookingDate(undefined);
          setInitialBookingSuit(undefined);
          setIsBookingModalOpen(true);
        }}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onExportExcel={() => exportBookingsToExcel(bookings)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Officer Mode Banner */}
        {!isAdmin && (
          <div className="mb-5 p-3.5 rounded-xl bg-blue-900/90 text-blue-100 border-l-4 border-blue-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white text-sm">Duty Officer Portal (अधिकारी दृश्य): </span>
                <span className="text-blue-200">
                  You have full access to view Room Occupancy, Booking History, and download official Hindi Letters and Excel Reports. Creation and modifications are managed by Admin.
                </span>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded bg-blue-800 text-blue-200 font-mono font-semibold whitespace-nowrap">
              Duty Officer Active
            </span>
          </div>
        )}

        {/* Operational Metric Cards */}
        <StatsCards bookings={bookings} />

        {/* Room Occupancy Matrix */}
        <RoomMatrix
          bookings={bookings}
          isAdmin={isAdmin}
          onQuickBook={handleQuickBook}
          onSelectBooking={(b) => handleOpenLetter(b)}
        />

        {/* Bookings Directory Table */}
        <BookingsTable
          bookings={bookings}
          isAdmin={isAdmin}
          onOpenLetter={handleOpenLetter}
          onDeleteBooking={handleDeleteBooking}
          onUpdateStatus={handleUpdateStatus}
        />

      </main>

      {/* Official UP Police Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-bold text-slate-200 tracking-wide">
              पुलिस ऑफिसर्स गेस्ट हाउस (POGH) • अयोध्या पुलिस
            </p>
            <p className="text-[11px] text-slate-500 font-hindi mt-0.5">
              कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या (उ0प्र0)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400 text-xs">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>हेल्पलाइन: उ0नि0 यदुनाथ मो0न0-8317041684</span>
            </div>
            <span>•</span>
            <span className="text-slate-500">
              Logged in as: <strong className="text-slate-300">{currentUser.displayName}</strong>
            </span>
          </div>
        </div>
      </footer>

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

      {isAdmin && (
        <SupabaseConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onConfigSaved={() => fetchBookings()}
        />
      )}
    </div>
  );
}
