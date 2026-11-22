import { hash } from '@node-rs/argon2';
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, pool } from '../lib/db';
import { auditLogs, profiles } from '../lib/db/schema';
const p = z
  .object({
    email: z.email().transform((v) => v.toLowerCase()),
    password: z.string().min(14).max(256),
    reason: z.string().trim().min(10),
  })
  .parse({
    email: process.env.RESET_EMAIL,
    password: process.env.RESET_PASSWORD,
    reason: process.env.RESET_REASON,
  });
try {
  await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.email, p.email))
      .for('update');
    if (!user) throw new Error('Staff account not found.');
    await tx
      .update(profiles)
      .set({
        passwordHash: await hash(p.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        sessionVersion: sql`${profiles.sessionVersion}+1`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, user.id));
    await tx
      .insert(auditLogs)
      .values({
        actorId: user.id,
        action: 'operator_password_reset',
        entityType: 'profile',
        entityId: user.id,
        reason: p.reason,
        metadata: { source: 'operator CLI' },
      });
  });
  console.log('Password reset; previous sessions revoked.');
} finally {
  await pool.end();
}
