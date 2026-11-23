import { CreateRecord } from '@/components/shared/create-record';
import { AddTeacher } from '@/components/workflows/add-teacher';
import { TeacherCourseAccess } from '@/components/workflows/teacher-course-access';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { teacherFields } from '@/lib/form-fields';
import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { PageContext } from './context';
export async function TeachersPage({ c }: PageContext) {
  const [grants, assignments] = await Promise.all([
    db
      .select({
        teacherId: s.teacherCourseAssignments.teacherId,
        courseId: s.teacherCourseAssignments.courseId,
      })
      .from(s.teacherCourseAssignments)
      .where(eq(s.teacherCourseAssignments.active, true)),
    db
      .select({
        teacherId: s.teacherAssignments.teacherId,
        batchId: s.batches.id,
        batchName: s.batches.name,
      })
      .from(s.teacherAssignments)
      .innerJoin(s.batches, eq(s.batches.id, s.teacherAssignments.batchId))
      .innerJoin(
        s.teacherCourseAssignments,
        and(
          eq(s.teacherCourseAssignments.teacherId, s.teacherAssignments.teacherId),
          eq(s.teacherCourseAssignments.courseId, s.batches.courseId),
          eq(s.teacherCourseAssignments.active, true),
        ),
      )
      .where(eq(s.teacherAssignments.active, true)),
  ]);
  return (
    <>
      <PageHeader
        title="Teachers"
        description="Course access controls what each teacher can see and manage."
      >
        <AddTeacher />
      </PageHeader>
      <div className="mb-6 rounded-xl border border-[#dfe5f6] bg-[#eef1fb] p-4 text-sm leading-relaxed text-[#3854ac]">
        Remove a course to block all its batches, students and reports. The teacher will be asked to
        sign in again. Your Super Admin account continues to see everything.
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {c.teachers.map((t) => {
          const ids = grants.filter((g) => g.teacherId === t.id).map((g) => g.courseId);
          const batches = assignments.filter((a) => a.teacherId === t.id);
          return (
            <article key={t.id} className="panel min-w-0 !p-5 sm:!p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-extrabold">{t.fullName}</h2>
                  <p className="mt-1 break-all text-xs text-slate-500">{t.email}</p>
                  {t.phone && <p className="mt-1 text-xs text-slate-500">{t.phone}</p>}
                </div>
                <Badge status={t.status} />
              </div>
              <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <h3 className="eyebrow">Allowed courses · {ids.length}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ids.map((id) => (
                      <span
                        key={id}
                        className="rounded-md bg-[#eef1fb] px-2 py-1 text-xs font-semibold text-[#3854ac]"
                      >
                        {c.courses.find((v) => v.id === id)?.name ?? 'Archived course'}
                      </span>
                    ))}
                    {!ids.length && (
                      <p className="text-xs font-semibold text-amber-700">No course access</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="eyebrow">Assigned batches · {batches.length}</h3>
                  <div className="mt-2 grid gap-2">
                    {batches.map((b) => (
                      <Link
                        key={b.batchId}
                        className="break-words text-xs font-semibold text-[#3854ac] underline-offset-4 hover:underline"
                        href={'/admin/batches/' + b.batchId}
                      >
                        {b.batchName}
                      </Link>
                    ))}
                    {!batches.length && <p className="text-xs text-slate-500">No batch access</p>}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <TeacherCourseAccess
                  teacherId={t.id}
                  courses={c.courses.filter((v) => v.status === 'active')}
                  selected={ids}
                />
                <CreateRecord
                  entity="teachers"
                  title="Edit account"
                  id={t.id}
                  defaults={t}
                  fields={teacherFields(true)}
                />
              </div>
            </article>
          );
        })}
      </div>
      {!c.teachers.length && (
        <p className="panel empty">
          Add a teacher, grant courses, then assign batches or let them create their own.
        </p>
      )}
    </>
  );
}
