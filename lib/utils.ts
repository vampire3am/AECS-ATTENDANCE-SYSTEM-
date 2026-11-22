import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function isoWeekday(day: string) {
  const n = new Date(day + 'T00:00:00Z').getUTCDay();
  return n === 0 ? 7 : n;
}
export function attendancePercentage(statuses: (string | null)[], lateCounts = true) {
  const eligible = statuses.filter((s) => s && s !== 'excused');
  return eligible.length
    ? Math.round(
        (10000 * eligible.filter((s) => s === 'present' || (lateCounts && s === 'late')).length) /
          eligible.length,
      ) / 100
    : null;
}
