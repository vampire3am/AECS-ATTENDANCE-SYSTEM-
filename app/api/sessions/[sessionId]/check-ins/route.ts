import { requireActor } from '@/lib/auth/permissions';
import { listCheckins } from '@/lib/services/check-in';
import { AppError } from '@/lib/errors';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const actor = await requireActor();
    const { sessionId } = await params;
    return Response.json(await listCheckins(actor, sessionId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof AppError ? error.message : 'Unable to load check-ins.' },
      { status: error instanceof AppError ? error.status : 400 },
    );
  }
}
