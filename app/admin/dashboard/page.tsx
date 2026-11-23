import { requireActor } from '@/lib/auth/permissions';
import { Today } from '@/features/today/page';
export default async function Dashboard() {
  return <Today actor={await requireActor(true)} />;
}
