export const SUITS = [
  { id: 'suit_1' as const, name: 'Suit 1', badgeColor: 'bg-blue-500' },
  { id: 'suit_2' as const, name: 'Suit 2', badgeColor: 'bg-cyan-500' },
  { id: 'suit_3' as const, name: 'Suit 3', badgeColor: 'bg-emerald-500' },
  { id: 'suit_4' as const, name: 'Suit 4', badgeColor: 'bg-amber-500' },
];

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

export const MEAL_STATUSES = ['PAID', 'COMPLIMENTARY', 'AS PER APPLICABLE', 'NOT REQUIRED', 'FREE', 'PENDING'] as const;
