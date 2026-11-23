import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { actorTransaction, type Actor } from '@/lib/auth/permissions';
import * as s from '@/lib/db/schema';
import { invariant } from '@/lib/errors';
import { uuid } from '@/lib/validations';

export async function setTeacherCourses(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const input = z.object({ teacherId: uuid, courseIds: z.array(uuid).max(100) }).parse(raw);
  const courseIds = [...new Set(input.courseIds)];
  return actorTransaction(actor, async (tx) => {
    const [teacher] = await tx
      .select({ id: s.profiles.id })
      .from(s.profiles)
      .where(and(eq(s.profiles.id, input.teacherId), eq(s.profiles.role, 'teacher')))
      .for('update');
    invariant(teacher, 'Teacher not found.', 404);
    if (courseIds.length) {
      const courses = await tx
        .select({ id: s.courses.id })
        .from(s.courses)
        .where(and(inArray(s.courses.id, courseIds), eq(s.courses.status, 'active')))
        .for('share');
      invariant(courses.length === courseIds.length, 'Choose active courses only.');
    }
    await tx
      .update(s.teacherCourseAssignments)
      .set({ active: false })
      .where(
        and(
          eq(s.teacherCourseAssignments.teacherId, input.teacherId),
          eq(s.teacherCourseAssignments.active, true),
          courseIds.length ? notInArray(s.teacherCourseAssignments.courseId, courseIds) : undefined,
        ),
      );
    for (const courseId of courseIds)
      await tx
        .insert(s.teacherCourseAssignments)
        .values({ teacherId: input.teacherId, courseId })
        .onConflictDoUpdate({
          target: [s.teacherCourseAssignments.teacherId, s.teacherCourseAssignments.courseId],
          set: { active: true, assignedAt: new Date() },
        });
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'teacher_course_access_updated',
      entityType: 'profile',
      entityId: input.teacherId,
      metadata: { courseIds },
    });
    return { updated: true };
  });
}
