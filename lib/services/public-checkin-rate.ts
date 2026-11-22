import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invariant } from '@/lib/errors';
export async function limitStudentRequests(request: Request, scope: string) {
  if (!process.env.AUTH_SECRET) throw new Error('Missing authentication secret');
  const origin = request.headers.get('origin');
  invariant(!origin || origin === new URL(request.url).origin, 'Invalid request origin.', 403);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const key = scope + ':' + createHmac('sha256', process.env.AUTH_SECRET).update(ip).digest('hex');
  const rate = await db.execute<{ attempts: number }>(
    sql`insert into login_attempts(key,attempts,window_start) values(${key},1,now()) on conflict(key) do update set attempts=case when login_attempts.window_start<now()-interval '10 minutes' then 1 else login_attempts.attempts+1 end,window_start=case when login_attempts.window_start<now()-interval '10 minutes' then now() else login_attempts.window_start end returning attempts`,
  );
  invariant(
    rate.rows[0].attempts <= 200,
    'Too many attempts. Please ask your teacher for help.',
    429,
  );
}
