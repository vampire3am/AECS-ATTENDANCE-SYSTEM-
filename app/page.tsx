import { requireActor } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
export default async function Home() {
  let target = '/login';
  try {
    const actor = await requireActor();
    target = actor.role === 'super_admin' ? '/admin/dashboard' : '/teacher';
  } catch {}
  redirect(target);
}
