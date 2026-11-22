'use client';
import {
  BookOpen,
  ChartNoAxesCombined,
  ClipboardCheck,
  GraduationCap,
  History,
  House,
  Layers,
  LayoutDashboard,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const icons = {
  dashboard: LayoutDashboard,
  students: Users,
  courses: BookOpen,
  batches: Layers,
  teachers: GraduationCap,
  attendance: ClipboardCheck,
  reports: ChartNoAxesCombined,
  'audit-logs': History,
  settings: Settings,
  home: House,
  classes: BookOpen,
  history: History,
  profile: UserRound,
};
export function Nav({ teacher = false }: { teacher?: boolean }) {
  const pathname = usePathname();
  const items = teacher
    ? [
        ['home', 'Home', '/teacher'],
        ['classes', 'My classes', '/teacher/classes'],
        ['history', 'History', '/teacher/history'],
        ['profile', 'Profile', '/teacher/profile'],
      ]
    : Object.keys(icons)
        .slice(0, 9)
        .map((key) => [
          key,
          key === 'audit-logs' ? 'Audit history' : key[0].toUpperCase() + key.slice(1),
          `/admin/${key}`,
        ]);
  return (
    <nav
      aria-label={teacher ? 'Teacher navigation' : 'Administration'}
      className={
        teacher
          ? 'flex justify-around gap-1'
          : 'grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1'
      }
    >
      {items.map(([key, label, href]) => {
        const Icon = icons[key as keyof typeof icons];
        const active =
          pathname === href || (href !== '/teacher' && pathname.startsWith(href + '/'));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              teacher
                ? `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium ${active ? 'bg-blue-50 text-[#3854AC]' : 'text-slate-500'}`
                : `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? 'bg-[#eef1fb] text-[#3854AC] shadow-[inset_3px_0_0_#ED7824]' : 'text-slate-600 hover:bg-slate-100'}`
            }
          >
            <Icon size={19} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
