import { describe, it, expect } from 'vitest';
import { enrollmentCodeInput } from '../lib/enrollment-code-input';
describe('Enrollment-code guidance', () => {
  it.each(['AECS000001', 'AECS-000001'])('explains why %s is not a check-in credential', (code) => {
    const result = enrollmentCodeInput.safeParse({ code });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('student ID');
  });
  it('normalizes a copied private enrollment code', () => {
    expect(enrollmentCodeInput.parse({ code: ' aecs-abcdef1234567890abcd ' }).code).toBe(
      'AECS-ABCDEF1234567890ABCD',
    );
  });
  it('accepts a valid entirely numeric 20-character private code', () => {
    expect(enrollmentCodeInput.safeParse({ code: 'AECS-12345678901234567890' }).success).toBe(true);
  });
});
