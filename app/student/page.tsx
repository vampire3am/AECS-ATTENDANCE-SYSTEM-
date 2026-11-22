import { StudentPortal } from '@/components/attendance/student-portal';
export const metadata = { title: 'Student attendance', robots: { index: false, follow: false } };
export default function Students() {
  return <StudentPortal />;
}
