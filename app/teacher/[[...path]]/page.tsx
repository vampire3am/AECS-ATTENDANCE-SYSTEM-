import Link from 'next/link';
import { Today } from '@/features/today/page';
import { SessionCheckins } from '@/components/attendance/check-ins';
import { AttendanceMarking } from '@/components/attendance/marking';
import { CommonQr } from '@/components/shared/common-qr';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { CreateRecord } from '@/components/shared/create-record';
import { EnrollmentCode } from '@/components/shared/enrollment-code';
import { EnrollmentForms, OpenSession } from '@/components/shared/session-actions';
import { SignOut } from '@/components/shared/sign-out';
import { BatchSetup } from '@/components/workflows/batch-setup';
import { AddStudent } from '@/components/workflows/add-student';
import { Button } from '@/components/ui/button';
import { Table } from '@/features/admin/pages/tables';
import { requirePageActor } from '@/lib/auth/permissions';
import { getSession, listSessions } from '@/lib/services/attendance';
import { teacherBatch, teacherStudents } from '@/lib/services/teacher-workspace';
import { catalog, reportRows } from '@/lib/services/queries';
import { batchFields, scheduleFields } from '@/lib/form-fields';
import { parseReportFilters } from '@/lib/report-filters';
import { localDate } from '@/lib/utils';
import { uuid } from '@/lib/validations';
import { notFound } from 'next/navigation';

