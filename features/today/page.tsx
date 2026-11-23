import Link from 'next/link';
import { BookOpen, CalendarDays, Users } from 'lucide-react';
import { type Actor } from '@/lib/auth/permissions';
import { todayBatches } from '@/lib/services/workflows';
import { catalog } from '@/lib/services/queries';
import { localDate } from '@/lib/utils';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { CommonQr } from '@/components/shared/common-qr';
import { Button } from '@/components/ui/button';
import { BatchSetup } from '@/components/workflows/batch-setup';
import { AddStudent } from '@/components/workflows/add-student';
import { StartClass } from '@/components/workflows/start-class';

export async function Today({ actor }: { actor: Actor }) {
  const teacher = actor.role === 'teacher';
  const [batches, options] = await Promise.all([
    todayBatches(actor),
    teacher ? Promise.resolve(null) : catalog(actor, ['courses', 'teachers']),
  ]);
  const today = localDate(),
    base = teacher ? '/teacher' : '/admin';
  const choices = batches.map((b) => ({ id: b.id, name: b.name, courseName: b.courseName }));
  return (
    <>
      <PageHeader
        title="Today"
        description={
          new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'Asia/Kathmandu',
          }).format(new Date()) + ' · Nepal time'
        }
      >
        {options && (
          <div className="flex flex-wrap gap-2">
            <AddStudent batches={choices} />
            <BatchSetup
              courses={options.courses.filter((c) => c.status === 'active')}
              teachers={options.teachers
                .filter((t) => t.status === 'active')
                .map((t) => ({ id: t.id, name: t.fullName }))}
              today={today}
            />
          </div>
        )}
      </PageHeader>
      <section className="mb-6 rounded-2xl border border-[#dfe5f6] bg-[#eef1fb] p-5 sm:p-6">
        <p className="eyebrow !text-[#3854ac]">Your daily routine</p>
        <h2 className="mt-2 text-lg font-extrabold tracking-tight text-[#253963]">
          Start a class. Confirm students. Finish attendance.
        </h2>
        <p className="muted mt-2">
          Students use the same AECS QR. Their private code sends each check-in to the right batch.
        </p>
      </section>
      <CommonQr />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-[#253963]">Your batches</h2>
        <span className="text-xs text-slate-500">{batches.length} active</span>
      </div>
      {!batches.length ? (
        <section className="panel !py-12 text-center">
          <BookOpen size={30} className="mx-auto text-[#8092c6]" />
          <h2 className="mt-4 text-lg font-bold">
            {teacher ? 'No batches assigned yet' : 'Let’s set up your first class'}
          </h2>
          <p className="muted mx-auto mt-2 max-w-sm">
            {teacher
              ? 'Ask your admin to assign a batch to your account.'
              : 'Create one batch with its course, teacher and class times. Then add your students—you’re ready to start.'}
          </p>
          {options && (
            <div className="mt-6">
              <BatchSetup
                courses={options.courses.filter((c) => c.status === 'active')}
                teachers={options.teachers
                  .filter((t) => t.status === 'active')
                  .map((t) => ({ id: t.id, name: t.fullName }))}
                today={today}
              />
            </div>
          )}
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {batches.map((b) => {
            const running = b.sessions.find((s) => s.status === 'open');
            const eligible = b.startDate <= today && (!b.endDate || b.endDate >= today);
            return (
              <article key={b.id} className="panel flex flex-col !p-5 sm:!p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow !text-[#a35a29]">{b.courseName}</p>
                    <h3 className="mt-1 text-lg font-extrabold">{b.name}</h3>
                  </div>
                  {running && <Badge status="open" />}
                </div>
                <p className="muted mt-1">{b.teacherNames}</p>
                <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Users size={15} />
                  {b.studentCount} enrolled students
                </p>
                <div className="mt-5 flex-1 space-y-3 border-t border-slate-100 pt-4">
                  {running ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Class in progress</p>
                      <Button asChild>
                        <Link href={base + '/attendance/' + running.id}>Continue class →</Link>
                      </Button>
                    </div>
                  ) : b.schedules.length ? (
                    b.schedules.map((slot) => {
                      const session = b.sessions.find((s) => s.startTime === slot.startTime);
                      return (
                        <div
                          key={slot.id}
                          className="flex flex-wrap items-center justify-between gap-3"
                        >
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <CalendarDays size={15} className="text-slate-400" />
                            {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                          </p>
                          {session && ['submitted', 'cancelled'].includes(session.status) ? (
                            <Link
                              className="text-xs font-bold text-[#3854ac]"
                              href={base + '/attendance/' + session.id}
                            >
                              {session.status === 'submitted'
                                ? 'View completed class'
                                : 'View cancelled class'}{' '}
                              →
                            </Link>
                          ) : (
                            <StartClass
                              batchId={b.id}
                              scheduleId={slot.id}
                              teacher={teacher}
                              disabled={!eligible || !b.studentCount}
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="muted">No regular class today</p>
                      <StartClass
                        batchId={b.id}
                        teacher={teacher}
                        disabled={!eligible || !b.studentCount}
                      />
                    </div>
                  )}
                  {!running &&
                    b.sessions
                      .filter(
                        (session) =>
                          session.status === 'submitted' &&
                          !b.schedules.some((slot) => slot.startTime === session.startTime),
                      )
                      .map((session) => (
                        <Link
                          key={session.id}
                          href={base + '/attendance/' + session.id}
                          className="block text-xs font-semibold text-[#3854ac]"
                        >
                          Completed · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}{' '}
                          · View attendance →
                        </Link>
                      ))}
                  {!eligible && (
                    <p className="text-xs text-amber-700">
                      {b.startDate > today
                        ? 'Batch starts ' + b.startDate
                        : 'This batch has ended.'}
                    </p>
                  )}
                  {!b.studentCount && !teacher && (
                    <p className="text-xs text-slate-500">
                      Add students before starting this class.
                    </p>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={teacher ? '/teacher/classes/' + b.id : '/admin/batches/' + b.id}
                    className="text-xs font-semibold text-slate-500 hover:text-[#3854ac]"
                  >
                    Manage batch →
                  </Link>
                  {!teacher && <AddStudent batches={choices} batchId={b.id} />}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
