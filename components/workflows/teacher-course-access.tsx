'use client';
import { useState } from 'react';
import { setTeacherCoursesAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
export function TeacherCourseAccess({
  teacherId,
  courses,
  selected,
}: {
  teacherId: string;
  courses: { id: string; name: string }[];
  selected: string[];
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ids, setIds] = useState(selected);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setIds(selected);
          setOpen(true);
        }}
      >
        Course access · {selected.length}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Assign teacher courses"
        description="The teacher may create their own batches in these courses. Other teachers’ batches remain private."
      >
        <form
          className="mt-6 space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const r = await setTeacherCoursesAction({ teacherId, courseIds: ids });
              if (r.ok) setOpen(false);
              else setError(r.error);
            } catch {
              setError('Unable to save. Please retry.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="grid gap-2">
            {courses.map((course) => (
              <label
                key={course.id}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-semibold"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[#3854ac]"
                  checked={ids.includes(course.id)}
                  onChange={(e) =>
                    setIds(
                      e.target.checked ? [...ids, course.id] : ids.filter((id) => id !== course.id),
                    )
                  }
                />
                {course.name}
              </label>
            ))}
            {!courses.length && (
              <p className="muted">Create a course first from Manage → Courses.</p>
            )}
          </fieldset>
          <p className="muted">
            Existing batch assignments are managed separately from each batch’s settings.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit">
            {busy ? 'Saving access…' : 'Save course access'}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
