'use server';
import { requireActor } from '@/lib/auth/permissions';
import { AppError } from '@/lib/errors';
import * as admin from '@/lib/services/admin';
import * as attendance from '@/lib/services/attendance';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
async function run<T>(work: () => Promise<T>, refresh = true) {
  try {
    const data = await work();
    if (refresh) {
      revalidatePath('/admin', 'layout');
      revalidatePath('/teacher', 'layout');
    }
    return { ok: true as const, data };
  } catch (error) {
    if (error instanceof AppError)
      return { ok: false as const, error: error.message, status: error.status };
    if (error instanceof ZodError)
      return {
        ok: false as const,
        error: error.issues[0]?.message ?? 'Invalid input.',
        status: 400,
      };
    const cause = error as { code?: string; cause?: { code?: string } };
    if (cause.code === '23505' || cause.cause?.code === '23505')
      return {
        ok: false as const,
        error: 'A matching record already exists. Check codes, email and active enrollments.',
        status: 409,
      };
    console.error('Operation failed:', error instanceof Error ? error.name : 'Unknown error');
    return {
      ok: false as const,
      error: 'The operation could not be completed. Refresh and check the record before retrying.',
      status: 500,
    };
  }
}
export async function saveEntityAction(entity: admin.Entity, input: unknown, id?: string) {
  return run(async () => admin.saveEntity(await requireActor(true), entity, input, id));
}
export async function enrollAction(input: unknown) {
  return run(async () => admin.enrollStudent(await requireActor(true), input));
}
export async function transferAction(input: unknown) {
  return run(async () => admin.transferStudent(await requireActor(true), input));
}
export async function endEnrollmentAction(input: unknown) {
  return run(async () => admin.endEnrollment(await requireActor(true), input));
}
export async function assignAction(input: unknown) {
  return run(async () => admin.assignTeacher(await requireActor(true), input));
}
export async function settingsAction(input: unknown) {
  return run(async () => admin.updateSettings(await requireActor(true), input));
}
export async function generateAction() {
  return run(async () => attendance.generateToday(await requireActor()));
}
export async function openAction(id: string) {
  return run(async () => attendance.openSession(await requireActor(), id));
}
export async function attendanceAction(input: unknown, finalize: boolean) {
  return run(
    async () => attendance.saveAttendance(await requireActor(), input, finalize),
    finalize,
  );
}
export async function correctionAction(input: unknown) {
  return run(async () => attendance.correctAttendance(await requireActor(true), input));
}
export async function cancelAction(id: string, reason: string) {
  return run(async () => attendance.cancelSession(await requireActor(true), id, reason));
}
