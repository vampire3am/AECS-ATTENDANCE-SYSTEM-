import { actorTransaction, teacherBatchScope, type Actor } from '@/lib/auth/permissions';
import * as s from '@/lib/db/schema';
export async function accessState(actor: Actor) {
  return actorTransaction(actor, async (tx) => {
    const rows = await tx
      .select({ id: s.batches.id })
      .from(s.batches)
      .where(actor.role === 'teacher' ? teacherBatchScope(actor.id, s.batches.id) : undefined);
    return {
      actorId: actor.id,
      sessionVersion: actor.sessionVersion,
      batchIds: rows.map((r) => r.id).sort(),
    };
  });
}
