import { describe, expect, it } from 'vitest';
import { attendancePercentage, isoWeekday, localDate } from '../lib/utils';
import { attendancePayload, scheduleInput } from '../lib/validations';
describe('Nepal scheduling and reporting', () => {
  it('uses the Nepal date around UTC midnight', () => {
    expect(localDate(new Date('2026-11-21T18:30:00Z'))).toBe('2026-11-22');
    expect(localDate(new Date('2026-11-21T18:14:00Z'))).toBe('2026-11-21');
  });
  it('uses ISO weekdays including Sunday', () => {
    expect(isoWeekday('2026-11-22')).toBe(7);
    expect(isoWeekday('2026-11-23')).toBe(1);
  });
  it('excludes excused and handles late policy and zero denominators', () => {
    expect(attendancePercentage(['present', 'absent', 'late', 'excused'])).toBe(66.67);
    expect(attendancePercentage(['present', 'absent', 'late', 'excused'], false)).toBe(33.33);
    expect(attendancePercentage(['excused', null])).toBeNull();
    expect(attendancePercentage([])).toBeNull();
  });
  it('rejects incomplete status payloads', () => {
    expect(attendancePayload.safeParse({}).success).toBe(false);
  });
  it('rejects reversed schedule times', () => {
    expect(
      scheduleInput.safeParse({
        batchId: crypto.randomUUID(),
        weekday: 1,
        startTime: '12:00',
        endTime: '10:00',
        effectiveFrom: '2026-11-22',
      }).success,
    ).toBe(false);
  });
});
