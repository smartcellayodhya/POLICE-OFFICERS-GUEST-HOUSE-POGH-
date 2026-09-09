'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Booking } from '@/lib/types';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  getLocalBookings,
  saveLocalBookings,
} from '@/lib/supabase';
import { exportBookingsToExcel } from '@/lib/excel';

import { Navbar } from '@/components/Navbar';
import { StatsCards } from '@/components/StatsCards';
import { RoomMatrix } from '@/components/RoomMatrix';
import { BookingsTable } from '@/components/BookingsTable';
import { BookingModal } from '@/components/BookingModal';
import { HindiLetterModal } from '@/components/HindiLetterModal';
import { SupabaseConfigModal } from '@/components/SupabaseConfigModal';
import { Phone, Shield, ExternalLink, RefreshCw } from 'lucide-react';

export default function HomePage() {
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

  // Handle Delete Booking
  const handleDeleteBooking = async (id: string) => {
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
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

  // Handle Toggle Status
  const handleToggleStatus = async (booking: Booking) => {
    const newStatus = booking.status === 'CANCELLED' ? 'CONFIRMED' : 'CANCELLED';

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('pogh_bookings')
          .update({ status: newStatus })
          .eq('id', booking.id);
        if (error) {
          alert('Could not update status: ' + error.message);
          return;
        }
        await fetchBookings();
        return;
      }
    }

    const updated = bookings.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b));
    setBookings(updated);
    saveLocalBookings(updated);
  };

  // Quick Book from Matrix
  const handleQuickBook = (dateStr: string, suitKey: string) => {
    setInitialBookingDate(dateStr);
    setInitialBookingSuit(suitKey);
    setIsBookingModalOpen(true);
  };

  // Open Letter Modal
  const handleOpenLetter = (booking: Booking) => {
    setSelectedLetterBooking(booking);
    setIsLetterModalOpen(true);
  };

  // Find related bookings (same guest & mobile around the same dates)
  const relatedBookings = selectedLetterBooking
    ? bookings.filter(
        (b) =>
          b.guest_name.toLowerCase() === selectedLetterBooking.guest_name.toLowerCase() &&
          b.mobile_number === selectedLetterBooking.mobile_number &&
          b.status !== 'CANCELLED'
      )
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <Navbar
        isRealtimeActive={isRealtimeActive}
        isSupabaseConfigured={isConfigured}
        onOpenBookingModal={() => {
          setInitialBookingDate(undefined);
          setInitialBookingSuit(undefined);
          setIsBookingModalOpen(true);
        }}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onExportExcel={() => exportBookingsToExcel(bookings)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Supabase Notice Banner if not configured yet */}
        {!isConfigured && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h4 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <span>Offline / Local Storage Mode Active</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold uppercase">
                  Notice
                </span>
              </h4>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Data is currently stored safely in your browser. Connect to Supabase to enable multi-device Realtime synchronization.
              </p>
            </div>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition whitespace-nowrap"
            >
              Connect Supabase
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
          onOpenLetter={handleOpenLetter}
          onDeleteBooking={handleDeleteBooking}
          onToggleStatus={handleToggleStatus}
        />

      </main>

      {/* Official UP Police Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-semibold text-slate-200">
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
            <span className="text-slate-500">Vercel & Supabase Enabled</span>
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
    </div>
  );
}
