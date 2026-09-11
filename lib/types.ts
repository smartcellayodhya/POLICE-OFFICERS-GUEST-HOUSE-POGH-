export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | string;

export interface Booking {
  id: string;
  group_id?: string;
  dispatch_no?: string;
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
  status: BookingStatus;
  check_in_time?: string;
  check_out_time?: string;
  is_maintenance?: boolean;
  notes?: string;
  created_at?: string;
}

export interface ReceiptDetails {
  receipt_no: string;
  booking_ref_no: string;
  guest_name: string;
  mobile_number: string;
  reference: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time: string;
  check_out_time: string;
  total_days: number;
  suits: string[];
  rent_per_day: number;
  total_amount: number;
  meal_type_status: string;
  payment_mode: string;
  remarks?: string;
  incharge_name?: string;
}

export type SuitKey = 'suit_1' | 'suit_2' | 'suit_3' | 'suit_4';

export interface RoomOccupancy {
  date: string;
  displayDate: string;
  suit_1: Booking | null;
  suit_2: Booking | null;
  suit_3: Booking | null;
  suit_4: Booking | null;
}

export interface LetterDetails {
  guest_name: string;
  mobile_number: string;
  reference: string;
  booking_ref_no?: string;
  dispatch_no?: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time?: string;
  check_out_time?: string;
  suits: string[];
  total_days: number;
  total_amount: number;
  meal_type_status: string;
  contact_person?: string;
  dates: string[];
}
