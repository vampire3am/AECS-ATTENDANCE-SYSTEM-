import { SessionCheckins } from '@/components/attendance/check-ins';
import { CommonQr } from '@/components/shared/common-qr';
import { AttendanceMarking } from '@/components/attendance/marking';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { OpenSession } from '@/components/shared/session-actions';
import { SignOut } from '@/components/shared/sign-out';
import { actorTransaction, requireActor, requireBatch } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { generateToday, getSession, listSessions } from '@/lib/services/attendance';
import { catalog } from '@/lib/services/queries';
import { localDate } from '@/lib/utils';
import { uuid } from '@/lib/validations';
import { and, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
export default async function TeacherPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const actor = await requireActor();
  const { path = [] } = await params;
  const [section, id] = path;
  const today = localDate();
  if (id && !uuid.safeParse(id).success) notFound();
  if (section === 'attendance' && id) {
    const model = await getSession(actor, id);
    return model.session.status === 'scheduled' ? (
      <>
        <PageHeader
          title={model.batch.name}
          description={`${model.session.sessionDate} · ${model.session.startTime.slice(0, 5)}`}
        />
        <OpenSession id={id} teacher />
      </>
    ) : (
      <>
        {model.session.status === 'open' && <SessionCheckins sessionId={id} />}
        <AttendanceMarking model={{ ...model, actorId: actor.id }} />
      </>
    );
  }
  if (section === 'profile')
    return (
      <>
        <PageHeader title="Your profile" description="Your AECS staff account" />
        <section className="panel space-y-4">
          <p className="font-semibold">{actor.fullName}</p>
          <p className="muted">{actor.email}</p>
          <p className="muted">{actor.phone ?? 'No phone provided'}</p>
          <p className="muted">Contact your administrator to update your profile or password.</p>
          <SignOut />
        </section>
      </>
    );
  if (section === 'classes' && id) {
    await actorTransaction(actor, (tx) => requireBatch(tx, actor, id));
    const c = await catalog(actor);
    const batch = c.batches.find((b) => b.id === id);
    if (!batch) notFound();
    const [roster, schedules] = await Promise.all([
      db
        .select({ id: s.students.id, name: s.students.fullName, code: s.students.studentCode })
        .from(s.enrollments)
        .innerJoin(s.students, eq(s.students.id, s.enrollments.studentId))
        .where(
          and(
            eq(s.enrollments.batchId, id),
            sql`${s.enrollments.enrolledOn}<=${today}::date and (${s.enrollments.endedOn} is null or ${s.enrollments.endedOn}>${today}::date)`,
          ),
        )
        .orderBy(s.students.fullName),
      db
        .select()
        .from(s.batchSchedules)
        .where(and(eq(s.batchSchedules.batchId, id), eq(s.batchSchedules.status, 'active'))),
    ]);
    return (
      <>
        <PageHeader title={batch.name} description={batch.courseName} />
        <CommonQr />
        <section className="panel mb-5">
          <h2 className="font-semibold">Weekly timetable</h2>
          {schedules.map((r) => (
            <p key={r.id} className="muted mt-3">
              {
                ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
                  r.weekday
                ]
              }{' '}
              · {r.startTime.slice(0, 5)}–{r.endTime.slice(0, 5)}
            </p>
          ))}
        </section>
        <section className="panel">
          <h2 className="font-semibold">Current roster · {roster.length}</h2>
          {roster.map((r) => (
            <div
              key={r.id}
              className="flex justify-between gap-3 border-b border-slate-100 py-4 text-sm"
            >
              <span>{r.name}</span>
              <span className="text-slate-400">{r.code}</span>
            </div>
          ))}
          {!roster.length && <p className="empty">No enrolled students yet.</p>}
        </section>
      </>
    );
  }
  if (section === 'classes') {
    const c = await catalog(actor);
    return (
      <>
        <PageHeader title="My classes" description="Your assigned batches" />
        <div className="grid gap-4 sm:grid-cols-2">
          {c.batches.map((b) => (
            <Link className="panel" key={b.id} href={`/teacher/classes/${b.id}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                {b.courseName}
              </p>
              <h2 className="mt-3 text-lg font-semibold text-[#072B62]">{b.name}</h2>
              <p className="muted mt-2">{b.code}</p>
              <div className="mt-4">
                <Badge status={b.status} />
              </div>
            </Link>
          ))}
        </div>
        {!c.batches.length && (
          <p className="panel empty">No classes assigned. Ask your admin to assign your batches.</p>
        )}
      </>
    );
  }
  if (section && section !== 'history') notFound();
  if (!section) await generateToday(actor);
  const allSessions = await listSessions(actor, section ? {} : { date: today });
  const sessions =
    section === 'history' ? allSessions.filter((s) => s.submittedBy === actor.id) : allSessions;
  return (
    <>
      <PageHeader
        title={section ? 'Session history' : `Hello, ${actor.fullName.split(' ')[0]}`}
        description={
          section
            ? 'Your assigned class sessions'
            : new Intl.DateTimeFormat('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'Asia/Kathmandu',
              }).format(new Date())
        }
      />
      {!section && (
        <section className="mb-6 rounded-2xl bg-[#072B62] p-5 text-white">
          <p className="text-sm text-blue-200">Your day at a glance</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <span className="text-4xl font-bold">
                {sessions.filter((s) => s.status !== 'cancelled').length}
              </span>
              <span className="ml-2 text-sm text-blue-100">classes today</span>
            </div>
            <span className="text-sm text-blue-100">
              {sessions.filter((s) => s.status === 'submitted').length} completed
            </span>
          </div>
        </section>
      )}
      <h2 className="mb-4 font-semibold">{section ? 'Recent sessions' : 'Today’s classes'}</h2>
      <div className="grid gap-4">
        {sessions.map((s) => (
          <article key={s.id} className="panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#072B62]">{s.batchName}</h3>
                <p className="mt-1 text-xs font-semibold text-orange-600">{s.courseName}</p>
                <p className="muted mt-1">
                  {section && `${s.date} · `}
                  {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                </p>
              </div>
              <Badge status={s.status} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{s.studentCount} students</p>
              {s.status === 'scheduled' ? (
                <OpenSession id={s.id} teacher />
              ) : s.status !== 'cancelled' ? (
                <Link
                  className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-[#072B62]"
                  href={`/teacher/attendance/${s.id}`}
                >
                  {s.status === 'open' ? 'Continue attendance' : 'View attendance'}
                </Link>
              ) : null}
            </div>
          </article>
        ))}
        {!sessions.length && (
          <section className="panel empty">
            {section
              ? 'Your sessions will appear here.'
              : 'No classes scheduled for today. You’re all caught up.'}
          </section>
        )}
      </div>
    </>
  );
}
