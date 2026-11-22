import { describe, it, expect } from 'vitest';
import { parseClassroomQr } from '../lib/classroom-qr';
const origin = 'https://aecs-attendance.vercel.app';
const sessionId = crypto.randomUUID(),
  token = 'a'.repeat(64);
const valid = origin + '/check-in?session=' + sessionId + '&token=' + token;
describe('Classroom scanner URL validation', () => {
  it('accepts the common QR without a batch or student credential', () => {
    expect(parseClassroomQr(origin + '/check-in', origin)).toEqual({ common: true });
  });
  it('rejects batch selectors and ambiguous links', () => {
    expect(() => parseClassroomQr(valid + '&batch=' + crypto.randomUUID(), origin)).toThrow();
    expect(() =>
      parseClassroomQr(origin + '/check-in?batch=' + crypto.randomUUID(), origin),
    ).toThrow();
  });
  it('accepts an AECS classroom QR', () => {
    expect(parseClassroomQr(valid, origin)).toEqual({ sessionId, token });
  });
  it('rejects a foreign website', () => {
    expect(() => parseClassroomQr(valid.replace(origin, 'https://example.com'), origin)).toThrow();
  });
  it('rejects script URLs', () => {
    expect(() => parseClassroomQr('javascript:alert(1)', origin)).toThrow();
  });
  it('rejects a different app route', () => {
    expect(() => parseClassroomQr(valid.replace('/check-in?', '/login?'), origin)).toThrow();
  });
  it('rejects missing or malformed session tokens', () => {
    expect(() => parseClassroomQr(origin + '/check-in?session=' + sessionId, origin)).toThrow();
    expect(() => parseClassroomQr(valid.replace(token, 'invalid'), origin)).toThrow();
  });
  it('rejects QR text that is not a URL', () => {
    expect(() => parseClassroomQr('AECS-PRIVATE-ENROLLMENT-CODE', origin)).toThrow();
  });
});
