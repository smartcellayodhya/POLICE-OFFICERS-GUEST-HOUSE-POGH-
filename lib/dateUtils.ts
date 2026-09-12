const HINDI_MONTHS: Record<number, string> = {
  0: 'जनवरी',
  1: 'फरवरी',
  2: 'मार्च',
  3: 'अप्रैल',
  4: 'मई',
  5: 'जून',
  6: 'जुलाई',
  7: 'अगस्त',
  8: 'सितंबर',
  9: 'अक्टूबर',
  10: 'नवंबर',
  11: 'दिसंबर',
};

const ENGLISH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatToDisplayDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : '')) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = ENGLISH_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatToHindiDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : '')) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = HINDI_MONTHS[d.getMonth()] || '';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatToISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [startDateStr];

  const current = new Date(start);
  while (current <= end) {
    dates.push(formatToISODate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Calculates actual stay nights.
 * E.g. Check-in: 12.09.2026 (12 PM), Check-out: 13.09.2026 (12 PM) = 1 Night / 1 Day.
 * Same day (12th to 12th) = 1 Day.
 */
export function calculateStayNights(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;
  if (startDateStr === endDateStr) return 1;
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diffDays > 0 ? diffDays : 1;
}

/**
 * Returns the exact list of stay dates occupied overnight.
 * For check-in on 12th and check-out on 13th, only the night of 12th is occupied (checkout is at noon on 13th).
 * For same day (12th to 12th), returns ['2026-09-12'].
 */
export function getStayDates(startDateStr: string, endDateStr: string): string[] {
  if (!startDateStr) return [];
  if (!endDateStr || startDateStr === endDateStr) return [startDateStr];
  
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [startDateStr];

  const dates: string[] = [];
  const current = new Date(start);
  while (current < end) {
    dates.push(formatToISODate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates.length > 0 ? dates : [startDateStr];
}

