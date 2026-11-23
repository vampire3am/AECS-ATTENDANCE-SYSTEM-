import { requireActor } from '@/lib/auth/permissions';
import { accessState } from '@/lib/services/access-state';
import { AppError } from '@/lib/errors';
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  try {
    return Response.json(await accessState(await requireActor()), { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof AppError ? error.message : 'Unable to verify access.' },
      { status: error instanceof AppError ? error.status : 500, headers },
    );
  }
}
