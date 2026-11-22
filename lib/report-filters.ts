import { z } from 'zod';
export const reportFilterSchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    teacherId: z.uuid().optional(),
    studentId: z.uuid().optional(),
  })
  .refine((v) => !v.from || !v.to || v.to >= v.from, 'End date must follow start date.');
export function parseReportFilters(params: Record<string, string | string[] | undefined>) {
  return reportFilterSchema.parse(
    Object.fromEntries(Object.entries(params).filter(([, v]) => typeof v === 'string' && v !== '')),
  );
}
