import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';
import { verifyEnrollmentCode } from '@/lib/services/check-in';
import { limitStudentRequests } from '@/lib/services/public-checkin-rate';
export async function POST(request: Request) {
  try {
    await limitStudentRequests(request, 'enrollment-verify');
    const body = await request.text();
    if (body.length > 1024) return Response.json({ error: 'Request too large.' }, { status: 413 });
    return Response.json(await verifyEnrollmentCode(JSON.parse(body)), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AppError
            ? error.message
            : error instanceof ZodError
              ? (error.issues[0]?.message ?? 'Enter your private enrollment code.')
              : 'Unable to verify this code. Please ask your teacher.',
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
