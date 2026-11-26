import { enrollmentCodeInput } from '@/lib/enrollment-code-input';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { actorTransaction, requireBatch, type Actor } from '@/lib/auth/permissions';
import { invariant } from '@/lib/errors';
import { localDate } from '@/lib/utils';
import { uuid } from '@/lib/validations';
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function verifyEnrollmentCode(raw: unknown) {
  const { code } = enrollmentCodeInput.parse(raw);
  const today = localDate();
  const [enrollment] = await db
    .select({
      studentName: s.students.fullName,
      studentCode: s.students.studentCode,
      courseName: s.courses.name,
      batchName: s.batches.name,
      batchCode: s.batches.code,
      enrolledOn: s.enrollments.enrolledOn,
      batchStartsOn: s.batches.startDate,
    })
    .from(s.enrollments)
    .innerJoin(s.students, eq(s.students.id, s.enrollments.studentId))
    .innerJoin(s.batches, eq(s.batches.id, s.enrollments.batchId))
    .innerJoin(s.courses, eq(s.courses.id, s.enrollments.courseId))
    .where(
      and(
        eq(s.enrollments.checkinCode, code),
        eq(s.students.status, 'active'),
        eq(s.batches.status, 'active'),
        eq(s.courses.status, 'active'),
        sql`(${s.enrollments.endedOn} is null or ${s.enrollments.endedOn}>${today}::date) and (${s.batches.endDate} is null or ${s.batches.endDate}>=${today}::date)`,
      ),
    )
    .limit(1);
  invariant(enrollment, 'This enrollment code is invalid or is not currently active.', 400);
  const { enrolledOn, batchStartsOn, ...identity } = enrollment;
  const startsOn = enrolledOn > batchStartsOn ? enrolledOn : batchStartsOn;
  return { ...identity, startsOn, canCheckIn: startsOn <= today };
}
export async function startCheckin(actor: Actor, id: string) {
  uuid.parse(id);
  return actorTransaction(actor, async (tx) => {
    const [session] = await tx
      .select()
      .from(s.classSessions)
      .where(eq(s.classSessions.id, id))
      .for('update');
    invariant(session, 'Class not found.', 404);
    await requireBatch(tx, actor, session.batchId, true);
    invariant(
      session.status === 'open' && session.sessionDate === localDate(),
      'Open today’s class before displaying its QR code.',
      409,
    );
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 120000);
    await tx
      .insert(s.checkinWindows)
      .values({ sessionId: id, tokenHash: digest(token), expiresAt, openedBy: actor.id })
      .onConflictDoUpdate({
        target: s.checkinWindows.sessionId,
        set: { tokenHash: digest(token), expiresAt, openedBy: actor.id },
      });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
    invariant(base, 'Application URL is not configured.', 500);
    const url = new URL('/check-in', base);
    url.searchParams.set('session', id);
    url.searchParams.set('token', token);
    return { url: url.toString(), expiresAt: expiresAt.toISOString() };
  });
}
export async function submitStudentCheckin(raw: unknown) {
  const input = z
    .union([
      z.object({ code: enrollmentCodeInput.shape.code }).strict(),
      z
        .object({
          sessionId: uuid,
          token: tokenSchema,
          code: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^AECS-[A-F0-9]{20}$/),
        })
        .strict(),
    ])
    .parse(raw);
  return db.transaction(async (tx) => {
    let sessionId: string;
    if (!('sessionId' in input)) {
      const [enrollment] = await tx
        .select({
          batchId: s.enrollments.batchId,
          enrolledOn: s.enrollments.enrolledOn,
          batchStartsOn: s.batches.startDate,
        })
        .from(s.enrollments)
        .innerJoin(s.students, eq(s.students.id, s.enrollments.studentId))
        .innerJoin(s.batches, eq(s.batches.id, s.enrollments.batchId))
        .innerJoin(s.courses, eq(s.courses.id, s.enrollments.courseId))
        .where(
          and(
            eq(s.enrollments.checkinCode, input.code),
            eq(s.students.status, 'active'),
            eq(s.batches.status, 'active'),
            eq(s.courses.status, 'active'),
            sql`(${s.enrollments.endedOn} is null or ${s.enrollments.endedOn}>${localDate()}::date) and (${s.batches.endDate} is null or ${s.batches.endDate}>=${localDate()}::date)`,
          ),
        )
        .limit(1);
      invariant(enrollment, 'This enrollment code is invalid or is not currently active.', 400);
      const startsOn =
        enrollment.enrolledOn > enrollment.batchStartsOn
          ? enrollment.enrolledOn
          : enrollment.batchStartsOn;
      invariant(
        startsOn <= localDate(),
        `Your enrollment is verified. Attendance opens from ${startsOn} (Nepal time).`,
        409,
      );
      const sessions = await tx
        .select({ id: s.classSessions.id })
        .from(s.classSessions)
        .where(
          and(
            eq(s.classSessions.batchId, enrollment.batchId),
            eq(s.classSessions.sessionDate, localDate()),
            eq(s.classSessions.status, 'open'),
          ),
        )
        .limit(2);
      invariant(
        sessions.length > 0,
        'Your teacher has not opened attendance for this batch today. Ask them to open the class, then try again.',
        409,
      );
      invariant(
        sessions.length === 1,
        'More than one class is open for this batch. Ask your teacher to finalize the previous class, then try again.',
        409,
      );
      sessionId = sessions[0].id;
    } else sessionId = input.sessionId;
    const [session] = await tx
      .select()
      .from(s.classSessions)
      .where(eq(s.classSessions.id, sessionId))
      .for('update');
    invariant(
      session?.status === 'open' && session.sessionDate === localDate(),
      'This class is no longer accepting check-ins.',
      409,
    );
    if ('token' in input) {
      const [window] = await tx
        .select()
        .from(s.checkinWindows)
        .where(eq(s.checkinWindows.sessionId, session.id));
      invariant(
        window && window.expiresAt.getTime() > Date.now(),
        'The classroom QR has expired. Scan the current code.',
        410,
      );
      invariant(
        timingSafeEqual(
          Buffer.from(window.tokenHash, 'hex'),
          Buffer.from(digest(input.token), 'hex'),
        ),
        'The classroom QR has changed. Scan the current code.',
        410,
      );
    }
    const [enrollment] = await tx
      .select({ id: s.enrollments.id, studentId: s.enrollments.studentId })
      .from(s.enrollments)
      .innerJoin(s.students, eq(s.students.id, s.enrollments.studentId))
      .innerJoin(s.batches, eq(s.batches.id, s.enrollments.batchId))
      .innerJoin(s.courses, eq(s.courses.id, s.batches.courseId))
      .where(
        and(
          eq(s.enrollments.checkinCode, input.code),
          eq(s.enrollments.batchId, session.batchId),
          eq(s.students.status, 'active'),
          eq(s.batches.status, 'active'),
          eq(s.courses.status, 'active'),
          sql`${s.enrollments.enrolledOn}<=${session.sessionDate}::date and (${s.enrollments.endedOn} is null or ${s.enrollments.endedOn}>${session.sessionDate}::date)`,
        ),
      )
      .for('share');
    invariant(enrollment, 'This enrollment code is not eligible for this class.', 400);
    const [record] = await tx
      .select({ id: s.attendanceRecords.id })
      .from(s.attendanceRecords)
      .where(
        and(
          eq(s.attendanceRecords.sessionId, session.id),
          eq(s.attendanceRecords.studentId, enrollment.studentId),
        ),
      );
    invariant(record, 'You are not on this class roster. Please speak with your teacher.', 409);
    await tx
      .insert(s.studentCheckins)
      .values({
        sessionId: session.id,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
      })
      .onConflictDoNothing();
    return {
      message:
        'Check-in received. Your teacher will verify your presence before finalizing attendance.',
    };
  });
}
export async function listCheckins(actor: Actor, id: string) {
  uuid.parse(id);
  return actorTransaction(actor, async (tx) => {
    const [session] = await tx.select().from(s.classSessions).where(eq(s.classSessions.id, id));
    invariant(session, 'Class not found.', 404);
    await requireBatch(tx, actor, session.batchId);
    return tx
      .select({
        id: s.studentCheckins.id,
        fullName: s.students.fullName,
        studentCode: s.students.studentCode,
        checkedInAt: s.studentCheckins.checkedInAt,
        verifiedAt: s.studentCheckins.verifiedAt,
      })
      .from(s.studentCheckins)
      .innerJoin(s.students, eq(s.students.id, s.studentCheckins.studentId))
      .where(eq(s.studentCheckins.sessionId, id))
      .orderBy(s.studentCheckins.checkedInAt)
      .limit(1000);
  });
}
export async function verifyCheckin(actor: Actor, id: string) {
  uuid.parse(id);
  return actorTransaction(actor, async (tx) => {
    const [checkin] = await tx.select().from(s.studentCheckins).where(eq(s.studentCheckins.id, id));
    invariant(checkin, 'Check-in not found.', 404);
    const [session] = await tx
      .select()
      .from(s.classSessions)
      .where(eq(s.classSessions.id, checkin.sessionId))
      .for('update');
    invariant(session?.status === 'open', 'Attendance is already locked.', 409);
    await requireBatch(tx, actor, session.batchId, true);
    const [current] = await tx
      .select()
      .from(s.studentCheckins)
      .where(eq(s.studentCheckins.id, id))
      .for('update');
    if (current.verifiedAt) return { verified: true };
    await tx
      .update(s.attendanceRecords)
      .set({ status: 'present', markedBy: actor.id, markedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(s.attendanceRecords.sessionId, session.id),
          eq(s.attendanceRecords.studentId, checkin.studentId),
        ),
      );
    await tx
      .update(s.studentCheckins)
      .set({ verifiedBy: actor.id, verifiedAt: new Date() })
      .where(eq(s.studentCheckins.id, id));
    await tx
      .update(s.classSessions)
      .set({ version: session.version + 1 })
      .where(eq(s.classSessions.id, session.id));
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'student_checkin_verified',
      entityType: 'class_session',
      entityId: session.id,
      metadata: { studentId: checkin.studentId, checkinId: id },
    });
    return { verified: true };
  });
}
