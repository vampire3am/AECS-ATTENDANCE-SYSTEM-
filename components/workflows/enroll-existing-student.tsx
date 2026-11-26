'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, UserPlus } from 'lucide-react';
import { enrollAction, existingStudentOptionsAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EnrollmentCode } from '@/components/shared/enrollment-code';
import { localDate } from '@/lib/utils';

type Batch = { id: string; name: string; courseName: string; startDate: string };
type Student = { id: string; fullName: string; phone: string; joinedOn: string };
export function EnrollExistingStudent({
  batches,
  batchId,
  studentId,
}: {
  batches: Batch[];
  batchId?: string;
  studentId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState(batchId ?? batches[0]?.id ?? ''),
    [search, setSearch] = useState(''),
    [students, setStudents] = useState<Student[]>([]),
    [selected, setSelected] = useState(''),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<{
      code: string;
      student: Student;
      batch: Batch;
      startsOn: string;
    } | null>(null);
  useEffect(() => {
    if (!open || !target || result) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const r = await existingStudentOptionsAction({ batchId: target, search });
        if (!active) return;
        if (r.ok) {
          setStudents(r.data);
          setSelected(r.data.find((s) => s.id === studentId)?.id ?? '');
        } else setError(r.error);
      } catch {
        if (active) setError('Unable to load students. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, target, search, studentId, result]);
  function changeTarget(value: string) {
    setTarget(value);
    setStudents([]);
    setSelected('');
    setLoading(Boolean(value));
    setError('');
  }
  const batch = batches.find((b) => b.id === target);
  const student = students.find((s) => s.id === selected);
  const startsOn = [localDate(), batch?.startDate ?? '', student?.joinedOn ?? ''].sort().at(-1)!;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setResult(null);
          setSearch('');
          changeTarget(batchId ?? batches[0]?.id ?? '');
          setOpen(true);
        }}
      >
        <UserPlus size={16} /> Enroll existing student
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={result ? 'Student enrolled' : 'Enroll an existing student'}
        description="Use an existing student record. A new private code is created for this enrollment."
      >
        {result ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm font-semibold">
              {result.student.fullName} · {result.batch.courseName} · {result.batch.name}
            </p>
            <p className="muted">Enrollment starts {result.startsOn}.</p>
            <EnrollmentCode
              code={result.code}
              recipient={{
                studentName: result.student.fullName,
                phone: result.student.phone,
                courseName: result.batch.courseName,
                batchName: result.batch.name,
              }}
            />
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <form
            className="mt-5 grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!student || !batch) return;
              setBusy(true);
              setError('');
              try {
                const r = await enrollAction({
                  studentId: student.id,
                  batchId: batch.id,
                  enrolledOn: startsOn,
                });
                if (r.ok) {
                  setResult({ code: r.data.code, student, batch, startsOn });
                  router.refresh();
                } else setError(r.error);
              } catch {
                setError('Unable to connect. Check the roster before retrying.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                Batch
                <select
                  required
                  className="input"
                  value={target}
                  onChange={(e) => changeTarget(e.target.value)}
                >
                  <option value="">Choose a batch</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.courseName} · {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Find a student
                <input
                  className="input"
                  type="search"
                  placeholder="Name, student ID or phone"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setStudents([]);
                    setSelected('');
                    setLoading(Boolean(target));
                    setError('');
                  }}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Existing student
                <select
                  required
                  className="input"
                  disabled={loading || !target}
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">{loading ? 'Loading students…' : 'Choose a student'}</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} · {s.phone}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Shows up to 50 eligible students. Search to find more. Students already enrolled in
                this course are excluded; use Transfer to change their batch. Teachers can only
                select students from their assigned batches.
              </p>
              {student && <p className="text-sm">Enrollment starts {startsOn} (Nepal time).</p>}
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            {!loading && target && !students.length && !error && (
              <p role="status" className="muted">
                No eligible students found. Try another search or batch.
              </p>
            )}
            <Button type="submit" disabled={busy || loading || !student || !batch}>
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {busy ? 'Enrolling…' : 'Enroll student & get code'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
