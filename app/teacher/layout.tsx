import { Brand } from '@/components/shared/brand';
import { Nav } from '@/components/shared/nav';
import { requireActor } from '@/lib/auth/permissions';
import Link from 'next/link';
import { redirect } from 'next/navigation';
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireActor();
  } catch {
    redirect('/login');
  }
  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-24">
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
