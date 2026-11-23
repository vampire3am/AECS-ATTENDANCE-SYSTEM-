'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { Brand } from '@/components/shared/brand';
import { Button } from '@/components/ui/button';
import { StudentScanner } from './student-scanner';
import { enrollmentCodeInput } from '@/lib/enrollment-code-input';
import type { ClassroomScan } from '@/lib/classroom-qr';
type Identity = {
  studentName: string;
  studentCode: string;
  courseName: string;
  batchName: string;
  batchCode: string;
};
export function StudentPortal({ initialScan }: { initialScan?: ClassroomScan }) {
  const [code, setCode] = useState(''),
    [identity, setIdentity] = useState<Identity | null>(null),
    [scan, setScan] = useState<ClassroomScan | null>(initialScan ?? { common: true }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  async function post(path: string, body: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error ?? 'Please try again.');
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }
  function reset() {
    setIdentity(null);
    setCode('');
    setDone(false);
    setError('');
    setScan({ common: true });
  }
  const step = done ? 3 : identity ? 2 : 1;
  return (
    <main className="student-landing min-h-dvh">
      <header className="border-b border-[#e5e9f2] bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-7">
          <Link href="/" aria-label="AECS Attend home">
            <Brand />
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:px-4"
          >
            Staff sign in <ArrowRight size={13} className="ml-2 hidden sm:block" />
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-7 px-4 pb-10 pt-8 sm:px-7 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:gap-16 lg:py-16">
        <section className="lg:pt-9">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#f5dfcd] bg-[#fff7f0] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#a95d28]">
            <GraduationCap size={14} /> AECS student check-in
          </span>
          <h1 className="mt-5 max-w-lg text-[2rem] font-extrabold leading-[1.15] tracking-[-.045em] text-[#253963] sm:text-5xl">
            You’re here.
            <br />
            <span className="text-[#3854ac]">Let your class know.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-500 sm:text-base">
            One common QR for every batch. Enter your private code, check your class details, and
            let your teacher confirm.
          </p>
          <div className="mt-9 hidden gap-5 lg:grid">
            {[
              [
                LockKeyhole,
                'Your code, your class',
                'Your private code identifies your course and batch.',
              ],
              [
                ShieldCheck,
                'A teacher checks your presence',
                'Your request becomes attendance after staff verification.',
              ],
            ].map(([Icon, title, body]) => {
              const Symbol = Icon as typeof LockKeyhole;
              return (
                <div key={String(title)} className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-[#3854ac]">
                    <Symbol size={19} />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold">{title as string}</h2>
                    <p className="muted mt-1 max-w-xs">{body as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="min-w-0 rounded-[22px] border border-[#dfe5f0] bg-white p-5 shadow-[0_16px_48px_-32px_#293e75] sm:p-8">
          <ol
            aria-label="Check-in progress"
            className="mb-7 flex items-center gap-2 border-b border-slate-100 pb-5"
          >
            {['Your code', 'Your class', 'Teacher check'].map((label, i) => (
              <li
                key={label}
                aria-current={step === i + 1 ? 'step' : undefined}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-bold text-slate-500 sm:text-xs"
              >
                <span
                  className={
                    'grid size-6 shrink-0 place-items-center rounded-full text-[10px] ' +
                    (step >= i + 1 ? 'bg-[#3854ac] text-white' : 'bg-slate-100 text-slate-400')
                  }
                >
                  {i + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          {done ? (
            <div role="status" className="py-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={29} />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight">Check-in received</h2>
              <p className="muted mt-3">
                Your teacher will verify your physical presence and finalize attendance. You can now
                put your phone away.
              </p>
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                Awaiting teacher confirmation
              </div>
              {identity && (
                <p className="mt-4 break-words text-sm text-slate-500">
                  {identity.studentName} · {identity.courseName} · {identity.batchName}
                </p>
              )}
              <Button variant="outline" className="mt-6 w-full" onClick={reset}>
                Check in another enrollment
              </Button>
            </div>
          ) : !identity ? (
            <>
              <p className="eyebrow">Welcome to your class</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#253963]">
                Verify your enrollment
              </h2>
              <p className="muted mt-2">
                Use the private code given to you by AECS. We’ll find the right course and batch
                automatically.
              </p>
              <form
                className="mt-6 grid gap-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const parsed = enrollmentCodeInput.safeParse({ code });
                  if (!parsed.success) {
                    setError(parsed.error.issues[0].message);
                    return;
                  }
                  setBusy(true);
                  setError('');
                  try {
                    setIdentity(await post('/api/enrollment/verify', { code: parsed.data.code }));
                  } catch (e) {
                    setError(
                      e instanceof Error && e.name !== 'AbortError'
                        ? e.message
                        : 'Connection timed out. Please try again.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="grid gap-2 text-sm font-bold">
                  Your unique enrollment code
                  <input
                    className="input !min-h-14 !bg-[#fbfcff] !font-mono tracking-wide"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    maxLength={40}
                    placeholder="AECS-…"
                    value={code}
                    aria-invalid={Boolean(error)}
                    aria-describedby="enrollment-code-help"
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError('');
                    }}
                  />
                </label>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={17} />
                  )}{' '}
                  {busy ? 'Finding your class…' : 'Verify my code'}{' '}
                  {!busy && <ArrowRight size={16} />}
                </Button>
              </form>
              <p id="enrollment-code-help" className="mt-4 text-xs leading-relaxed text-slate-500">
                Your student ID (for example AECS-000001) is different from your private enrollment
                code.
              </p>
              <details className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <summary className="text-xs font-bold text-slate-600">
                  Don’t have your private code?
                </summary>
                <p className="muted mt-3">
                  Ask your teacher or the AECS front desk. Each course and batch enrollment has its
                  own private code.
                </p>
              </details>
            </>
          ) : (
            <>
              <p className="eyebrow !text-emerald-700">Enrollment verified</p>
              <h2 className="mt-2 break-words text-2xl font-extrabold tracking-tight text-[#253963]">
                Hi, {identity.studentName}.
              </h2>
              <p className="muted mt-2">Check that these are your class details.</p>
              <dl className="mt-6 grid gap-4 rounded-2xl border border-[#e1e7f5] bg-[#f7f9fe] p-5">
                <div>
                  <dt className="eyebrow">Course</dt>
                  <dd className="mt-1 break-words text-base font-bold">{identity.courseName}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Batch</dt>
                  <dd className="mt-1 break-words text-base font-bold">{identity.batchName}</dd>
                </div>
                <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
                  Student ID: {identity.studentCode}
                </div>
              </dl>
              {scan ? (
                <>
                  <p className="muted mt-4">
                    Your teacher must open today’s class before you can check in.
                  </p>
                  <Button
                    className="mt-5 w-full"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        await post('/api/check-in', {
                          ...('common' in scan ? {} : scan),
                          code: code.trim().toUpperCase(),
                        });
                        setDone(true);
                      } catch (e) {
                        setError(
                          e instanceof Error && e.name !== 'AbortError'
                            ? e.message
                            : 'Connection timed out. Retry safely to confirm your request.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}{' '}
                    {busy ? 'Sending your check-in…' : 'Confirm my check-in'}
                  </Button>
                  <button
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 text-xs font-semibold text-slate-500"
                    onClick={() => setScan(null)}
                  >
                    <ScanLine size={15} /> Scan a specific classroom QR instead
                  </button>
                </>
              ) : (
                <div className="mt-5">
                  <StudentScanner
                    onScan={(value) => {
                      setScan(value);
                      setError('');
                    }}
                  />
                  <Button
                    variant="ghost"
                    className="mt-3 w-full"
                    onClick={() => setScan({ common: true })}
                  >
                    Use the common AECS check-in
                  </Button>
                </div>
              )}
              <button
                className="mt-3 min-h-11 text-xs font-bold text-[#3854ac] underline underline-offset-4"
                onClick={reset}
              >
                Use a different enrollment code
              </button>
            </>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 lg:col-span-2">
          <p>Abroad Education Consultancy Services · Nepal</p>
          <span className="flex items-center gap-1.5">
            <LockKeyhole size={12} /> Private code. Teacher-verified attendance.
          </span>
        </footer>
      </div>
    </main>
  );
}
