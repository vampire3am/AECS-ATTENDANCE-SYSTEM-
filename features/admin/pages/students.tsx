import { CreateRecord } from '@/components/shared/create-record';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { studentFields } from '@/lib/form-fields';
import { reportRows, studentList } from '@/lib/services/queries';
import { and, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PageContext } from './context';
import { Table } from './tables';
export async function StudentsPage({ q, id }: PageContext) {
  if (id === 'new')
    return (
      <>
        <PageHeader
          title="Add student"
          description="A unique AECS student code is generated automatically."
        />
        <div className="panel max-w-xl">
          <CreateRecord entity="students" title="Add student" fields={studentFields} />
        </div>
      </>
    );
  if (id) {
    const [student] = await db.select().from(s.students).where(eq(s.students.id, id));
    if (!student) notFound();
    const [enrollment, report, history] = await Promise.all([
      db
        .select({ enrollment: s.enrollments, batch: s.batches })
        .from(s.enrollments)
        .innerJoin(s.batches, eq(s.batches.id, s.enrollments.batchId))
        .where(eq(s.enrollments.studentId, id)),
      reportRows({ studentId: id }),
      db
        .select({
          date: s.classSessions.sessionDate,
          batch: s.batches.name,
          status: s.attendanceRecords.status,
          sessionId: s.classSessions.id,
        })
        .from(s.attendanceRecords)
        .innerJoin(s.classSessions, eq(s.classSessions.id, s.attendanceRecords.sessionId))
        .innerJoin(s.batches, eq(s.batches.id, s.classSessions.batchId))
        .where(and(eq(s.attendanceRecords.studentId, id), eq(s.classSessions.status, 'submitted')))
        .orderBy(sql`${s.classSessions.sessionDate} desc`)
        .limit(100),
    ]);
    return (
      <>
        <PageHeader
          title={student.fullName}
          description={`${student.studentCode} · ${student.phone}`}
        >
          <CreateRecord
            entity="students"
            title="Edit student"
            id={id}
            defaults={student}
            fields={studentFields}
          />
        </PageHeader>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {report.map((r) => (
            <section className="panel" key={r.batch_id}>
              <p className="muted">
                {r.course_name} · {r.batch_name}
              </p>
              <p className="mt-3 text-3xl font-bold text-[#072B62]">
                {r.percentage === null ? '—' : `${r.percentage}%`}
              </p>
              <p className="muted">
                {r.eligible} eligible sessions · {r.excused} excused
              </p>
            </section>
          ))}
        </div>
        <h2 className="mb-3 font-semibold">Enrollments</h2>
        <Table heads={['Batch', 'From', 'Until', 'Status']} empty={!enrollment.length}>
          {enrollment.map((e) => (
            <tr key={e.enrollment.id}>
              <td>
                <Link href={`/admin/batches/${e.batch.id}/students`}>{e.batch.name}</Link>
              </td>
              <td>{e.enrollment.enrolledOn}</td>
              <td>{e.enrollment.endedOn ?? 'Ongoing'}</td>
              <td>
                <Badge status={e.enrollment.status} />
              </td>
            </tr>
          ))}
        </Table>
        <h2 className="mb-3 mt-7 font-semibold">Attendance history</h2>
        <Table heads={['Date', 'Batch', 'Status']} empty={!history.length}>
          {history.map((r, i) => (
            <tr key={i}>
              <td>
                <Link href={`/admin/attendance/${r.sessionId}`}>{r.date}</Link>
              </td>
              <td>{r.batch}</td>
              <td>
                <Badge status={r.status ?? 'unmarked'} />
              </td>
            </tr>
          ))}
        </Table>
      </>
    );
  }
  const page = Math.max(1, Math.min(10000, Number(q.page) || 1));
  const search = typeof q.search === 'string' ? q.search.slice(0, 150) : '';
  const status = typeof q.status === 'string' ? q.status : '';
  const list = await studentList(search, page, status);
  return (
    <>
      <PageHeader
        title="Students"
        description={`${list.total} students · Keep every learner in view`}
      >
        <CreateRecord entity="students" title="Add student" fields={studentFields} />
      </PageHeader>
      <form className="mb-5 flex flex-wrap gap-3">
        <input
          aria-label="Search students"
          name="search"
          defaultValue={search}
          placeholder="Search name, code or phone"
          className="input max-w-md"
        />
        <select
          name="status"
          aria-label="Student status"
          defaultValue={status}
          className="input max-w-40"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <button className="rounded-lg bg-[#072B62] px-5 py-2 text-white">Search</button>
      </form>
      <Table
        heads={['Student', 'Student code', 'Phone', 'Joined', 'Status', '']}
        empty={!list.rows.length}
      >
        {list.rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link className="font-semibold text-[#072B62]" href={`/admin/students/${r.id}`}>
                {r.fullName}
              </Link>
              <p className="text-xs text-slate-400">{r.email}</p>
            </td>
            <td>{r.studentCode}</td>
            <td>{r.phone}</td>
            <td>{r.joinedOn}</td>
            <td>
              <Badge status={r.status} />
            </td>
            <td>
              <CreateRecord
                entity="students"
                title="Edit"
                id={r.id}
                defaults={r}
                fields={studentFields}
              />
            </td>
          </tr>
        ))}
      </Table>
      <div className="mt-5 flex justify-between text-sm">
        <span>Page {page} · 25 per page</span>
        <div className="flex gap-5">
          {page > 1 && (
            <Link href={`?${new URLSearchParams({ search, status, page: String(page - 1) })}`}>
              Previous
            </Link>
          )}
          {page * 25 < list.total && (
            <Link href={`?${new URLSearchParams({ search, status, page: String(page + 1) })}`}>
              Next
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
