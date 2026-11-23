import { db } from '@/lib/db';
import { auditLogs, profiles } from '@/lib/db/schema';
import { hash, verify } from '@node-rs/argon2';
import { eq, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(256),
});
const dummy = hash('not-a-real-account-password', {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export async function authenticateStaff(
  credentials: unknown,
  request?: { headers?: Record<string, string | undefined> },
) {
  const input = credentialsSchema.safeParse(credentials);
  if (!input.success) return null;
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is required');
  const ip = request?.headers?.['x-forwarded-for']?.split(',')[0]?.trim();
  if (ip) {
    const networkKey =
      'staff-ip:' + createHmac('sha256', process.env.AUTH_SECRET).update(ip).digest('hex');
    const network = await db.execute<{ attempts: number }>(
      sql`insert into login_attempts(key,attempts,window_start) values(${networkKey},1,now()) on conflict(key) do update set attempts=case when login_attempts.window_start<now()-interval '15 minutes' then 1 else login_attempts.attempts+1 end,window_start=case when login_attempts.window_start<now()-interval '15 minutes' then now() else login_attempts.window_start end returning attempts`,
    );
    if (network.rows[0].attempts > 100) return null;
  }
  const key = createHmac('sha256', process.env.AUTH_SECRET).update(input.data.email).digest('hex');
  const rate = await db.execute<{ attempts: number }>(
    sql`insert into login_attempts(key,attempts,window_start) values(${key},1,now()) on conflict(key) do update set attempts=case when login_attempts.window_start < now()-interval '15 minutes' then 1 else login_attempts.attempts+1 end, window_start=case when login_attempts.window_start < now()-interval '15 minutes' then now() else login_attempts.window_start end returning attempts`,
  );
  if (rate.rows[0].attempts > 10) return null;
  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, input.data.email))
    .limit(1);
  const valid = await verify(user?.passwordHash ?? (await dummy), input.data.password);
  if (!valid || !user || user.status !== 'active') {
    await db.insert(auditLogs).values({
      actorId: user?.id,
      action: 'login_failed',
      entityType: 'security',
      metadata: {},
    });
    return null;
  }
  await db.execute(sql`delete from login_attempts where key=${key}`);
  await db.insert(auditLogs).values({
    actorId: user.id,
    action: 'login_success',
    entityType: 'security',
    metadata: {},
  });
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    sessionVersion: user.sessionVersion,
  };
}
