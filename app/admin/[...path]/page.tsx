import Overview from '@/features/admin/pages/overview';
import { AttendancePage } from '@/features/admin/pages/attendance';
import { AuditLogsPage } from '@/features/admin/pages/audit-logs';
import { BatchesPage } from '@/features/admin/pages/batches';
import type { PageContext, Search } from '@/features/admin/pages/context';
import { CoursesPage } from '@/features/admin/pages/courses';
import { ReportsPage } from '@/features/admin/pages/reports';
import { SettingsPage } from '@/features/admin/pages/settings';
import { StudentsPage } from '@/features/admin/pages/students';
import { TeachersPage } from '@/features/admin/pages/teachers';
import { requireActor } from '@/lib/auth/permissions';
import { catalog } from '@/lib/services/queries';
import { uuid } from '@/lib/validations';
import { notFound } from 'next/navigation';
const pages: Record<string, (ctx: PageContext) => Promise<React.ReactNode>> = {
  students: StudentsPage,
  overview: Overview,
  courses: CoursesPage,
  batches: BatchesPage,
  teachers: TeachersPage,
  attendance: AttendancePage,
  reports: ReportsPage,
  'audit-logs': AuditLogsPage,
  settings: SettingsPage,
};
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Search>;
}) {
  const actor = await requireActor(true);
  const { path } = await params;
  const q = await searchParams;
  const [section, id, tab] = path;
  if (id && id !== 'new' && !uuid.safeParse(id).success) notFound();
  const Page = pages[section];
  if (!Page || path.length > 3) notFound();
  const include: ('batches' | 'courses' | 'teachers')[] =
    ['settings', 'audit-logs', 'overview'].includes(section) || (section === 'attendance' && id)
      ? []
      : section === 'batches' && !id
        ? ['batches']
        : section === 'students'
          ? ['batches']
          : section === 'courses'
            ? ['courses']
            : section === 'teachers'
              ? ['teachers', 'courses']
              : ['batches', 'courses', 'teachers'];
  const c = await catalog(actor, include);
  return <Page actor={actor} q={q} id={id} tab={tab} c={c} />;
}
