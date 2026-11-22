import { Badge } from '@/components/shared/page-header';
import { listSessions } from '@/lib/services/attendance';
import Link from 'next/link';
export function Table({
  heads,
  children,
  empty,
}: {
  heads: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="panel !p-0">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {heads.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
        {empty && <p className="empty">No records yet. Add your first record to get started.</p>}
      </div>
    </div>
  );
}
export function SessionTable({ sessions }: { sessions: Awaited<ReturnType<typeof listSessions>> }) {
  return (
    <Table heads={['Date', 'Batch', 'Time', 'Status', '']} empty={!sessions.length}>
      {sessions.map((r) => (
        <tr key={r.id}>
          <td>{r.date}</td>
          <td className="font-semibold">{r.batchName}</td>
          <td className="whitespace-nowrap">
            {r.startTime.slice(0, 5)}–{r.endTime.slice(0, 5)}
          </td>
          <td>
            <Badge status={r.status} />
          </td>
          <td>
            <Link className="font-semibold text-[#072B62]" href={`/admin/attendance/${r.id}`}>
              View session
            </Link>
          </td>
        </tr>
      ))}
    </Table>
  );
}
