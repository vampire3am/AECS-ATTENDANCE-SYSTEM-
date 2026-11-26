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
    return tx
      .select({
        id: s.students.id,
        fullName: s.students.fullName,
        phone: s.students.phone,
        joinedOn: s.students.joinedOn,
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
          sql`not exists(select 1 from enrollments e where e.student_id=${s.students.id} and e.course_id=${batch.courseId} and (e.ended_on is null or e.ended_on>greatest(${startsOn}::date,${s.students.joinedOn})))`,
        ),
      )
      .orderBy(s.students.fullName, s.students.id)
      .limit(50);
  });
}
