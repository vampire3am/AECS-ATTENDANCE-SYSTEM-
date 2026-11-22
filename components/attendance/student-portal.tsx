'use client';
import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentScanner } from './student-scanner';
type Identity = {
  studentName: string;
  studentCode: string;
  courseName: string;
  batchName: string;
  batchCode: string;
};
export function StudentPortal({
  initialScan,
}: {
  initialScan?: { sessionId: string; token: string };
}) {
  const [code, setCode] = useState(''),
    [identity, setIdentity] = useState<Identity | null>(null),
    [scan, setScan] = useState(initialScan ?? null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Unable to complete this request.');
    return result;
  }
  return (
    <main className="min-h-dvh bg-[#f5f7fa]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight text-[#072B62]">
            AECS <span className="font-normal">Attend</span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#072B62]"
          >
            Staff sign in
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 md:grid-cols-2 md:items-start md:py-20">
        <section className="md:pt-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-700">
            <GraduationCap size={16} />
            Student attendance
          </span>
          <h1 className="mt-6 max-w-md text-4xl font-bold leading-tight tracking-tight text-[#072B62] sm:text-5xl">
            Your attendance.
            <br />
            One quick check-in.
          </h1>
          <p className="mt-5 max-w-md text-slate-500">
            Verify your private enrollment code, scan your teacher’s classroom QR, and you’re ready
            for class.
          </p>
          <ol className="mt-8 grid gap-5 text-sm text-slate-600">
            <li>
              <strong className="text-[#072B62]">1. Verify your code</strong>
              <p className="mt-1">
                Your code identifies your student, course and batch enrollment.
              </p>
            </li>
            <li>
              <strong className="text-[#072B62]">2. Scan the classroom QR</strong>
              <p className="mt-1">Use the scanner here or your phone’s camera.</p>
            </li>
            <li>
              <strong className="text-[#072B62]">3. Let your teacher confirm</strong>
              <p className="mt-1">Your teacher verifies that you are physically in class.</p>
            </li>
          </ol>
          <p className="mt-8 text-xs text-slate-400">
            Abroad Education Consultancy Services · Nepal
          </p>
        </section>
        <section className="panel !p-6 sm:!p-8">
          {done ? (
            <div role="status" className="py-8 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
              <h2 className="mt-4 text-2xl font-bold text-[#072B62]">Check-in received</h2>
              <p className="mt-3 text-sm text-slate-500">
                Your request was received. Your teacher will verify your presence and finalize
                attendance.
              </p>
              <Button
                className="mt-6"
                variant="outline"
                onClick={() => {
                  setDone(false);
                  setIdentity(null);
                  setCode('');
                  setScan(null);
                }}
              >
                Check in another enrollment
              </Button>
            </div>
          ) : !identity ? (
            <>
              <h2 className="text-xl font-bold text-[#072B62]">Verify your enrollment</h2>
              <p className="muted mt-2">
                Use the private code issued by AECS for your course and batch.
              </p>
              {scan && (
                <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-[#072B62]">
                  Classroom QR received. Enter your enrollment code to continue.
                </p>
              )}
              <form
                className="mt-6 grid gap-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError('');
                  try {
                    setIdentity(
                      await post('/api/enrollment/verify', { code: code.trim().toUpperCase() }),
                    );
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Unable to connect.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="grid gap-2 text-sm font-medium">
                  Your unique enrollment code
                  <input
                    className="input font-mono"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    maxLength={40}
                    placeholder="AECS-…"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  <ShieldCheck size={17} />
                  {busy ? 'Verifying…' : 'Verify my code'}
                </Button>
              </form>
              <p className="mt-5 text-xs text-slate-400">
                Don’t have a code? Ask your AECS teacher or administrator. Your general student ID
                is different from this private enrollment code.
              </p>
            </>
          ) : (
            <>
              <div className="mb-5 rounded-xl bg-blue-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#072B62]">
                  <ShieldCheck size={16} />
                  Enrollment verified
                </p>
                <h2 className="mt-3 text-lg font-bold text-[#072B62]">{identity.studentName}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {identity.courseName} · {identity.batchName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {identity.studentCode} · {identity.batchCode}
                </p>
              </div>
              {scan ? (
                <>
                  <p className="text-sm text-slate-600">
                    Classroom QR scanned. Confirm your check-in for this class.
                  </p>
                  <Button
                    className="mt-5 w-full"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        await post('/api/check-in', { ...scan, code: code.trim().toUpperCase() });
                        setDone(true);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Unable to connect.');
                        setScan(null);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? 'Checking in…' : 'Confirm my check-in'}
                  </Button>
                  <Button className="mt-2 w-full" variant="ghost" onClick={() => setScan(null)}>
                    Scan a different classroom QR
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-[#072B62]">Scan your classroom QR</h3>
                  <p className="muted mt-2">
                    Ask your teacher to display today’s QR and allow camera access when prompted.
                  </p>
                  <StudentScanner
                    onScan={(value) => {
                      setScan(value);
                      setError('');
                    }}
                  />
                </>
              )}
              <button
                className="mt-6 min-h-11 text-sm text-slate-500 underline"
                onClick={() => {
                  setIdentity(null);
                  setError('');
                }}
              >
                Use a different enrollment code
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
