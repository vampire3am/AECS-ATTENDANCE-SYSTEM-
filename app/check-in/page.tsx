import { StudentPortal } from '@/components/attendance/student-portal';
export const metadata = { title: 'Student check-in', robots: { index: false, follow: false } };
export default async function StudentCheckin({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; token?: string }>;
}) {
  const { session, token } = await searchParams;
  return (
    <StudentPortal initialScan={session && token ? { sessionId: session, token } : undefined} />
  );
}
