export interface Booking {
  id: string;
  booking_date: string; // 'YYYY-MM-DD'
  guest_name: string;
  mobile_number: string;
  reference: string;
  suit_1: number;
  suit_2: number;
  suit_3: number;
  suit_4: number;
  total_amount: number;
  meal_type_status: 'PAID' | 'FREE' | 'PENDING' | string;
  status: 'CONFIRMED' | 'CANCELLED' | string;
  notes?: string;
  created_at?: string;
}

export type SuitKey = 'suit_1' | 'suit_2' | 'suit_3' | 'suit_4';

export interface RoomOccupancy {
  date: string; // 'YYYY-MM-DD'
  displayDate: string; // 'DD-MMM-YYYY'
  suit_1: Booking | null;
  suit_2: Booking | null;
  suit_3: Booking | null;
  suit_4: Booking | null;
}

export interface LetterDetails {
  guest_name: string;
  mobile_number: string;
  reference: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time?: string;
  check_out_time?: string;
  suits: string[];
  total_days: number;
  total_amount: number;
  meal_type_status: string;
  dates: string[];
}
