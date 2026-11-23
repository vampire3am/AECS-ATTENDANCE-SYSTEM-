import { cache } from 'react';
import { db, type Tx } from '@/lib/db';
import { batches, courses, profiles, teacherAssignments } from '@/lib/db/schema';
import { invariant } from '@/lib/errors';
import { and, eq, sql } from 'drizzle-orm';
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
      .where(
        and(
          eq(teacherAssignments.batchId, batchId),
          eq(teacherAssignments.teacherId, actor.id),
          eq(teacherAssignments.active, true),
        ),
      )
      .for('share');
    invariant(assignment, 'This batch is not assigned to you.', 403);
  }
  return batch;
}
