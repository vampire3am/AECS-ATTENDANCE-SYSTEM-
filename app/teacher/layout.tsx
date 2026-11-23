import { Brand } from '@/components/shared/brand';
import { AccessGuard } from '@/components/shared/access-guard';
import { Nav } from '@/components/shared/nav';
import { requirePageActor } from '@/lib/auth/permissions';
import Link from 'next/link';
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-24">
      <AccessGuard actorId={actor.id} />
      <header className="flex h-18 items-center justify-between border-b border-slate-200 bg-white px-5">
        <Link href="/teacher" className="text-lg font-bold text-[#3854AC]">
          <Brand />
        </Link>
        <span className="badge">Teacher workspace</span>
      </header>
      <main className="p-4 sm:p-6">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-3xl border-t border-slate-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        <Nav teacher />
      </div>
    </div>
  );
}
