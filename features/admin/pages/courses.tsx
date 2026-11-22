import { CreateRecord } from '@/components/shared/create-record';
import { Badge, PageHeader } from '@/components/shared/page-header';
import { courseFields } from '@/lib/form-fields';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PageContext } from './context';
import { Table } from './tables';
export async function CoursesPage({ id, c }: PageContext) {
  if (id) {
    const course = c.courses.find((v) => v.id === id);
    if (!course) notFound();
    const batches = c.batches.filter((b) => b.courseId === id);
    return (
      <>
        <PageHeader title={course.name} description={course.description ?? course.code}>
          <CreateRecord
            entity="courses"
            title="Edit course"
            id={id}
            defaults={course}
            fields={courseFields}
          />
        </PageHeader>
        <Table heads={['Batch', 'Code', 'Start', 'Status']} empty={!batches.length}>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>
                <Link href={`/admin/batches/${b.id}`}>{b.name}</Link>
              </td>
              <td>{b.code}</td>
              <td>{b.startDate}</td>
              <td>
                <Badge status={b.status} />
              </td>
            </tr>
          ))}
        </Table>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Courses" description="Build a focused learning catalog.">
        <CreateRecord entity="courses" title="Add course" fields={courseFields} />
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {c.courses.map((r) => (
          <article key={r.id} className="panel">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-blue-50 p-2 text-sm font-bold text-[#072B62]">
                {r.code}
              </span>
              <Badge status={r.status} />
            </div>
            <h2 className="mt-6 text-lg font-semibold">
              <Link href={`/admin/courses/${r.id}`}>{r.name}</Link>
            </h2>
            <p className="muted mt-2">{r.description || 'No description provided.'}</p>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="muted">
                {c.batches.filter((b) => b.courseId === r.id).length} batches
              </span>
              <CreateRecord
                entity="courses"
                title="Edit"
                id={r.id}
                defaults={r}
                fields={courseFields}
              />
            </div>
          </article>
        ))}
      </div>
      {!c.courses.length && (
        <p className="panel empty">Add a course to begin organizing your batches.</p>
      )}
    </>
  );
}