export default async function TeacherPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageActor();
  const { path = [] } = await params;
  const [section, id] = path;
  if (path.length > 2 || (id && !uuid.safeParse(id).success)) notFound();
  if (!section) return <Today actor={actor} />;
  if (section === 'profile' && !id)
    return (
      <>
        <PageHeader title="Your account" description="Your private AECS staff workspace" />
        <section className="panel space-y-4">
          <p className="font-bold">{actor.fullName}</p>
          <p className="break-all text-sm">{actor.email}</p>
          <p className="muted">Ask your admin to change your password or course access.</p>
          <SignOut />
        </section>
      </>
    );
  if (section === 'attendance' && id) {
    const model = await getSession(actor, id);
    return (
      <>
        <Link
          href="/teacher"
          className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#3854ac]"
        >
          ← Back to Today
        </Link>
        {model.session.status === 'scheduled' ? (
          <>
            <PageHeader title={model.batch.name} description={model.session.sessionDate} />
            <OpenSession id={id} teacher />
          </>
        ) : (
          <AttendanceMarking model={{ ...model, actorId: actor.id }}>
            {model.session.status === 'open' && <SessionCheckins sessionId={id} />}
          </AttendanceMarking>
        )}
      </>
    );
  }
  if (section === 'students' && !id) {
    const [rows, c] = await Promise.all([teacherStudents(actor), catalog(actor, ['batches'])]);
    return (
      <>
        <PageHeader
          title="My students"
          description="Only students enrolled in your assigned batches appear here."
        >
          <AddStudent teacher batches={c.batches.filter((b) => b.status === 'active')} />
        </PageHeader>
        <Table heads={['Student', 'Your batch', 'Private enrollment code']} empty={!rows.length}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <p className="font-bold">{r.fullName}</p>
                <p className="muted">{r.phone}</p>
              </td>
              <td>
                <Link href={'/teacher/classes/' + r.batchId}>
                  {r.courseName} · {r.batchName}
                </Link>
              </td>
              <td>
                <EnrollmentCode
                  code={r.code}
                  recipient={{
                    studentName: r.fullName,
                    phone: r.phone,
                    courseName: r.courseName,
                    batchName: r.batchName,
                  }}
                />
              </td>
            </tr>
          ))}
        </Table>
      </>
    );
  }
  if (section === 'classes' && id) {
    const [{ batch, schedules }, roster, c] = await Promise.all([
      teacherBatch(actor, id),
      teacherStudents(actor, id),
      catalog(actor, ['batches']),
    ]);
    const visible = await teacherStudents(actor);
    const students = [
      ...new Map(
        visible.map((r) => [r.studentId, { value: r.studentId, label: r.fullName }]),
      ).values(),
    ];
    return (
      <>
        <PageHeader title={batch.name} description={batch.courseName}>
          <AddStudent
            teacher
            batches={c.batches.filter((b) => b.status === 'active')}
            batchId={id}
          />
        </PageHeader>
        <CommonQr />
        <section className="mb-6">
          <h2 className="mb-3 font-bold">Your batch students</h2>
          <Table
            heads={['Student', 'Phone', 'Private code', 'Enrolled from']}
            empty={!roster.length}
          >
            {roster.map((r) => (
              <tr key={r.id}>
                <td className="font-bold">{r.fullName}</td>
                <td>{r.phone}</td>
                <td>
                  <EnrollmentCode
                    code={r.code}
                    recipient={{
                      studentName: r.fullName,
                      phone: r.phone,
                      courseName: r.courseName,
                      batchName: r.batchName,
                    }}
                  />
                </td>
                <td>{r.enrolledOn}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section className="panel mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Weekly timetable</h2>
            <CreateRecord
              entity="schedules"
              title="Add class time"
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
                  <th>Day</th>
                  <th>Time</th>
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
          </div>
          {!schedules.length && <p className="empty">Add the days and times this batch meets.</p>}
        </section>
        <details className="mb-6">
          <summary className="min-h-11 py-3 text-sm font-bold text-slate-500">
            Transfer or end an enrollment
          </summary>
          <EnrollmentForms
            batchId={id}
            students={students}
            batches={c.batches
              .filter((b) => b.id !== id && b.courseId === batch.courseId && b.status === 'active')
              .map((b) => ({ value: b.id, label: b.name }))}
            enrollments={roster.map((r) => ({ id: r.id, label: r.fullName }))}
          />
        </details>
        <details className="panel">
          <summary className="font-bold">Batch settings</summary>
          <div className="mt-4">
            <CreateRecord
              entity="batches"
              title="Edit batch"
              id={id}
              defaults={batch}
              fields={batchFields([{ id: batch.courseId, name: batch.courseName }])}
            />
          </div>
        </details>
      </>
    );
  }
  if (section === 'classes' && !id) {
    const c = await catalog(actor, ['batches']);
    return (
      <>
        <PageHeader
          title="My batches"
          description="Batches you create or your admin assigns to you."
        >
          <BatchSetup today={localDate()} />
        </PageHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {c.batches.map((b) => (
            <Link key={b.id} className="panel" href={'/teacher/classes/' + b.id}>
              <p className="eyebrow">{b.courseName}</p>
              <h2 className="mt-2 text-lg font-bold">{b.name}</h2>
              <p className="muted mt-2">Students, class times and batch settings →</p>
            </Link>
          ))}
        </div>
        {!c.batches.length && (
          <p className="panel empty">
            No batches yet. Create a batch in an assigned course, or ask your admin for access.
          </p>
        )}
      </>
    );
  }
  if (section === 'reports' && !id) {
    const filters = parseReportFilters(await searchParams);
    const [rows, c] = await Promise.all([reportRows(filters, actor), catalog(actor, ['batches'])]);
    const qs = new URLSearchParams(
      Object.entries(filters).filter((v): v is [string, string] => typeof v[1] === 'string'),
    );
    return (
      <>
        <PageHeader title="My reports" description="Attendance for your assigned batches only." />
        <form className="panel mb-6 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold">
            Batch
            <select name="batchId" className="input" defaultValue={filters.batchId ?? ''}>
              <option value="">All my batches</option>
              {c.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            From
            <input name="from" type="date" className="input" defaultValue={filters.from} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Until
            <input name="to" type="date" className="input" defaultValue={filters.to} />
          </label>
          <Button type="submit">Apply filters</Button>
        </form>
        <div className="mb-5 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <a href={'/api/reports?' + qs + '&format=xlsx'}>Download Excel</a>
          </Button>
          <Button asChild variant="outline">
            <a href={'/api/reports?' + qs + '&format=pdf'}>Download PDF</a>
          </Button>
          <Link
            href="/teacher/history"
            className="inline-flex min-h-11 items-center text-sm font-bold text-[#3854ac]"
          >
            Class history →
          </Link>
        </div>
        <Table heads={['Student', 'Batch', 'Present', 'Absent', 'Attendance']} empty={!rows.length}>
          {rows.map((r) => (
            <tr key={r.student_id + ':' + r.batch_id}>
              <td>{r.full_name}</td>
              <td>{r.batch_name}</td>
              <td>{r.present}</td>
              <td>{r.absent}</td>
              <td>{r.percentage === null ? '—' : r.percentage + '%'}</td>
            </tr>
          ))}
        </Table>
      </>
    );
  }
  if (section === 'history' && !id) {
    const sessions = await listSessions(actor);
    return (
      <>
        <PageHeader title="Class history" description="Sessions in your assigned batches only." />
        <div className="grid gap-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={'/teacher/attendance/' + s.id}
              className="panel flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <h2 className="font-bold">{s.batchName}</h2>
                <p className="muted">
                  {s.date} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                </p>
              </div>
              <Badge status={s.status} />
            </Link>
          ))}
        </div>
        {!sessions.length && (
          <p className="panel empty">Start a class from Today to see it here.</p>
        )}
      </>
    );
  }
  notFound();
}
