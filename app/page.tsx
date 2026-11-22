import { requireActor } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { StudentPortal } from '@/components/attendance/student-portal';
export default async function Home() {
  let target: string | null = null;
  try {
    const actor = await requireActor();
    target = actor.role === 'super_admin' ? '/admin/dashboard' : '/teacher';
  } catch {}
  if (target) redirect(target);
  return <StudentPortal />;
}
