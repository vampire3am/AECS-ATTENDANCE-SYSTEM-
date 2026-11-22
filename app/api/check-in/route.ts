import { limitStudentRequests } from '@/lib/services/public-checkin-rate';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';
import { submitStudentCheckin } from '@/lib/services/check-in';
export async function POST(request: Request) {
  try {
    await limitStudentRequests(request, 'check-in');
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
