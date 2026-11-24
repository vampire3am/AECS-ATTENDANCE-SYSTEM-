export type EnrollmentRecipient = {
  studentName: string;
  phone: string;
  courseName: string;
  batchName: string;
};

export function whatsappPhone(phone: string): string | null {
  const value = phone.trim().replace(/[\s().-]/g, '');
  if (/^9[78]\d{8}$/.test(value)) return '977' + value;
  if (/^9779[78]\d{8}$/.test(value)) return value;
  const international = value.startsWith('00') ? '+' + value.slice(2) : value;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international.slice(1) : null;
}

export function enrollmentWhatsAppUrl(
  code: string,
  recipient: EnrollmentRecipient,
  origin: string,
) {
  const message = [
    `Dear ${recipient.studentName},`,
    '',
    'Welcome to AECS! Here are your attendance check-in details:',
    `Course: ${recipient.courseName}`,
    `Batch: ${recipient.batchName}`,
    `Your private enrollment code: ${code}`,
    '',
    `Check in here: ${new URL('/check-in', origin).href}`,
    'When you arrive for class, open this link or scan the common AECS QR, then enter your code. Your teacher will confirm your presence.',
    '',
    'Keep this code private. It belongs only to your enrollment in this course and batch.',
    '— AECS',
  ].join('\n');
  const phone = whatsappPhone(recipient.phone);
  return `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(message)}`;
}
