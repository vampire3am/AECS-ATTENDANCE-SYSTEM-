import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { submitStudentCheckin } from '@/lib/services/check-in';
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
    if (!process.env.AUTH_SECRET) throw new Error('Missing authentication secret');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key =
      'check-in:' + createHmac('sha256', process.env.AUTH_SECRET).update(ip).digest('hex');
    const rate = await db.execute<{ attempts: number }>(
      sql`insert into login_attempts(key,attempts,window_start) values(${key},1,now()) on conflict(key) do update set attempts=case when login_attempts.window_start<now()-interval '10 minutes' then 1 else login_attempts.attempts+1 end,window_start=case when login_attempts.window_start<now()-interval '10 minutes' then now() else login_attempts.window_start end returning attempts`,
    );
    if (rate.rows[0].attempts > 200)
      return Response.json(
        { error: 'Too many attempts. Please ask your teacher for help.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      );
    const body = await request.text();
    if (body.length > 4096) return Response.json({ error: 'Request too large.' }, { status: 413 });
    return Response.json(await submitStudentCheckin(JSON.parse(body)), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AppError
            ? error.message
            : error instanceof ZodError
              ? 'Enter the enrollment code issued for this course and batch.'
              : error instanceof SyntaxError
                ? 'Invalid request.'
                : 'Unable to check in. Please ask your teacher.',
      },
      {
        status:
          error instanceof AppError
            ? error.status
            : error instanceof ZodError || error instanceof SyntaxError
              ? 400
              : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
