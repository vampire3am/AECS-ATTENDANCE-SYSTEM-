import { BatchSetup } from '@/components/workflows/batch-setup';
import { AddStudent } from '@/components/workflows/add-student';
import { localDate } from '@/lib/utils';
import { EnrollmentCode } from '@/components/shared/enrollment-code';
import { CommonQr } from '@/components/shared/common-qr';
import { CreateRecord } from '@/components/shared/create-record';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { AssignmentForm, EnrollmentForms } from '@/components/shared/session-actions';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { batchFields, scheduleFields } from '@/lib/form-fields';
import { listSessions } from '@/lib/services/attendance';
import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PageContext } from './context';
import { SessionTable, Table } from './tables';
export async function BatchesPage({ actor, id, tab, c }: PageContext) {
  if (id) {
    const batch = c.batches.find((b) => b.id === id);
    if (!batch) notFound();
    const [enrollment, schedules, assignments] = await Promise.all([
      db
        .select({ enrollment: s.enrollments, student: s.students })
        .from(s.enrollments)
        .innerJoin(s.students, eq(s.students.id, s.enrollments.studentId))
        .where(eq(s.enrollments.batchId, id))
        .orderBy(s.students.fullName),
      db
        .select()
        .from(s.batchSchedules)
        .where(eq(s.batchSchedules.batchId, id))
        .orderBy(s.batchSchedules.weekday, s.batchSchedules.startTime),
      db
        .select({ fullName: s.profiles.fullName, email: s.profiles.email })
        .from(s.teacherAssignments)
        .innerJoin(s.profiles, eq(s.profiles.id, s.teacherAssignments.teacherId))
        .innerJoin(
          s.teacherCourseAssignments,
          and(
            eq(s.teacherCourseAssignments.teacherId, s.teacherAssignments.teacherId),
            eq(s.teacherCourseAssignments.courseId, batch.courseId),
            eq(s.teacherCourseAssignments.active, true),
          ),
        )
        .where(and(eq(s.teacherAssignments.batchId, id), eq(s.teacherAssignments.active, true))),
    ]);
    return (
      <>
        <PageHeader title={batch.name} description={batch.courseName}>
          <CreateRecord
            entity="batches"
            title="Edit batch"
            id={id}
            defaults={batch}
            fields={batchFields(c.courses)}
          />
        </PageHeader>
        {!tab && <CommonQr />}
        <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#eef1f7] p-1">
          {['overview', 'students', 'schedule', 'sessions'].map((t) => (
            <Link
              key={t}
              href={`/admin/batches/${id}${t === 'overview' ? '' : '/' + t}`}
              className="tab-link capitalize"
              aria-current={(tab ?? 'overview') === t ? 'page' : undefined}
            >
              {t}
            </Link>
          ))}
        </div>
        {!tab && (
          <section className="mb-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [
                  'Enrolled students',
                  enrollment.filter((r) => r.enrollment.status === 'active').length,
                ],
                ['Weekly classes', schedules.filter((r) => r.status === 'active').length],
                ['Assigned teachers', assignments.length],
              ].map(([label, value]) => (
                <div key={label} className="panel !p-5">
                  <p className="eyebrow">{label}</p>
                  <p className="mt-2 text-3xl font-extrabold text-[#253963]">{value}</p>
                </div>
              ))}
            </div>
            <div className="panel">
              <p className="eyebrow mb-2">Batch workspace</p>
              <h2 className="text-lg font-bold">Prepare your next class.</h2>
              <p className="muted mt-2">
                Manage enrollments, set a weekly timetable, then open today’s attendance.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['students', '01', 'Manage students', 'Enroll, transfer and view private codes.'],
                  ['schedule', '02', 'Set the timetable', 'Choose class days and times.'],
                  ['sessions', '03', 'View class sessions', 'Open and review attendance.'],
                ].map(([path, step, title, description]) => (
                  <Link
                    key={path}
                    href={'/admin/batches/' + id + '/' + path}
                    className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-[#aebce7] hover:bg-[#fafbff]"
                  >
                    <span className="text-[10px] font-extrabold tracking-widest text-[#bd5f22]">
                      {step}
                    </span>
                    <h3 className="mt-2 text-sm font-bold text-[#3854ac]">{title} →</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
        {tab === 'students' && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Students in this batch</h2>
                <p className="muted">Add a student here to enroll them and get their code.</p>
              </div>
              <AddStudent batches={c.batches.filter((b) => b.status === 'active')} batchId={id} />
            </div>
            <Table
              heads={['Student', 'Enrollment code', 'Enrollment', 'Status']}
              empty={!enrollment.length}
            >
              {enrollment.map((r) => (
                <tr key={r.enrollment.id}>
                  <td>
                    <Link
                      href={`/admin/students/${r.student.id}`}
                      className="font-semibold text-[#3854AC]"
                    >
                      {r.student.fullName}
                    </Link>
                  </td>
                  <td>
                    <EnrollmentCode code={r.enrollment.checkinCode} />
                    <p className="mt-1 text-xs text-slate-400">
                      Student ID: {r.student.studentCode}
                    </p>
                  </td>
                  <td>
                    {r.enrollment.enrolledOn} – {r.enrollment.endedOn ?? 'ongoing'}
                  </td>
                  <td>
                    <Badge status={r.enrollment.status} />
                  </td>
                </tr>
              ))}
            </Table>
            <details className="mt-6">
              <summary className="min-h-11 py-3 text-sm font-semibold text-slate-500">
                Manage existing enrollments · transfer or end
              </summary>
              <EnrollmentForms
                batchId={id}
                students={(
                  await db
                    .select({ id: s.students.id, name: s.students.fullName })
                    .from(s.students)
                    .where(eq(s.students.status, 'active'))
                    .orderBy(s.students.fullName)
                ).map((r) => ({ value: r.id, label: r.name }))}
                batches={c.batches
                  .filter(
                    (b) => b.courseId === batch.courseId && b.id !== id && b.status === 'active',
                  )
                  .map((b) => ({ value: b.id, label: b.name }))}
                enrollments={enrollment
                  .filter((r) => r.enrollment.status === 'active')
                  .map((r) => ({ id: r.enrollment.id, label: r.student.fullName }))}
              />
            </details>
          </>
        )}
        {tab === 'schedule' && (
          <section className="panel mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Weekly timetable</h2>
              <CreateRecord
                entity="schedules"
                title="Add schedule"
                fields={[
                  {
                    name: 'batchId',
                    label: 'Batch',
                    defaultValue: id,
                    options: [{ value: id, label: batch.name }],
                    required: true,
                  },
                  ...scheduleFields,
                ]}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Weekday</th>
                    <th>Time</th>
                    <th>Effective</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {
                          [
                            '',
                            'Monday',
                            'Tuesday',
                            'Wednesday',
                            'Thursday',
                            'Friday',
                            'Saturday',
                            'Sunday',
                          ][r.weekday]
                        }
                      </td>
                      <td>
                        {r.startTime.slice(0, 5)}–{r.endTime.slice(0, 5)}
                      </td>
                      <td>
                        {r.effectiveFrom} – {r.effectiveUntil ?? 'ongoing'}
                      </td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>
                        <CreateRecord
                          entity="schedules"
                          title="Edit"
                          id={r.id}
                          fields={[
                            {
                              name: 'batchId',
                              label: 'Batch',
                              defaultValue: id,
                              options: [{ value: id, label: batch.name }],
                            },
                            ...scheduleFields,
                          ]}
                          defaults={{
                            ...r,
                            weekday: String(r.weekday),
                            startTime: r.startTime.slice(0, 5),
                            endTime: r.endTime.slice(0, 5),
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!schedules.length && <p className="empty">No timetable configured.</p>}
            </div>
          </section>
        )}
        {tab === 'sessions' && (
          <SessionTable sessions={await listSessions(actor, { batchId: id })} />
        )}
        {!tab && (
          <details className="panel mt-6">
            <summary className="text-sm font-bold">Change teacher / advanced assignment</summary>
            <h2 className="mt-4 font-semibold">Teacher assignments</h2>
            <div className="mt-3 space-y-2">
              {assignments.map((a) => (
                <p key={a.email} className="muted">
                  {a.fullName} · {a.email}
                </p>
              ))}
              {!assignments.length && <p className="muted">No teachers assigned.</p>}
            </div>
            <AssignmentForm
              batchId={id}
              teachers={c.teachers
                .filter((t) => t.status === 'active')
                .map((t) => ({ value: t.id, label: t.fullName }))}
            />
          </details>
        )}
      </>
    );
  }
  return (
    <>
      <PageHeader title="Batches" description="Fixed groups, clear schedules, familiar faces.">
        <BatchSetup today={localDate()} />
      </PageHeader>
      <CommonQr />
      <Table heads={['Batch', 'Course', 'Dates', 'Status', '']} empty={!c.batches.length}>
        {c.batches.map((b) => (
          <tr key={b.id}>
            <td>
              <Link className="font-semibold text-[#3854AC]" href={`/admin/batches/${b.id}`}>
                {b.name}
              </Link>
            </td>
            <td>{b.courseName}</td>
            <td>
              {b.startDate} – {b.endDate ?? 'ongoing'}
            </td>
            <td>
              <Badge status={b.status} />
            </td>
            <td>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="font-semibold text-[#3854AC]"
                  href={`/admin/batches/${b.id}#common-qr`}
                >
                  Common attendance QR
                </Link>
                <Link href={`/admin/batches/${b.id}/students`}>Manage roster</Link>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
