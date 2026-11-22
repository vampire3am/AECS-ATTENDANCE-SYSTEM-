import { ReportFilters } from '@/components/admin/report-filters';
import { PageHeader } from '@/components/shared/page-header';
import { parseReportFilters } from '@/lib/report-filters';
import { reportRows } from '@/lib/services/queries';
import { localDate } from '@/lib/utils';
import Link from 'next/link';
import type { PageContext } from './context';
import { Table } from './tables';
export async function ReportsPage({ q, c }: PageContext) {
  const filters = parseReportFilters(q);
  const rows = await reportRows(filters);
  const qs = new URLSearchParams(
    Object.entries(filters).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  return (
    <>
      <PageHeader
        title="Reports"
        description="Submitted attendance only. Excused sessions are excluded from eligible totals."
      >
        <div className="flex gap-2">
          <a
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
            href={`/api/reports?${qs}&format=xlsx`}
          >
            Export Excel
          </a>
          <a
            className="rounded-lg bg-[#3854AC] px-4 py-3 text-sm font-semibold text-white"
            href={`/api/reports?${qs}&format=pdf`}
          >
            Export PDF
          </a>
        </div>
      </PageHeader>
      <ReportFilters {...c} defaults={filters} />
      <Table
        heads={[
          'Student',
          'Course / batch',
          'Present',
          'Absent',
          'Late',
          'Excused',
          'Attendance',
          'Follow-up',
        ]}
        empty={!rows.length}
      >
        {rows.map((r) => (
          <tr key={`${r.student_id}:${r.batch_id}`}>
            <td>
              <Link
                href={`/admin/students/${r.student_id}`}
                className="font-semibold text-[#3854AC]"
              >
                {r.full_name}
              </Link>
              <p className="text-xs text-slate-400">{r.student_code}</p>
            </td>
            <td>
              {r.course_name}
              <p className="muted">{r.batch_name}</p>
            </td>
            <td>{r.present}</td>
            <td>{r.absent}</td>
            <td>{r.late}</td>
            <td>{r.excused}</td>
            <td className="font-semibold">{r.percentage === null ? '—' : `${r.percentage}%`}</td>
            <td>
              <div className="flex flex-wrap gap-1">
                {r.percentage !== null && r.percentage < Number(r.threshold) && (
                  <span className="badge" data-status="absent">
                    Below {r.threshold}%
                  </span>
                )}
                {r.consecutive_absences >= 2 && (
                  <span className="badge" data-status="late">
                    {r.consecutive_absences >= 3 ? '3+' : '2'} consecutive absences
                  </span>
                )}
                {r.followup_date &&
                  Date.parse(localDate()) - Date.parse(r.followup_date) >= 7 * 86400000 && (
                    <span className="badge">No attendance for 7 days</span>
                  )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <p className="muted mt-4">
        Monthly reports: choose the first and last day of the month. Export includes up to 5,000
        student/batch rows.
      </p>
    </>
  );
}
