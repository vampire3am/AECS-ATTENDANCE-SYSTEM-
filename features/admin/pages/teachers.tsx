import { CreateRecord } from '@/components/shared/create-record';
import { AddTeacher } from '@/components/workflows/add-teacher';
import { TeacherCourseAccess } from '@/components/workflows/teacher-course-access';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { teacherFields } from '@/lib/form-fields';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import type { PageContext } from './context';
import { Table } from './tables';
export async function TeachersPage({ c }: PageContext) {
  const courseGrants = await db
    .select({
      teacherId: s.teacherCourseAssignments.teacherId,
      courseId: s.teacherCourseAssignments.courseId,
    })
    .from(s.teacherCourseAssignments)
    .where(eq(s.teacherCourseAssignments.active, true));
  const assignments = await db
    .select({
      teacherId: s.teacherAssignments.teacherId,
      batchId: s.batches.id,
      batchName: s.batches.name,
    })
    .from(s.teacherAssignments)
    .innerJoin(s.batches, eq(s.batches.id, s.teacherAssignments.batchId))
    .where(eq(s.teacherAssignments.active, true));
  return (
    <>
      <PageHeader title="Teachers" description="Individual accounts. Clear responsibilities.">
        <AddTeacher />
      </PageHeader>
      <Table
        heads={['Teacher', 'Contact', 'Assigned batches', 'Course access', 'Status', '']}
        empty={!c.teachers.length}
      >
        {c.teachers.map((t) => (
          <tr key={t.id}>
            <td className="font-semibold">{t.fullName}</td>
            <td>
              {t.email}
              <p className="muted">{t.phone}</p>
            </td>
            <td>
              {assignments
                .filter((a) => a.teacherId === t.id)
                .map((a) => (
                  <Link
                    key={a.batchId}
                    className="mr-3 inline-block text-[#3854AC]"
                    href={`/admin/batches/${a.batchId}`}
                  >
                    {a.batchName}
                  </Link>
                ))}
            </td>
            <td>
              <TeacherCourseAccess
                teacherId={t.id}
                courses={c.courses.filter((course) => course.status === 'active')}
                selected={courseGrants
                  .filter((grant) => grant.teacherId === t.id)
                  .map((grant) => grant.courseId)}
              />
            </td>
            <td>
              <Badge status={t.status} />
            </td>
            <td>
              <CreateRecord
                entity="teachers"
                title="Edit"
                id={t.id}
                defaults={t}
                fields={teacherFields(true)}
              />
            </td>
          </tr>
        ))}
      </Table>
      <p className="muted mt-4">
        Assign teachers from a batch’s overview. Editing an account revokes its existing sessions.
      </p>
    </>
  );
}
