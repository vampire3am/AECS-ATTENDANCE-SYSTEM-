import { z } from 'zod';
export const uuid = z.uuid();
export const day = z.iso.date();
export const status = z.enum(['active', 'archived']);
export const attendance = z.enum(['present', 'absent', 'late', 'excused']);
const name = z.string().trim().min(2).max(150);
const optionalText = z.string().trim().max(2000).optional().default('');
const phone = z
  .string()
  .trim()
  .min(7)
  .max(25)
  .regex(/^[+\d\s()-]+$/);
export const studentInput = z.object({
  fullName: name,
  phone,
  email: z
    .union([z.email().max(254), z.literal('')])
    .optional()
    .default(''),
  joinedOn: day,
  notes: optionalText,
  status: status.default('active'),
});
export const courseInput = z.object({
  name,
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .transform((s) => s.toUpperCase()),
  description: optionalText,
  status: status.default('active'),
});
export const batchInput = z
  .object({
    name,
    code: z
      .string()
      .trim()
      .min(2)
      .max(30)
      .transform((s) => s.toUpperCase()),
    courseId: uuid,
    startDate: day,
    endDate: z
      .union([day, z.literal('')])
      .optional()
      .default(''),
    status: status.default('active'),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, 'End date must follow start date.');
export const teacherInput = z.object({
  fullName: name,
  email: z.email().transform((s) => s.toLowerCase()),
  phone: z
    .union([phone, z.literal('')])
    .optional()
    .default(''),
  password: z.string().min(14).max(256),
  status: status.default('active'),
});
export const teacherUpdate = teacherInput.omit({ password: true }).extend({
  password: z
    .union([z.string().min(14).max(256), z.literal('')])
    .optional()
    .default(''),
});
export const scheduleInput = z
  .object({
    batchId: uuid,
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    effectiveFrom: day,
    effectiveUntil: z
      .union([day, z.literal('')])
      .optional()
      .default(''),
    status: status.default('active'),
  })
  .refine((v) => v.endTime > v.startTime, 'End time must follow start time.')
  .refine(
    (v) => !v.effectiveUntil || v.effectiveUntil >= v.effectiveFrom,
    'Invalid schedule dates.',
  );
export const attendancePayload = z.object({
  sessionId: uuid,
  operationId: uuid,
  version: z.number().int().positive(),
  records: z
    .array(z.object({ studentId: uuid, status: attendance }))
    .min(1)
    .max(1000),
});
export const correctionInput = z.object({
  recordId: uuid,
  status: attendance,
  reason: z.string().trim().min(5).max(1000),
});
export const reason = z.string().trim().min(5).max(1000);
