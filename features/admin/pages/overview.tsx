import dynamic from 'next/dynamic';
const Trend = dynamic(() => import('@/components/admin/trend').then((m) => m.Trend), {
  loading: () => (
    <div role="status" className="mt-6 h-56 animate-pulse rounded-xl bg-slate-100">
      {' '}
      <span className="sr-only">Loading analytics…</span>
    </div>
  ),
});
import { Badge, PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { requireActor } from '@/lib/auth/permissions';
import { listSessions } from '@/lib/services/attendance';
import { dashboard } from '@/lib/services/queries';
import { localDate } from '@/lib/utils';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Layers,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
export default async function Dashboard() {
  const actor = await requireActor(true);
  const [d, sessions] = await Promise.all([
    dashboard(),
    listSessions(actor, { date: localDate() }),
  ]);
  const metrics = [
    ['Active students', d.metrics.students, Users],
    ['Active courses', d.metrics.courses, BookOpen],
    ['Active batches', d.metrics.batches, Layers],
    ['Teachers', d.metrics.teachers, GraduationCap],
    ['Classes today', d.metrics.scheduled, CalendarDays],
    ['Completed sessions', d.metrics.completed, CheckCircle2],
    ['Present today', d.metrics.present, UserCheck],
    ['Absent today', d.metrics.absent, UserX],
  ] as const;
  return (
    <>
      <PageHeader title="A clear view of your day" description={`${localDate()} · Asia/Kathmandu`}>
        <Button asChild>
          <Link href="/admin/students/new">Add student</Link>
        </Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <section key={label} className="panel">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
              <Icon size={18} className="text-slate-400" />
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-[#3854AC]">{value}</p>
          </section>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold">Attendance overview</h2>
              <p className="muted mt-1">Submitted classes · Last 14 days</p>
            </div>
            <strong className="text-2xl text-[#3854AC]">
              {d.metrics.average === null ? '—' : `${d.metrics.average}%`}
            </strong>
          </div>
          <Trend data={d.trend} />
        </section>
        <section className="panel">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Students to follow up</h2>
            <span className="badge">{d.attention.length}</span>
          </div>
          <p className="muted mt-1">A little support can make a difference.</p>
          <div className="mt-4 space-y-4">
            {d.attention.slice(0, 5).map((r) => (
              <Link
                key={`${r.student_id}:${r.batch_id}`}
                href={`/admin/students/${r.student_id}`}
                className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3"
              >
                <div>
                  <p className="text-sm font-semibold">{r.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {r.batch_name} ·{' '}
                    {r.consecutive_absences >= 2
                      ? `${r.consecutive_absences} consecutive absences`
                      : 'Attendance follow-up'}
                  </p>
                </div>
                <span className="badge" data-status="absent">
                  {r.percentage === null ? '—' : `${r.percentage}%`}
                </span>
              </Link>
            ))}
            {!d.attention.length && (
              <p className="empty">No follow-up flags from submitted attendance.</p>
            )}
          </div>
        </section>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel !p-0">
          <div className="flex items-center justify-between p-6">
            <h2 className="font-semibold">Today’s classes</h2>
            <Link href="/admin/attendance" className="text-sm font-semibold text-[#3854AC]">
              View attendance
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Time</th>
                  <th>Students</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        className="font-semibold text-[#3854AC]"
                        href={`/admin/attendance/${s.id}`}
                      >
                        {s.batchName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">
                      {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                    </td>
                    <td>{s.studentCount}</td>
                    <td>
                      <Badge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sessions.length && (
              <p className="empty">
                No classes on today’s timetable. Add a batch schedule to get started.
              </p>
            )}
          </div>
        </section>
        <section className="panel">
          <h2 className="font-semibold">Batch performance</h2>
          <p className="muted mt-1">Attendance across submitted sessions</p>
          <div className="mt-6 space-y-5">
            {d.performance.map((b) => (
              <div key={b.name}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{b.name}</span>
                  <strong>{b.percentage ?? '—'}%</strong>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#3854AC]"
                    style={{ width: `${b.percentage ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
            {!d.performance.length && <p className="empty">No submitted sessions yet.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
