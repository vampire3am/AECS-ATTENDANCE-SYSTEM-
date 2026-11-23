'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, LoaderCircle, Plus } from 'lucide-react';
import { createEnrolledStudentAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EnrollmentCode } from '@/components/shared/enrollment-code';

export function AddStudent({
  batches,
  batchId,
  teacher = false,
}: {
  batches: { id: string; name: string; courseName: string }[];
  batchId?: string;
  teacher?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [result, setResult] = useState<{
    id: string;
    enrollmentCode: string;
    studentCode: string;
    enrolledOn: string;
    batchId: string;
  } | null>(null);
  return (
    <>
      <Button
        onClick={() => {
          setResult(null);
          setError('');
          setOpen(true);
        }}
      >
        <Plus size={17} /> Add student
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title={result ? 'Student added and enrolled' : 'Add a student'}
        description="One form. We’ll create the student, enroll them and generate their private code."
      >
        {result ? (
          <div className="mt-6 space-y-5">
            <CheckCircle2 size={32} className="text-emerald-600" />
            <div>
              <p className="mb-2 text-sm font-bold">Give this private code to the student</p>
              <EnrollmentCode code={result.enrollmentCode} />
            </div>
            <p className="muted">
              Enrollment starts {result.enrolledOn}. The student scans the common AECS QR and enters
              this code.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setResult(null);
                  router.refresh();
                }}
              >
                Add another student
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  router.push(
                    teacher ? '/teacher/classes/' + result.batchId : '/admin/students/' + result.id,
                  );
                }}
              >
                {teacher ? 'View batch' : 'View student'}
              </Button>
            </div>
          </div>
        ) : !batches.length ? (
          <div className="mt-6 space-y-4">
            <p className="muted">Create your first batch before adding students.</p>
            <Button asChild>
              <Link
                href={teacher ? '/teacher/classes' : '/admin/batches'}
                onClick={() => setOpen(false)}
              >
                Create a batch →
              </Link>
            </Button>
          </div>
        ) : (
          <form
            className="mt-6 grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError('');
              try {
                const r = await createEnrolledStudentAction(Object.fromEntries(form));
                if (r.ok) {
                  setResult(r.data);
                  router.refresh();
                } else setError(r.error);
              } catch {
                setError('Connection failed. Check the student list before retrying.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset className="grid gap-5" disabled={busy}>
              <label className="grid gap-2 text-sm font-semibold">
                Full name
                <input
                  name="fullName"
                  className="input"
                  autoComplete="name"
                  minLength={2}
                  maxLength={150}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Phone number
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="input"
                  minLength={7}
                  maxLength={25}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Email <span className="sr-only">optional</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="input"
                  placeholder="Optional"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Batch
                <select
                  name="batchId"
                  className="input"
                  defaultValue={batchId ?? batches[0].id}
                  required
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.courseName} · {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle size={17} className="animate-spin" />}
              {busy ? 'Adding and enrolling…' : 'Add student & get code'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
