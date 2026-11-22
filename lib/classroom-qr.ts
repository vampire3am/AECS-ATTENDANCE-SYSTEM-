import { z } from 'zod';
const fields = z.object({ sessionId: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) });
export type ClassroomScan = { common: true } | z.infer<typeof fields>;
export function parseClassroomQr(value: string, origin: string) {
  const url = new URL(value);
  if (url.origin !== new URL(origin).origin || url.pathname !== '/check-in')
    throw new Error('Scan the classroom QR displayed by your AECS teacher.');
  if (!url.search) return { common: true } as const;
  if (Array.from(url.searchParams.keys()).some((key) => key !== 'session' && key !== 'token'))
    throw new Error('Use the common AECS attendance QR.');
  return fields.parse({
    sessionId: url.searchParams.get('session'),
    token: url.searchParams.get('token'),
  });
}
