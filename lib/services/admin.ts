import { actorTransaction, type Actor } from '@/lib/auth/permissions';
import * as s from '@/lib/db/schema';
import { invariant } from '@/lib/errors';
import { localDate } from '@/lib/utils';
import * as v from '@/lib/validations';
import { hash } from '@node-rs/argon2';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
export type Entity = 'students' | 'courses' | 'batches' | 'teachers' | 'schedules';
export async function saveEntity(actor: Actor, entity: Entity, raw: unknown, id?: string) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  if (id) v.uuid.parse(id);
  return actorTransaction(actor, async (tx) => {
    let result: { id: string }[] = [];
    switch (entity) {
      case 'students': {
        const p = v.studentInput.parse(raw);
        const values = { ...p, email: p.email?.toLowerCase() || null };
        result = id
          ? await tx
              .update(s.students)
              .set({ ...values, updatedAt: new Date() })
              .where(eq(s.students.id, id))
              .returning({ id: s.students.id })
          : await tx.insert(s.students).values(values).returning({ id: s.students.id });
        break;
      }
      case 'courses': {
        const p = v.courseInput.parse(raw);
        result = id
          ? await tx
              .update(s.courses)
              .set({ ...p, updatedAt: new Date() })
              .where(eq(s.courses.id, id))
              .returning({ id: s.courses.id })
          : await tx.insert(s.courses).values(p).returning({ id: s.courses.id });
        break;
      }
      case 'batches': {
        const p = v.batchInput.parse(raw);
        const [course] = await tx
          .select()
          .from(s.courses)
          .where(eq(s.courses.id, p.courseId))
          .for('share');
        invariant(course?.status === 'active', 'Choose an active course.');
        const values = { ...p, endDate: p.endDate || null };
        if (id) {
          const [old] = await tx.select().from(s.batches).where(eq(s.batches.id, id)).for('update');
          invariant(old, 'Batch not found.', 404);
          invariant(
            old.courseId === p.courseId,
            'A batch’s course cannot change. Create a new batch.',
          );
        }
        result = id
          ? await tx
              .update(s.batches)
              .set({ ...values, updatedAt: new Date() })
              .where(eq(s.batches.id, id))
              .returning({ id: s.batches.id })
          : await tx.insert(s.batches).values(values).returning({ id: s.batches.id });
        break;
      }
      case 'teachers': {
        const p = id ? v.teacherUpdate.parse(raw) : v.teacherInput.parse(raw);
        const { password, ...profile } = p;
        const passwordHash = password
          ? await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
          : undefined;
        if (id) {
          const [old] = await tx
            .select()
            .from(s.profiles)
            .where(and(eq(s.profiles.id, id), eq(s.profiles.role, 'teacher')))
            .for('update');
          invariant(old, 'Teacher not found.', 404);
          result = await tx
            .update(s.profiles)
            .set({
              ...profile,
              passwordHash,
              sessionVersion: old.sessionVersion + 1,
              updatedAt: new Date(),
            })
            .where(eq(s.profiles.id, id))
            .returning({ id: s.profiles.id });
        } else {
          invariant(passwordHash, 'A password is required.');
          result = await tx
            .insert(s.profiles)
            .values({ ...profile, passwordHash, role: 'teacher' })
            .returning({ id: s.profiles.id });
        }
        break;
      }
      case 'schedules': {
        const p = v.scheduleInput.parse(raw);
        const [batch] = await tx
          .select()
          .from(s.batches)
          .where(eq(s.batches.id, p.batchId))
          .for('update');
        invariant(batch?.status === 'active', 'Choose an active batch.');
        invariant(
          p.effectiveFrom >= batch.startDate &&
            (!batch.endDate || p.effectiveFrom <= batch.endDate),
          'Schedule must be within batch dates.',
        );
        const overlap = await tx
          .select({ id: s.batchSchedules.id })
          .from(s.batchSchedules)
          .where(
            and(
              eq(s.batchSchedules.batchId, p.batchId),
              eq(s.batchSchedules.weekday, p.weekday),
              eq(s.batchSchedules.status, 'active'),
              id ? sql`${s.batchSchedules.id}<>${id}::uuid` : undefined,
              sql`${s.batchSchedules.startTime}<${p.endTime}::time and ${s.batchSchedules.endTime}>${p.startTime}::time and daterange(${s.batchSchedules.effectiveFrom},${s.batchSchedules.effectiveUntil},'[]') && daterange(${p.effectiveFrom}::date,${p.effectiveUntil || null}::date,'[]')`,
            ),
          );
        invariant(
          p.status === 'archived' || !overlap.length,
          'This schedule overlaps an existing class.',
        );
        if (id) {
          const [old] = await tx.select().from(s.batchSchedules).where(eq(s.batchSchedules.id, id));
          invariant(old?.batchId === p.batchId, 'Schedule not found.', 404);
          invariant(
            p.status === 'archived' || p.effectiveFrom >= localDate(),
            'For past schedules, archive the old timetable and add a future timetable.',
          );
        }
        const values = { ...p, effectiveUntil: p.effectiveUntil || null };
        result = id
          ? await tx
              .update(s.batchSchedules)
              .set(values)
              .where(eq(s.batchSchedules.id, id))
              .returning({ id: s.batchSchedules.id })
          : await tx.insert(s.batchSchedules).values(values).returning({ id: s.batchSchedules.id });
        break;
      }
    }
    invariant(result[0], 'Record not found.', 404);
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: id ? 'record_updated' : 'record_created',
      entityType: entity,
      entityId: result[0].id,
      metadata: {},
    });
    return result[0];
  });
}
export async function enrollStudent(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const p = z.object({ studentId: v.uuid, batchId: v.uuid, enrolledOn: v.day }).parse(raw);
  return actorTransaction(actor, async (tx) => {
    const [student] = await tx
      .select()
      .from(s.students)
      .where(eq(s.students.id, p.studentId))
      .for('update');
    const [batch] = await tx
      .select()
      .from(s.batches)
      .where(eq(s.batches.id, p.batchId))
      .for('update');
    invariant(
      student?.status === 'active' && batch?.status === 'active',
      'Student and batch must be active.',
    );
    invariant(
      p.enrolledOn >= student.joinedOn &&
        p.enrolledOn >= batch.startDate &&
        (!batch.endDate || p.enrolledOn <= batch.endDate),
      'Enrollment date is outside student or batch dates.',
    );
    invariant(p.enrolledOn >= localDate(), 'New enrollments cannot be backdated.');
    const [row] = await tx
      .insert(s.enrollments)
      .values({ ...p, courseId: batch.courseId })
      .returning({ id: s.enrollments.id });
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'student_enrolled',
      entityType: 'enrollment',
      entityId: row.id,
      metadata: p,
    });
    return row;
  });
}
export async function transferStudent(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const p = z
    .object({ enrollmentId: v.uuid, batchId: v.uuid, effectiveOn: v.day, reason: v.reason })
    .parse(raw);
  return actorTransaction(actor, async (tx) => {
    const [old] = await tx
      .select()
      .from(s.enrollments)
      .where(eq(s.enrollments.id, p.enrollmentId))
      .for('update');
    invariant(old?.status === 'active', 'Active enrollment not found.');
    await tx.select().from(s.students).where(eq(s.students.id, old.studentId)).for('update');
    await tx
      .select()
      .from(s.batches)
      .where(sql`${s.batches.id} in (${old.batchId}::uuid,${p.batchId}::uuid)`)
      .orderBy(s.batches.id)
      .for('update');
    const [batch] = await tx.select().from(s.batches).where(eq(s.batches.id, p.batchId));
    invariant(
      batch?.status === 'active' && batch.courseId === old.courseId && batch.id !== old.batchId,
      'Choose a different active batch in the same course.',
    );
    invariant(
      p.effectiveOn >= localDate() &&
        p.effectiveOn >= old.enrolledOn &&
        p.effectiveOn >= batch.startDate &&
        (!batch.endDate || p.effectiveOn <= batch.endDate),
      'Invalid transfer date.',
    );
    const opened = await tx
      .select({ id: s.classSessions.id })
      .from(s.classSessions)
      .where(
        and(
          sql`${s.classSessions.batchId} in (${old.batchId}::uuid,${batch.id}::uuid)`,
          sql`${s.classSessions.sessionDate}>=${p.effectiveOn}::date`,
          sql`${s.classSessions.status} in ('open','submitted')`,
        ),
      );
    invariant(
      !opened.length,
      'Choose a date after already opened sessions to preserve rosters.',
      409,
    );
    await tx
      .update(s.enrollments)
      .set({ status: 'ended', endedOn: p.effectiveOn })
      .where(eq(s.enrollments.id, old.id));
    const [row] = await tx
      .insert(s.enrollments)
      .values({
        studentId: old.studentId,
        batchId: batch.id,
        courseId: old.courseId,
        enrolledOn: p.effectiveOn,
      })
      .returning({ id: s.enrollments.id });
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'enrollment_transferred',
      entityType: 'enrollment',
      entityId: row.id,
      reason: p.reason,
      metadata: {
        fromEnrollmentId: old.id,
        fromBatchId: old.batchId,
        toBatchId: batch.id,
        effectiveOn: p.effectiveOn,
      },
    });
    return row;
  });
}
export async function endEnrollment(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const p = z.object({ id: v.uuid, endedOn: v.day, reason: v.reason }).parse(raw);
  return actorTransaction(actor, async (tx) => {
    const [old] = await tx
      .select()
      .from(s.enrollments)
      .where(eq(s.enrollments.id, p.id))
      .for('update');
    invariant(
      old?.status === 'active' && p.endedOn >= localDate() && p.endedOn >= old.enrolledOn,
      'Invalid enrollment end date.',
    );
    await tx.select().from(s.batches).where(eq(s.batches.id, old.batchId)).for('update');
    const opened = await tx
      .select({ id: s.classSessions.id })
      .from(s.classSessions)
      .where(
        and(
          eq(s.classSessions.batchId, old.batchId),
          sql`${s.classSessions.sessionDate}>=${p.endedOn}::date`,
          sql`${s.classSessions.status} in ('open','submitted')`,
        ),
      );
    invariant(!opened.length, 'Choose a date after already opened sessions.', 409);
    await tx
      .update(s.enrollments)
      .set({ status: 'ended', endedOn: p.endedOn })
      .where(eq(s.enrollments.id, p.id));
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'enrollment_ended',
      entityType: 'enrollment',
      entityId: p.id,
      reason: p.reason,
      metadata: { endedOn: p.endedOn },
    });
  });
}
export async function assignTeacher(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const p = z.object({ teacherId: v.uuid, batchId: v.uuid, active: z.boolean() }).parse(raw);
  return actorTransaction(actor, async (tx) => {
    const [teacher] = await tx
      .select()
      .from(s.profiles)
      .where(eq(s.profiles.id, p.teacherId))
      .for('share');
    invariant(
      teacher?.role === 'teacher' && teacher.status === 'active',
      'Choose an active teacher.',
    );
    const [batch] = await tx
      .select()
      .from(s.batches)
      .where(eq(s.batches.id, p.batchId))
      .for('update');
    invariant(batch?.status === 'active', 'Choose an active batch.');
    if (p.active)
      await tx
        .insert(s.teacherAssignments)
        .values({ ...p })
        .onConflictDoNothing();
    else
      await tx
        .update(s.teacherAssignments)
        .set({ active: false })
        .where(
          and(
            eq(s.teacherAssignments.teacherId, p.teacherId),
            eq(s.teacherAssignments.batchId, p.batchId),
            eq(s.teacherAssignments.active, true),
          ),
        );
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: p.active ? 'teacher_assigned' : 'teacher_unassigned',
      entityType: 'batch',
      entityId: p.batchId,
      metadata: p,
    });
  });
}
export async function updateSettings(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const p = z
    .object({
      lateCountsAsPresent: z.boolean(),
      minimumAttendancePercentage: z.coerce.number().min(0).max(100),
    })
    .parse(raw);
  return actorTransaction(actor, async (tx) => {
    const [previous] = await tx.select().from(s.appSettings);
    await tx
      .update(s.appSettings)
      .set({
        ...p,
        minimumAttendancePercentage: String(p.minimumAttendancePercentage),
        updatedAt: new Date(),
      })
      .where(eq(s.appSettings.id, 1));
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'settings_updated',
      entityType: 'settings',
      metadata: { previous, next: p },
    });
  });
}
