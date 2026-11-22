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
        .where(and(eq(s.teacherAssignments.batchId, id), eq(s.teacherAssignments.active, true))),
    ]);
    return (
      <>
        <PageHeader title={batch.name} description={`${batch.courseName} · ${batch.code}`}>
          <CreateRecord
            entity="batches"
            title="Edit batch"
            id={id}
            defaults={batch}
            fields={batchFields(c.courses)}
          />
        </PageHeader>
        <CommonQr />
        <div className="mb-6 flex flex-wrap gap-2">
          {['overview', 'students', 'schedule', 'sessions'].map((t) => (
            <Link
              key={t}
              href={`/admin/batches/${id}${t === 'overview' ? '' : '/' + t}`}
              className={`rounded-lg px-4 py-2 text-sm capitalize ${(tab ?? 'overview') === t ? 'bg-[#072B62] text-white' : 'bg-white text-slate-600'}`}
            >
              {t}
            </Link>
          ))}
        </div>
        {(!tab || tab === 'students') && (
          <>
            <Table
              heads={['Student', 'Enrollment code', 'Enrollment', 'Status']}
              empty={!enrollment.length}
            >
              {enrollment.map((r) => (
                <tr key={r.enrollment.id}>
                  <td>
                    <Link
                      href={`/admin/students/${r.student.id}`}
                      className="font-semibold text-[#072B62]"
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
            <div className="mt-6">
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
            </div>
          </>
        )}
        {(!tab || tab === 'schedule') && (
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
          <section className="panel mt-6 max-w-lg">
            <h2 className="font-semibold">Teacher assignments</h2>
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
          </section>
        )}
      </>
    );
  }
  return (
    <>
      <PageHeader title="Batches" description="Fixed groups, clear schedules, familiar faces.">
        <CreateRecord
          entity="batches"
          title="Add batch"
          fields={batchFields(c.courses.filter((c) => c.status === 'active'))}
        />
      </PageHeader>
      <CommonQr />
      <Table heads={['Batch', 'Course', 'Dates', 'Status', '']} empty={!c.batches.length}>
        {c.batches.map((b) => (
          <tr key={b.id}>
            <td>
              <Link className="font-semibold text-[#072B62]" href={`/admin/batches/${b.id}`}>
                {b.name}
              </Link>
              <p className="text-xs text-slate-400">{b.code}</p>
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
                  className="font-semibold text-[#072B62]"
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
