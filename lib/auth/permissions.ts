import { cache } from 'react';
import { db, type Tx } from '@/lib/db';
import {
  batches,
  courses,
  profiles,
  teacherAssignments,
  teacherCourseAssignments,
  enrollments,
} from '@/lib/db/schema';
import { AppError, invariant } from '@/lib/errors';
import { redirect } from 'next/navigation';
import { and, eq, sql, type SQLWrapper } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from './options';
export type Actor = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'teacher';
  sessionVersion: number;
};
// The same intersection policy is used for lists, reports and direct object access.
export const teacherBatchScope = (teacherId: string, batchColumn: SQLWrapper) => sql`exists(
  select 1 from teacher_assignments scoped_a
  join batches scoped_b on scoped_b.id=scoped_a.batch_id
  join teacher_course_assignments scoped_g on scoped_g.teacher_id=scoped_a.teacher_id and scoped_g.course_id=scoped_b.course_id and scoped_g.active
  where scoped_a.teacher_id=${teacherId} and scoped_a.batch_id=${batchColumn} and scoped_a.active
)`;
const currentActor = cache(async (): Promise<Actor> => {
  const session = await getServerSession(authOptions);
  invariant(session?.user?.id, 'Please sign in.', 401);
  const [user] = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      phone: profiles.phone,
      role: profiles.role,
      sessionVersion: profiles.sessionVersion,
    })
    .from(profiles)
    .where(and(eq(profiles.id, session.user.id), eq(profiles.status, 'active')))
    .limit(1);
  invariant(
    user && user.sessionVersion === session.user.sessionVersion,
    'Your session has expired.',
    401,
  );
  return user;
});
export async function requireActor(admin = false): Promise<Actor> {
  const user = await currentActor();
  invariant(!admin || user.role === 'super_admin', 'Administrator access required.', 403);
  return user;
}
export async function requirePageActor(admin = false): Promise<Actor> {
  try {
    return await requireActor(admin);
  } catch (error) {
    if (error instanceof AppError && error.status === 401)
      redirect(error.message === 'Please sign in.' ? '/login' : '/login?reason=access-changed');
    if (error instanceof AppError && error.status === 403) redirect('/teacher');
    throw error;
  }
}
export async function actorTransaction<T>(actor: Actor, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.id, actor.id))
      .for('share');
    invariant(
      current?.status === 'active' &&
        current.sessionVersion === actor.sessionVersion &&
        current.role === actor.role,
      'Account permissions changed. Sign in again.',
      401,
    );
    await tx.execute(sql`select set_config('app.actor_id',${actor.id},true)`);
    return work(tx);
  });
}
export async function requireBatch(tx: Tx, actor: Actor, batchId: string, active = false) {
  const [batch] = await tx
    .select({
      id: batches.id,
      courseId: batches.courseId,
      status: batches.status,
      courseStatus: courses.status,
      startDate: batches.startDate,
      endDate: batches.endDate,
    })
    .from(batches)
    .innerJoin(courses, eq(courses.id, batches.courseId))
    .where(eq(batches.id, batchId))
    .for('share');
  invariant(batch, 'Batch not found.', 404);
  if (active)
    invariant(
      batch.status === 'active' && batch.courseStatus === 'active',
      'The batch or course is archived.',
      409,
    );
  if (actor.role !== 'super_admin') {
    const [assignment] = await tx
      .select()
      .from(teacherAssignments)
      .innerJoin(
        teacherCourseAssignments,
        and(
          eq(teacherCourseAssignments.teacherId, actor.id),
          eq(teacherCourseAssignments.courseId, batch.courseId),
          eq(teacherCourseAssignments.active, true),
        ),
      )
      .where(
        and(
          eq(teacherAssignments.batchId, batchId),
          eq(teacherAssignments.teacherId, actor.id),
          eq(teacherAssignments.active, true),
        ),
      )
      .for('share');
    invariant(assignment, 'Course or batch access has been removed. Contact your admin.', 403);
  }
  return batch;
}
export async function requireCourse(tx: Tx, actor: Actor, courseId: string) {
  const [course] = await tx
    .select({ id: courses.id, status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .for('share');
  invariant(course?.status === 'active', 'Choose an active course.', 409);
  if (actor.role !== 'super_admin') {
    const [grant] = await tx
      .select({ id: teacherCourseAssignments.id })
      .from(teacherCourseAssignments)
      .where(
        and(
          eq(teacherCourseAssignments.teacherId, actor.id),
          eq(teacherCourseAssignments.courseId, courseId),
          eq(teacherCourseAssignments.active, true),
        ),
      )
      .for('share');
    invariant(grant, 'Your admin has not granted access to create batches in this course.', 403);
  }
  return course;
}
export async function requireVisibleStudent(tx: Tx, actor: Actor, studentId: string) {
  if (actor.role === 'super_admin') return;
  const [row] = await tx
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.studentId, studentId), teacherBatchScope(actor.id, enrollments.batchId)),
    )
    .limit(1)
    .for('share');
  invariant(row, 'This student is not in your assigned batches.', 403);
}
