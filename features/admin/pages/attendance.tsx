import { SessionCheckins } from '@/components/attendance/check-ins';
import { ReportFilters } from '@/components/admin/report-filters';
import { AttendanceMarking } from '@/components/attendance/marking';
import { Badge, PageHeader } from '@/components/shared/page-header';
import {
  CancelSession,
  CorrectRecord,
  GenerateSessions,
  OpenSession,
} from '@/components/shared/session-actions';
import { parseReportFilters } from '@/lib/report-filters';
import { getSession, listSessions } from '@/lib/services/attendance';
import type { PageContext } from './context';
import { SessionTable, Table } from './tables';
export async function AttendancePage({ actor, q, id, c }: PageContext) {
  if (id) {
    const model = await getSession(actor, id);
    return (
      <>
        <PageHeader
          title="Session attendance"
          description={`${model.batch.name} · ${model.session.sessionDate}`}
        >
          {['scheduled', 'open'].includes(model.session.status) && <CancelSession id={id} />}
        </PageHeader>
        {model.session.status === 'scheduled' ? (
          <section className="panel">
            <OpenSession id={id} />
          </section>
        ) : model.session.status === 'open' ? (
          <>
            <SessionCheckins sessionId={id} />
            <AttendanceMarking model={{ ...model, actorId: actor.id }} />
          </>
        ) : (
          <>
            <Badge status={model.session.status} />
            <div className="mt-5">
              <Table heads={['Student', 'Code', 'Status', '']} empty={!model.records.length}>
                {model.records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fullName}</td>
                    <td>{r.studentCode}</td>
                    <td>
                      <Badge status={r.status ?? 'unmarked'} />
                    </td>
                    <td>{model.session.status === 'submitted' && <CorrectRecord id={r.id} />}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </>
        )}
      </>
    );
  }
  const filters = parseReportFilters(q);
  const sessions = await listSessions(actor, {
    batchId: filters.batchId,
    courseId: filters.courseId,
    teacherId: filters.teacherId,
  });
  const filtered = sessions.filter(
    (r) => (!filters.from || r.date >= filters.from) && (!filters.to || r.date <= filters.to),
  );
  return (
    <>
      <PageHeader title="Attendance" description="Every class, from scheduled to submitted.">
        <GenerateSessions />
      </PageHeader>
      <ReportFilters {...c} defaults={filters} />
      <SessionTable sessions={filtered} />
      <p className="muted mt-3">Showing up to 200 most recent sessions.</p>
    </>
  );
}
