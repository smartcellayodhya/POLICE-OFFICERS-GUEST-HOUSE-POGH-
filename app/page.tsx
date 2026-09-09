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

import { Navbar } from '@/components/Navbar';
import { StatsCards } from '@/components/StatsCards';
import { RoomMatrix } from '@/components/RoomMatrix';
import { BookingsTable } from '@/components/BookingsTable';
import { BookingModal } from '@/components/BookingModal';
import { HindiLetterModal } from '@/components/HindiLetterModal';
import { SupabaseConfigModal } from '@/components/SupabaseConfigModal';
import { StaffPinModal } from '@/components/StaffPinModal';
import { Phone, Shield, ExternalLink, RefreshCw } from 'lucide-react';

export default function HomePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // Staff Security PIN State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [initialBookingDate, setInitialBookingDate] = useState<string | undefined>();
  const [initialBookingSuit, setInitialBookingSuit] = useState<string | undefined>();

  const [selectedLetterBooking, setSelectedLetterBooking] = useState<Booking | null>(null);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Check saved admin status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAuth = sessionStorage.getItem('pogh_admin_auth');
      if (savedAuth === 'true') {
        setIsAdminUnlocked(true);
      }
    }
  }, []);

  // Request auth helper
  const requestAuth = (action?: () => void) => {
    if (action) setPendingAction(() => action);
    setIsPinModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setIsAdminUnlocked(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pogh_admin_auth', 'true');
    }
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleToggleAdminLock = () => {
    if (isAdminUnlocked) {
      setIsAdminUnlocked(false);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pogh_admin_auth');
      }
    } else {
      setIsPinModalOpen(true);
    }
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
  }, [fetchBookings]);

  // Handle New Bookings Save
  const handleSaveBookings = async (newBookings: Booking[]) => {
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

  // Handle Delete Booking (Single or Group)
  const handleDeleteBooking = async (id: string, groupId?: string) => {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        if (groupId) {
          // Check if user wants to delete all with this groupId
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

  // Handle Lifecycle Status Change (CONFIRMED -> CHECKED_IN -> CHECKED_OUT -> CANCELLED)
  const handleUpdateStatus = async (
    booking: Booking,
    newStatus: BookingStatus,
    updateAllDates: boolean = false
  ) => {
    const refCode = booking.group_id || extractGroupIdFromNotes(booking.notes);

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        if (updateAllDates && refCode) {
          // Update all matching rows in notes
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

  // Quick Book from Matrix
  const handleQuickBook = (dateStr: string, suitKey: string) => {
    if (!isAdminUnlocked) {
      requestAuth(() => {
        setInitialBookingDate(dateStr);
        setInitialBookingSuit(suitKey);
        setIsBookingModalOpen(true);
      });
      return;
    }
    setInitialBookingDate(dateStr);
    setInitialBookingSuit(suitKey);
    setIsBookingModalOpen(true);
  };

  // Open Letter Modal
  const handleOpenLetter = (booking: Booking) => {
    setSelectedLetterBooking(booking);
    setIsLetterModalOpen(true);
  };

  // Find related bookings (matching groupId or guest name + phone)
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <Navbar
        isRealtimeActive={isRealtimeActive}
        isSupabaseConfigured={isConfigured}
        isAdminUnlocked={isAdminUnlocked}
        onOpenBookingModal={() => {
          if (!isAdminUnlocked) {
            requestAuth(() => {
              setInitialBookingDate(undefined);
              setInitialBookingSuit(undefined);
              setIsBookingModalOpen(true);
            });
            return;
          }
          setInitialBookingDate(undefined);
          setInitialBookingSuit(undefined);
          setIsBookingModalOpen(true);
        }}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onExportExcel={() => exportBookingsToExcel(bookings)}
        onToggleAdminLock={handleToggleAdminLock}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Security Banner if Locked */}
        {!isAdminUnlocked && (
          <div className="mb-5 p-3 rounded-xl bg-slate-900 text-slate-200 border-l-4 border-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white">View Only Mode: </span>
                <span>You can view room occupancy and letters. Staff authorization (PIN: 1122) is required to add or modify bookings.</span>
              </div>
            </div>
            <button
              onClick={() => setIsPinModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap transition"
            >
              Enter Staff PIN
            </button>
          </div>
        )}

        {/* Operational Metric Cards */}
        <StatsCards bookings={bookings} />

        {/* Room Occupancy Matrix */}
        <RoomMatrix
          bookings={bookings}
          onQuickBook={handleQuickBook}
          onSelectBooking={(b) => handleOpenLetter(b)}
        />

        {/* Bookings Directory Table */}
        <BookingsTable
          bookings={bookings}
          isAdminUnlocked={isAdminUnlocked}
          onRequestAuth={() => setIsPinModalOpen(true)}
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
            <span className="text-slate-500">Security Protected & Realtime Active</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSave={handleSaveBookings}
        existingBookings={bookings}
        initialDate={initialBookingDate}
        initialSuit={initialBookingSuit}
      />

      <HindiLetterModal
        isOpen={isLetterModalOpen}
        onClose={() => {
          setIsLetterModalOpen(false);
          setSelectedLetterBooking(null);
        }}
        booking={selectedLetterBooking}
        relatedBookings={relatedBookings}
      />

      <SupabaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConfigSaved={() => fetchBookings()}
      />

      <StaffPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
