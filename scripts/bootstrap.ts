import { hash } from '@node-rs/argon2';
import 'dotenv/config';
import { z } from 'zod';
import { db, pool } from '../lib/db';
import { auditLogs, profiles } from '../lib/db/schema';
const input = z
  .object({
    email: z.email().transform((v) => v.toLowerCase()),
    name: z.string().min(2),
    password: z.string().min(14).max(256),
  })
  .parse({
    email: process.env.BOOTSTRAP_EMAIL,
    name: process.env.BOOTSTRAP_NAME,
    password: process.env.BOOTSTRAP_PASSWORD,
  });
try {
  await db.transaction(async (tx) => {
    await tx.execute((await import('drizzle-orm')).sql`select pg_advisory_xact_lock(197731)`);
    if ((await tx.select({ id: profiles.id }).from(profiles).limit(1)).length)
      throw new Error('Bootstrap is allowed only before the first staff account exists.');
    const [admin] = await tx
      .insert(profiles)
      .values({
        email: input.email,
        fullName: input.name,
        passwordHash: await hash(input.password, {
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
        role: 'super_admin',
      })
      .returning({ id: profiles.id });
    await tx
      .insert(auditLogs)
      .values({
        actorId: admin.id,
        action: 'initial_admin_created',
        entityType: 'profile',
        entityId: admin.id,
        reason: 'First-time CLI bootstrap',
      });
  });
  console.log('Initial administrator created.');
} finally {
  await pool.end();
}
