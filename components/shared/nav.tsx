'use client';
import {
  BookOpen,
  ChartNoAxesCombined,
  ClipboardCheck,
  GraduationCap,
  History,
  House,
  Layers,
  Settings,
  UserRound,
  Users,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const icons = {
  home: House,
  students: Users,
  batches: Layers,
  courses: BookOpen,
  teachers: GraduationCap,
  attendance: ClipboardCheck,
  reports: ChartNoAxesCombined,
  overview: ChartNoAxesCombined,
  'audit-logs': History,
  settings: Settings,
  classes: BookOpen,
  history: History,
  profile: UserRound,
};
const main = [
  ['home', 'Today', '/admin/dashboard'],
  ['students', 'Students', '/admin/students'],
  ['batches', 'Batches', '/admin/batches'],
];
const management = [
  ['teachers', 'Teachers', '/admin/teachers'],
  ['courses', 'Courses', '/admin/courses'],
  ['attendance', 'Attendance history', '/admin/attendance'],
  ['reports', 'Reports & exports', '/admin/reports'],
  ['overview', 'Analytics', '/admin/overview'],
  ['audit-logs', 'Audit history', '/admin/audit-logs'],
  ['settings', 'Settings', '/admin/settings'],
];
export function Nav({ teacher = false }: { teacher?: boolean }) {
  const pathname = usePathname();
  const teacherItems = [
    ['home', 'Today', '/teacher'],
    ['classes', 'My batches', '/teacher/classes'],
    ['students', 'Students', '/teacher/students'],
    ['reports', 'Reports', '/teacher/reports'],
    ['profile', 'Account', '/teacher/profile'],
  ];
  function renderItem([key, label, href]: string[]) {
    const Icon = icons[key as keyof typeof icons];
    const classPage = pathname.startsWith(teacher ? '/teacher/attendance/' : '/admin/attendance/');
    const active =
      (key === 'home' && classPage) ||
      pathname === href ||
      (key !== 'attendance' && href !== '/teacher' && pathname.startsWith(href + '/'));
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={
          teacher
            ? `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium ${active ? 'bg-blue-50 text-[#3854AC]' : 'text-slate-500'}`
            : `flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? 'bg-[#eef1fb] text-[#3854AC] shadow-[inset_3px_0_0_#ED7824]' : 'text-slate-600 hover:bg-slate-100'}`
        }
      >
        <Icon size={19} />
        {label}
      </Link>
    );
  }
  return (
    <nav aria-label={teacher ? 'Teacher navigation' : 'Administration'}>
      {teacher ? (
        <div className="flex justify-around gap-1">{teacherItems.map(renderItem)}</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 lg:grid-cols-1">{main.map(renderItem)}</div>
          <details
            className="mt-5 border-t border-slate-100 pt-3"
            open={
              management.some(
                ([key, , href]) =>
                  pathname === href || (key !== 'attendance' && pathname.startsWith(href + '/')),
              ) || undefined
            }
          >
            <summary className="flex min-h-11 items-center justify-between px-3 text-xs font-bold uppercase tracking-widest text-slate-400">
              Manage
              <ChevronDown size={14} />
            </summary>
            <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {management.map(renderItem)}
            </div>
          </details>
        </>
      )}
    </nav>
  );
}
