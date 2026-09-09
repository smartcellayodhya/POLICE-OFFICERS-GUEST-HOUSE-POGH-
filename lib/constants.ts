export const SUITS = [
  { id: 'suit_1' as const, name: 'Suit 1', rate: 800, badgeColor: 'bg-blue-500' },
  { id: 'suit_2' as const, name: 'Suit 2', rate: 800, badgeColor: 'bg-cyan-500' },
  { id: 'suit_3' as const, name: 'Suit 3', rate: 1200, badgeColor: 'bg-emerald-500' },
  { id: 'suit_4' as const, name: 'Suit 4', rate: 1200, badgeColor: 'bg-amber-500' },
];

export const DEFAULT_RATES = {
  suit_1: 800,
  suit_2: 800,
  suit_3: 1200,
  suit_4: 1200,
};

export const REFERENCES = [
  'SSP SIR',
  'DIG SIR',
  'IG SIR',
  'ADG SIR',
  'SP CITY',
  'SP RURAL',
  'CO SIR',
  'DIRECT / SELF',
  'OTHER',
];

export const MEAL_STATUSES = ['PAID', 'FREE', 'PENDING', 'NONE'] as const;

export const INITIAL_DEMO_BOOKINGS = [
  {
    id: 'demo-1',
    booking_date: '2026-08-05',
    guest_name: 'राहुल यादव',
    mobile_number: '9411616767',
    reference: 'SSP SIR',
    suit_1: 800,
    suit_2: 800,
    suit_3: 0,
    suit_4: 0,
    total_amount: 1600,
    meal_type_status: 'PAID',
    status: 'CONFIRMED',
    notes: 'Official guest stay',
    created_at: new Date('2026-08-05T10:00:00Z').toISOString(),
  },
  {
    id: 'demo-2',
    booking_date: '2026-08-13',
    guest_name: 'ashwani',
    mobile_number: '8090467395',
    reference: 'SSP SIR',
    suit_1: 0,
    suit_2: 800,
    suit_3: 1200,
    suit_4: 0,
    total_amount: 2000,
    meal_type_status: 'PAID',
    status: 'CONFIRMED',
    notes: '',
    created_at: new Date('2026-08-13T12:30:00Z').toISOString(),
  },
];
