import { and, eq, sql } from 'drizzle-orm';
import { actorTransaction, requireBatch, type Actor } from '@/lib/auth/permissions';
import * as s from '@/lib/db/schema';
import { uuid } from '@/lib/validations';
import { localDate } from '@/lib/utils';

export async function teacherStudents(actor: Actor, batchId?: string) {
  if (batchId) uuid.parse(batchId);
  return actorTransaction(actor, async (tx) => {
    if (batchId) await requireBatch(tx, actor, batchId);
    return tx
      .select({
        id: s.enrollments.id,
        studentId: s.students.id,
        fullName: s.students.fullName,
        studentCode: s.students.studentCode,
        phone: s.students.phone,
        email: s.students.email,
        batchId: s.batches.id,
        batchName: s.batches.name,
        courseName: s.courses.name,
        code: s.enrollments.checkinCode,
        enrolledOn: s.enrollments.enrolledOn,
        endedOn: s.enrollments.endedOn,
      })
      .from(s.enrollments)
      .innerJoin(s.students, eq(s.students.id, s.enrollments.studentId))
      .innerJoin(s.batches, eq(s.batches.id, s.enrollments.batchId))
      .innerJoin(s.courses, eq(s.courses.id, s.batches.courseId))
      .where(
        and(
          batchId ? eq(s.batches.id, batchId) : undefined,
          actor.role === 'teacher'
            ? sql`exists(select 1 from teacher_assignments a where a.batch_id=${s.batches.id} and a.teacher_id=${actor.id} and a.active)`
            : undefined,
          sql`(${s.enrollments.endedOn} is null or ${s.enrollments.endedOn}>${localDate()}::date)`,
        ),
      )
      .orderBy(s.students.fullName, s.batches.name)
      .limit(1000);
  });
}
export async function teacherBatch(actor: Actor, batchId: string) {
  uuid.parse(batchId);
  return actorTransaction(actor, async (tx) => {
    await requireBatch(tx, actor, batchId);
    const [batch] = await tx
      .select({
        id: s.batches.id,
        name: s.batches.name,
        code: s.batches.code,
        courseId: s.batches.courseId,
        courseName: s.courses.name,
        startDate: s.batches.startDate,
        endDate: s.batches.endDate,
        status: s.batches.status,
      })
      .from(s.batches)
      .innerJoin(s.courses, eq(s.courses.id, s.batches.courseId))
      .where(eq(s.batches.id, batchId));
    const schedules = await tx
      .select()
      .from(s.batchSchedules)
      .where(eq(s.batchSchedules.batchId, batchId))
      .orderBy(s.batchSchedules.weekday, s.batchSchedules.startTime);
    return { batch, schedules };
  });
}
