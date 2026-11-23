import {
  actorTransaction,
  requireBatch,
  teacherBatchScope,
  type Actor,
} from '@/lib/auth/permissions';
import { db, type Tx } from '@/lib/db';
import {
  attendanceRecords,
  auditLogs,
  batchSchedules,
  batches,
  classSessions,
  courses,
  enrollments,
  students,
} from '@/lib/db/schema';
import { invariant } from '@/lib/errors';
import { isoWeekday, localDate } from '@/lib/utils';
import { attendancePayload, correctionInput, reason, uuid } from '@/lib/validations';
import { and, eq, sql } from 'drizzle-orm';
export async function generateToday(actor: Actor) {
  const today = localDate();
  return actorTransaction(actor, async (tx) => {
    const query = await tx
      .select({ schedule: batchSchedules, batch: batches })
      .from(batchSchedules)
      .innerJoin(batches, eq(batches.id, batchSchedules.batchId))
      .where(
        and(
          eq(batchSchedules.weekday, isoWeekday(today)),
          eq(batchSchedules.status, 'active'),
          eq(batches.status, 'active'),
          sql`exists(select 1 from courses c where c.id=${batches.courseId} and c.status='active')`,
          sql`${batchSchedules.effectiveFrom}<=${today}::date and (${batchSchedules.effectiveUntil} is null or ${batchSchedules.effectiveUntil}>=${today}::date) and ${batches.startDate}<=${today}::date and (${batches.endDate} is null or ${batches.endDate}>=${today}::date)`,
          actor.role === 'teacher' ? teacherBatchScope(actor.id, batches.id) : undefined,
        ),
      );
    for (const { schedule, batch } of query) {
      await requireBatch(tx, actor, batch.id, true);
      await tx
        .insert(classSessions)
        .values({
          batchId: batch.id,
          scheduleId: schedule.id,
          sessionDate: today,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          createdBy: actor.id,
        })
        .onConflictDoNothing();
    }
    return today;
  });
}
export async function openSession(actor: Actor, id: string) {
  uuid.parse(id);
  return actorTransaction(actor, (tx) => openSessionInTransaction(tx, actor, id));
}
export async function openSessionInTransaction(tx: Tx, actor: Actor, id: string) {
  const [session] = await tx
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .for('update');
  invariant(session, 'Session not found.', 404);
  await requireBatch(tx, actor, session.batchId, true);
  invariant(session.sessionDate === localDate(), 'Only today’s sessions can be opened.', 409);
  invariant(session.status === 'scheduled' || session.status === 'open', 'Session is locked.', 409);
  if (session.status === 'scheduled') {
    await tx.update(classSessions).set({ status: 'open' }).where(eq(classSessions.id, id));
    await tx.execute(sql`select set_config('app.opening_roster','true',true)`);
    const roster = await tx
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.batchId, session.batchId),
          sql`${enrollments.enrolledOn}<=${session.sessionDate}::date and (${enrollments.endedOn} is null or ${enrollments.endedOn}>${session.sessionDate}::date)`,
        ),
      );
    if (roster.length)
      await tx
        .insert(attendanceRecords)
        .values(roster.map((r) => ({ sessionId: id, studentId: r.studentId })));
    await tx.update(classSessions).set({ rosterLocked: true }).where(eq(classSessions.id, id));
  }
  return { id };
}
export async function getSession(actor: Actor, id: string) {
  uuid.parse(id);
  return actorTransaction(actor, async (tx) => {
    const [session] = await tx
      .select({ session: classSessions, batch: batches })
      .from(classSessions)
      .innerJoin(batches, eq(batches.id, classSessions.batchId))
      .where(eq(classSessions.id, id));
    invariant(session, 'Session not found.', 404);
    await requireBatch(tx, actor, session.session.batchId);
    const records = await tx
      .select({
        id: attendanceRecords.id,
        studentId: students.id,
        fullName: students.fullName,
        studentCode: students.studentCode,
        status: attendanceRecords.status,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(students.id, attendanceRecords.studentId))
      .where(eq(attendanceRecords.sessionId, id))
      .orderBy(students.fullName);
    return { ...session, records };
  });
}
export async function saveAttendance(actor: Actor, raw: unknown, finalize: boolean) {
  const input = attendancePayload.parse(raw);
  return actorTransaction(actor, async (tx) => {
    const [session] = await tx
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, input.sessionId))
      .for('update');
    invariant(session, 'Session not found.', 404);
    await requireBatch(tx, actor, session.batchId, true);
    if (
      session.status === 'submitted' &&
      session.operationId === input.operationId &&
      session.submittedBy === actor.id
    )
      return { version: session.version, status: 'submitted' as const };
    invariant(session.status === 'open', 'Session is locked.', 409);
    invariant(
      session.version === input.version,
      'Attendance changed on another device. Review the server copy.',
      409,
    );
    const roster = await tx
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, session.id));
    const ids = new Set(input.records.map((r) => r.studentId));
    invariant(ids.size === input.records.length, 'Duplicate student records.');
    invariant(
      input.records.every((r) => roster.some((s) => s.studentId === r.studentId)),
      'Roster contains an unknown student.',
      409,
    );
    if (finalize)
      invariant(
        ids.size === roster.length && roster.length > 0,
        'Mark every student before submitting.',
      );
    const rosterIds = new Set(roster.map((r) => r.studentId));
    invariant(
      input.records.every((r) => rosterIds.has(r.studentId)),
      'Invalid roster.',
    );
    for (const row of input.records)
      await tx
        .update(attendanceRecords)
        .set({
          status: row.status,
          markedBy: actor.id,
          markedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendanceRecords.sessionId, session.id),
            eq(attendanceRecords.studentId, row.studentId),
          ),
        );
    const version = session.version + 1;
    await tx
      .update(classSessions)
      .set({
        version,
        ...(finalize
          ? {
              status: 'submitted' as const,
              submittedBy: actor.id,
              submittedAt: new Date(),
              operationId: input.operationId,
            }
          : {}),
      })
      .where(eq(classSessions.id, session.id));
    if (finalize)
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: 'attendance_submitted',
        entityType: 'class_session',
        entityId: session.id,
        metadata: { count: roster.length, operationId: input.operationId },
      });
    return { version, status: finalize ? ('submitted' as const) : ('open' as const) };
  });
}
export async function correctAttendance(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const input = correctionInput.parse(raw);
  return actorTransaction(actor, async (tx) => {
    const [record] = await tx
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, input.recordId));
    invariant(record, 'Record not found.', 404);
    const [session] = await tx
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, record.sessionId))
      .for('update');
    invariant(session.status === 'submitted', 'Only submitted attendance can be corrected.', 409);
    await tx.execute(sql`select set_config('app.reason',${input.reason},true)`);
    await tx
      .update(attendanceRecords)
      .set({
        status: input.status,
        markedBy: actor.id,
        markedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, record.id));
  });
}
export async function cancelSession(actor: Actor, id: string, note: string) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  uuid.parse(id);
  reason.parse(note);
  return actorTransaction(actor, async (tx) => {
    const [session] = await tx
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, id))
      .for('update');
    invariant(
      session && ['scheduled', 'open'].includes(session.status),
      'Only scheduled or open sessions can be cancelled.',
      409,
    );
    await tx.execute(sql`select set_config('app.reason',${note},true)`);
    await tx
      .update(classSessions)
      .set({ status: 'cancelled', notes: note })
      .where(eq(classSessions.id, id));
  });
}
export async function listSessions(
  actor: Actor,
  filters: {
    date?: string;
    batchId?: string;
    teacherId?: string;
    courseId?: string;
    status?: string;
  } = {},
) {
  return db
    .select({
      id: classSessions.id,
      batchId: batches.id,
      batchName: batches.name,
      courseName: courses.name,
      courseId: batches.courseId,
      date: classSessions.sessionDate,
      startTime: classSessions.startTime,
      endTime: classSessions.endTime,
      status: classSessions.status,
      submittedBy: classSessions.submittedBy,
      studentCount: sql<number>`(select count(*)::int from enrollments e where e.batch_id=${batches.id} and e.enrolled_on<=${classSessions.sessionDate} and (e.ended_on is null or e.ended_on>${classSessions.sessionDate}))`,
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(courses, eq(courses.id, batches.courseId))
    .where(
      and(
        filters.date ? eq(classSessions.sessionDate, filters.date) : undefined,
        filters.batchId ? eq(batches.id, filters.batchId) : undefined,
        filters.courseId ? eq(batches.courseId, filters.courseId) : undefined,
        filters.status ? sql`${classSessions.status}::text=${filters.status}` : undefined,
        actor.role === 'teacher' ? teacherBatchScope(actor.id, batches.id) : undefined,
        filters.teacherId ? teacherBatchScope(filters.teacherId, batches.id) : undefined,
      ),
    )
    .orderBy(sql`${classSessions.sessionDate} desc`, classSessions.startTime)
    .limit(200);
}
