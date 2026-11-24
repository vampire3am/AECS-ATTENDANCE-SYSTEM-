import { describe, expect, it } from 'vitest';
import { enrollmentWhatsAppUrl, whatsappPhone } from '../lib/enrollment-message';

describe('Enrollment WhatsApp sharing', () => {
  it('addresses Nepal mobile numbers and explicit international numbers safely', () => {
    expect(whatsappPhone('9801234567')).toBe('9779801234567');
    expect(whatsappPhone('+977 (980) 123-4567')).toBe('9779801234567');
    expect(whatsappPhone('00977 9801234567')).toBe('9779801234567');
    expect(whatsappPhone('+44 7700 900123')).toBe('447700900123');
    for (const phone of ['', '123', '9801234567 ext 12', '9801234567&text=other'])
      expect(whatsappPhone(phone)).toBeNull();
  });
  it('keeps the exact enrollment and message in one encoded text parameter', () => {
    const url = new URL(
      enrollmentWhatsAppUrl(
        'AECS-PRIVATE123',
        {
          studentName: 'A & B',
          phone: '9801234567',
          courseName: 'IELTS & German',
          batchName: 'Morning #1',
        },
        'https://aecs-attendance.vercel.app',
      ),
    );
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/9779801234567');
    expect([...url.searchParams.keys()]).toEqual(['text']);
    const message = url.searchParams.get('text');
    for (const part of [
      'Dear A & B,',
      'IELTS & German',
      'Morning #1',
      'AECS-PRIVATE123',
      'https://aecs-attendance.vercel.app/check-in',
      'teacher will confirm',
      'Keep this code private',
    ])
      expect(message).toContain(part);
    expect(url.hash).toBe('');
  });
  it('lets staff choose a recipient when the saved phone cannot be safely addressed', () => {
    const url = new URL(
      enrollmentWhatsAppUrl(
        'PRIVATE',
        { studentName: 'Student', phone: 'invalid', courseName: 'Course', batchName: 'Batch' },
        'https://aecs-attendance.vercel.app',
      ),
    );
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('text')).toContain('PRIVATE');
  });
});
