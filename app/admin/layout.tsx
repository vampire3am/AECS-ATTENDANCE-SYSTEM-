import { Nav } from '@/components/shared/nav';
import { SignOut } from '@/components/shared/sign-out';
import { requireActor } from '@/lib/auth/permissions';
import Link from 'next/link';
import { redirect } from 'next/navigation';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireActor(true);
  } catch {
    redirect('/login');
  }
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[236px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-5 lg:fixed lg:inset-y-0 lg:w-[236px] lg:border-r">
        <Link className="mb-7 flex items-center gap-3" href="/admin/dashboard">
          <span className="grid size-10 place-items-center rounded-xl bg-[#072B62] text-xl font-bold text-white">
            a<span className="sr-only">AECS</span>
          </span>
          <span className="text-xl font-bold tracking-tight text-[#072B62]">
            AECS <span className="font-normal">Attend</span>
          </span>
        </Link>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Workspace
        </p>
        <Nav />
        <div className="mt-8 border-t border-slate-100 pt-5">
          <p className="text-sm font-semibold text-slate-700">Abroad Education</p>
          <p className="muted">Consultancy Services · Nepal</p>
          <SignOut />
        </div>
      </aside>
      <div className="min-w-0 lg:col-start-2">
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-9">
          <p className="text-sm text-slate-500">Your classes. Every student. Every day.</p>
          <span className="badge">Super Admin</span>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-8 lg:p-9">{children}</main>
      </div>
    </div>
  );
}
