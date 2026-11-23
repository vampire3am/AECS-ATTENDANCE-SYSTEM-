'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle2, LoaderCircle } from 'lucide-react';
import { createBatchSetupAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

type Option = { id: string; name: string };
export function BatchSetup({
  courses,
  teachers,
  today,
}: {
  courses: Option[];
  teachers: Option[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [course, setCourse] = useState(courses[0]?.id ?? 'new'),
    [teacher, setTeacher] = useState('admin');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [result, setResult] = useState<{
    id: string;
    teacherAccess: { email: string; password: string } | null;
  } | null>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={17} /> Create batch
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={result ? 'Your batch is ready' : 'Create a batch'}
        description={
          result
            ? 'Next, add your students. Their private check-in codes are generated automatically.'
            : 'Set up the course, teacher and weekly class times here.'
        }
      >
        {result ? (
          <div className="mt-6 space-y-5">
            <CheckCircle2 className="text-emerald-600" size={32} />
            {result.teacherAccess && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold">Save the new teacher’s login</p>
                <p className="muted mt-2">
                  These details are shown only here. Share them privately with the teacher.
                </p>
                <p className="mt-3 break-all text-sm">{result.teacherAccess.email}</p>
                <code className="mt-2 block select-all break-all rounded-lg bg-white p-3 text-sm">
                  {result.teacherAccess.password}
                </code>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => {
                setOpen(false);
                router.push('/admin/batches/' + result.id + '/students');
              }}
            >
              Add students to this batch →
            </Button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError('');
              try {
                const response = await createBatchSetupAction({
                  name: form.get('name'),
                  course: course === 'new' ? { name: form.get('courseName') } : { id: course },
                  teacher:
                    teacher === 'admin'
                      ? undefined
                      : teacher === 'new'
                        ? { fullName: form.get('teacherName'), email: form.get('teacherEmail') }
                        : { id: teacher },
                  startDate: form.get('startDate'),
                  weekdays: days,
                  startTime: form.get('startTime'),
                  endTime: form.get('endTime'),
                });
                if (response.ok) setResult(response.data);
                else setError(response.error);
              } catch {
                setError('Connection failed. Check the batch list before retrying.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="grid gap-5">
              <label className="grid gap-2 text-sm font-semibold">
                Batch name
                <input
                  name="name"
                  className="input"
                  placeholder="IELTS · Morning batch"
                  minLength={2}
                  maxLength={150}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Course
                <select
                  className="input"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="new">+ Create a new course</option>
                </select>
              </label>
              {course === 'new' && (
                <label className="grid gap-2 rounded-xl bg-[#f6f8fe] p-4 text-sm font-semibold">
                  New course name
                  <input
                    name="courseName"
                    className="input"
                    placeholder="IELTS, PTE, Japanese…"
                    minLength={2}
                    maxLength={150}
                    required
                  />
                </label>
              )}
              <label className="grid gap-2 text-sm font-semibold">
                Who teaches this batch?
                <select
                  className="input"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                >
                  <option value="admin">I’ll manage it as admin</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value="new">+ Add a new teacher</option>
                </select>
              </label>
              {teacher === 'new' && (
                <div className="grid gap-4 rounded-xl bg-[#f6f8fe] p-4">
                  <label className="grid gap-2 text-sm font-semibold">
                    Teacher name
                    <input
                      name="teacherName"
                      className="input"
                      minLength={2}
                      maxLength={150}
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Teacher email
                    <input name="teacherEmail" type="email" className="input" required />
                  </label>
                  <p className="muted">A secure login password will be generated for you.</p>
                </div>
              )}
              <div>
                <p id="class-days" className="mb-2 text-sm font-semibold">
                  Class days
                </p>
                <div role="group" aria-labelledby="class-days" className="flex flex-wrap gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => (
                    <button
                      type="button"
                      key={label}
                      aria-pressed={days.includes(i + 1)}
                      className={
                        'min-h-11 rounded-lg border px-3 text-xs font-bold ' +
                        (days.includes(i + 1)
                          ? 'border-[#3854ac] bg-[#eef1fb] text-[#3854ac]'
                          : 'border-slate-200 text-slate-500')
                      }
                      onClick={() =>
                        setDays((current) =>
                          current.includes(i + 1)
                            ? current.filter((d) => d !== i + 1)
                            : [...current, i + 1],
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-2 text-sm font-semibold">
                  Start time
                  <input
                    name="startTime"
                    type="time"
                    className="input"
                    defaultValue="07:00"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  End time
                  <input
                    name="endTime"
                    type="time"
                    className="input"
                    defaultValue="08:00"
                    required
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                Batch starts on
                <input
                  name="startDate"
                  type="date"
                  className="input"
                  min={today}
                  defaultValue={today}
                  required
                />
              </label>
            </fieldset>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <LoaderCircle size={17} className="animate-spin" />}
              {busy ? 'Creating your batch…' : 'Create batch'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
