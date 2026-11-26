import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  actorTransaction,
  requireBatch,
  teacherBatchScope,
  type Actor,
} from '@/lib/auth/permissions';
import * as s from '@/lib/db/schema';
import { localDate } from '@/lib/utils';
import { uuid } from '@/lib/validations';

export async function existingStudentOptions(actor: Actor, raw: unknown) {
  const { batchId, search } = z
    .object({ batchId: uuid, search: z.string().trim().max(150).default('') })
    .parse(raw);
  return actorTransaction(actor, async (tx) => {
    const batch = await requireBatch(tx, actor, batchId, true);
    const startsOn = batch.startDate > localDate() ? batch.startDate : localDate();
    // Keep correlated references qualified inside Drizzle single-table selections.
    const outerStudentId = sql`"students"."id"`;
    const outerJoinedOn = sql`"students"."joined_on"`;
    return tx
      .select({
        id: s.students.id,
        fullName: s.students.fullName,
        phone: s.students.phone,
        joinedOn: s.students.joinedOn,
        enrollmentState: sql<'available' | 'enrolled_here' | 'other_batch'>`case
          when exists(select 1 from enrollments e where e.student_id=${outerStudentId} and e.batch_id=${batchId} and (e.ended_on is null or e.ended_on>greatest(${startsOn}::date,${outerJoinedOn}))) then 'enrolled_here'
          when exists(select 1 from enrollments e where e.student_id=${outerStudentId} and e.course_id=${batch.courseId} and (e.ended_on is null or e.ended_on>greatest(${startsOn}::date,${outerJoinedOn}))) then 'other_batch'
          else 'available' end`,
        existingCode: sql<
          string | null
        >`(select e.checkin_code from enrollments e where e.student_id=${outerStudentId} and e.batch_id=${batchId} and (e.ended_on is null or e.ended_on>greatest(${startsOn}::date,${outerJoinedOn})) order by e.enrolled_on desc limit 1)`,
      })
      .from(s.students)
      .where(
        and(
          eq(s.students.status, 'active'),
          search
            ? or(
                ilike(s.students.fullName, `%${search}%`),
                ilike(s.students.studentCode, `%${search}%`),
                ilike(s.students.phone, `%${search}%`),
              )
            : undefined,
          actor.role === 'teacher'
            ? inArray(
                s.students.id,
                tx
                  .select({ studentId: s.enrollments.studentId })
                  .from(s.enrollments)
                  .where(teacherBatchScope(actor.id, s.enrollments.batchId)),
              )
            : undefined,
        ),
      )
      .orderBy(s.students.fullName, s.students.id)
      .limit(50);
  });
}
