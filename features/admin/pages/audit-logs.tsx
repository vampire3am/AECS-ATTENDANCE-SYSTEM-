import { PageHeader } from '@/components/shared/page-header';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { Table } from './tables';
export async function AuditLogsPage() {
  const rows = await db
    .select({ log: s.auditLogs, actor: s.profiles.fullName })
    .from(s.auditLogs)
    .leftJoin(s.profiles, eq(s.profiles.id, s.auditLogs.actorId))
    .orderBy(sql`${s.auditLogs.createdAt} desc`)
    .limit(200);
  return (
    <>
      <PageHeader
        title="Audit history"
        description="Append-only history of attendance, enrollment and administrative changes."
      />
      <Table
        heads={['Time (Nepal)', 'Actor', 'Action', 'Entity', 'Reason / Details']}
        empty={!rows.length}
      >
        {rows.map(({ log, actor }) => (
          <tr key={log.id}>
            <td className="whitespace-nowrap">
              {log.createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })}
            </td>
            <td>{actor ?? 'System'}</td>
            <td>{log.action.replaceAll('_', ' ')}</td>
            <td>{log.entityType}</td>
            <td>
              <p>{log.reason ?? '—'}</p>
              {Object.keys(log.metadata).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-[#072B62]">View details</summary>
                  <pre className="mt-2 max-w-96 overflow-x-auto text-xs">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <p className="muted mt-4">Showing the 200 latest events.</p>
    </>
  );
}
