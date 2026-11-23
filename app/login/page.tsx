import { Brand } from '@/components/shared/brand';
import Link from 'next/link';
import { LoginForm } from './sign-in';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#2B4088] p-14 text-white lg:flex">
        <Brand inverse />
        <div>
          <div className="mb-8 h-1 w-14 bg-[#ED7824]" />
          <h1 className="max-w-md text-5xl font-bold leading-tight tracking-tight">
            Every student.
            <br />
            Every class.
            <br />
            <span className="text-orange-300">Accounted for.</span>
          </h1>
          <p className="mt-6 max-w-sm text-lg text-blue-100">
            A simpler way to keep your classes connected and your students on track.
          </p>
        </div>
        <p className="text-sm text-blue-200">Abroad Education Consultancy Services · Nepal</p>
      </section>
      <section className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-orange-600">
            Staff workspace
          </p>
          <h2 className="page-title">Welcome back</h2>
          <p className="mt-3 text-slate-500">Sign in to manage your classes and attendance.</p>
          {reason === 'access-changed' && (
            <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Your session or access changed. Sign in again to load your updated workspace.
            </p>
          )}
          <LoginForm />
          <Link
            href="/student"
            className="mt-6 block rounded-lg border border-slate-200 p-3 text-center text-sm font-semibold text-[#3854AC]"
          >
            Student? Verify your code and scan here
          </Link>
          <p className="mt-8 text-center text-xs text-slate-400">
            Secure access for AECS staff only.
          </p>
        </div>
      </section>
    </main>
  );
}
