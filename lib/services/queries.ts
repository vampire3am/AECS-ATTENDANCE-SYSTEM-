import { teacherBatchScope, type Actor } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { localDate } from '@/lib/utils';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
export async function catalog(
  actor: Actor,
  include: ('batches' | 'courses' | 'teachers')[] = ['batches', 'courses', 'teachers'],
) {
  const assigned = actor.role === 'teacher' ? teacherBatchScope(actor.id, s.batches.id) : undefined;
  const batchesQuery = include.includes('batches')
    ? db
        .select({
          id: s.batches.id,
          name: s.batches.name,
          code: s.batches.code,
          courseId: s.batches.courseId,
          courseName: s.courses.name,
          startDate: s.batches.startDate,
          endDate: s.batches.endDate,
          status: s.batches.status,
        })
        .from(s.batches)
        .innerJoin(s.courses, eq(s.courses.id, s.batches.courseId))
        .where(assigned)
        .orderBy(s.batches.name)
    : Promise.resolve([]);
  const coursesQuery = include.includes('courses')
    ? db
        .select({
          id: s.courses.id,
          name: s.courses.name,
          code: s.courses.code,
          description: s.courses.description,
          status: s.courses.status,
        })
        .from(s.courses)
        .where(
          actor.role === 'teacher'
            ? sql`exists(select 1 from teacher_course_assignments a where a.course_id=${s.courses.id} and a.teacher_id=${actor.id} and a.active)`
            : undefined,
        )
        .orderBy(s.courses.name)
    : Promise.resolve([]);
  const teachersQuery =
    actor.role === 'super_admin' && include.includes('teachers')
      ? db
          .select({
            id: s.profiles.id,
            fullName: s.profiles.fullName,
            email: s.profiles.email,
            phone: s.profiles.phone,
            status: s.profiles.status,
          })
          .from(s.profiles)
          .where(eq(s.profiles.role, 'teacher'))
          .orderBy(s.profiles.fullName)
      : Promise.resolve([]);
  const [batches, courses, teachers] = await Promise.all([
    batchesQuery,
    coursesQuery,
    teachersQuery,
  ]);
  return { batches, courses, teachers };
}
export async function studentList(search = '', page = 1, status = '') {
  const where = and(
    search
      ? or(
          ilike(s.students.fullName, `%${search}%`),
          ilike(s.students.studentCode, `%${search}%`),
          ilike(s.students.phone, `%${search}%`),
        )
      : undefined,
    status ? sql`${s.students.status}::text=${status}` : undefined,
  );
  const [rows, count] = await Promise.all([
    db
      .select()
      .from(s.students)
      .where(where)
      .orderBy(s.students.fullName)
      .limit(25)
      .offset((page - 1) * 25),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(s.students)
      .where(where),
  ]);
  return { rows, total: count[0].count };
}
export async function reportRows(
  filters: {
    from?: string;
    to?: string;
    batchId?: string;
    courseId?: string;
    studentId?: string;
    teacherId?: string;
  } = {},
  actor?: Actor,
) {
  const result = await db.execute<{
    student_id: string;
    student_code: string;
    full_name: string;
    batch_id: string;
    batch_name: string;
    course_name: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    eligible: number;
    percentage: number | null;
    last_date: string | null;
    consecutive_absences: number;
    threshold: string;
    followup_date: string | null;
  }>(sql`
 with ranked as (
 select a.student_id,cs.batch_id,a.status,cs.session_date,row_number() over(partition by a.student_id,cs.batch_id order by cs.session_date desc,cs.start_time desc) as n
 from attendance_records a join class_sessions cs on cs.id=a.session_id join batches b on b.id=cs.batch_id
 where cs.status='submitted'
 ${actor?.role === 'teacher' ? sql`and ${teacherBatchScope(actor.id, sql`cs.batch_id`)}` : sql``}
 ${filters.from ? sql`and cs.session_date>=${filters.from}::date` : sql``} ${filters.to ? sql`and cs.session_date<=${filters.to}::date` : sql``}
 ${filters.batchId ? sql`and cs.batch_id=${filters.batchId}::uuid` : sql``} ${filters.courseId ? sql`and b.course_id=${filters.courseId}::uuid` : sql``}
 ${filters.studentId ? sql`and a.student_id=${filters.studentId}::uuid` : sql``} ${filters.teacherId ? sql`and cs.submitted_by=${filters.teacherId}::uuid` : sql``}
 ), aggregated as (
 select student_id,batch_id,count(*) filter(where status='present')::int present,count(*) filter(where status='absent')::int absent,count(*) filter(where status='late')::int late,count(*) filter(where status='excused')::int excused,count(*) filter(where status<>'excused')::int eligible,max(session_date)::text last_date,
 coalesce(min(n) filter(where status<>'absent')-1,count(*))::int consecutive_absences
 from ranked group by student_id,batch_id
 ) select st.id student_id,st.student_code,st.full_name,b.id batch_id,b.name batch_name,c.name course_name,
 coalesce(a.present,0) present,coalesce(a.absent,0) absent,coalesce(a.late,0) late,coalesce(a.excused,0) excused,coalesce(a.eligible,0) eligible,
 round(100.0*(a.present+case when settings.late_counts_as_present then a.late else 0 end)/nullif(a.eligible,0),2)::float percentage,
 a.last_date,coalesce(a.last_date,(select min(enrolled_on)::text from enrollments e2 where e2.student_id=st.id and e2.batch_id=b.id)) followup_date,coalesce(a.consecutive_absences,0) consecutive_absences,settings.minimum_attendance_percentage::text threshold
 from students st join (select distinct student_id,batch_id from enrollments union select student_id,batch_id from ranked) e on e.student_id=st.id
 join batches b on b.id=e.batch_id join courses c on c.id=b.course_id cross join app_settings settings
 left join aggregated a on a.student_id=st.id and a.batch_id=b.id
 where true ${filters.studentId ? sql`and st.id=${filters.studentId}::uuid` : sql``} ${filters.batchId ? sql`and b.id=${filters.batchId}::uuid` : sql``} ${filters.courseId ? sql`and c.id=${filters.courseId}::uuid` : sql``}
 ${actor?.role === 'teacher' ? sql`and ${teacherBatchScope(actor.id, sql`b.id`)}` : sql``}
 order by st.full_name,b.name limit 5000`);
  return result.rows;
}
export async function dashboard() {
  const today = localDate();
  const [result, trend, performance, flags] = await Promise.all([
    db.execute<{
      students: number;
      courses: number;
      batches: number;
      teachers: number;
      scheduled: number;
      completed: number;
      present: number;
      absent: number;
      average: number | null;
    }>(sql`select
 (select count(*)::int from students where status='active') students,(select count(*)::int from courses where status='active') courses,
 (select count(*)::int from batches where status='active') batches,(select count(*)::int from profiles where role='teacher' and status='active') teachers,
 (select count(*)::int from class_sessions where session_date=${today}::date and status<>'cancelled') scheduled,
 (select count(*)::int from class_sessions where session_date=${today}::date and status='submitted') completed,
 (select count(*)::int from attendance_records a join class_sessions cs on cs.id=a.session_id where cs.session_date=${today}::date and cs.status='submitted' and a.status='present') present,
 (select count(*)::int from attendance_records a join class_sessions cs on cs.id=a.session_id where cs.session_date=${today}::date and cs.status='submitted' and a.status='absent') absent,
 (select round(100.0*count(*) filter(where a.status='present' or (settings.late_counts_as_present and a.status='late'))/nullif(count(*) filter(where a.status<>'excused'),0),1)::float from attendance_records a join class_sessions cs on cs.id=a.session_id cross join app_settings settings where cs.status='submitted') average`),
    db.execute<{ date: string; percentage: number | null }>(
      sql`select cs.session_date::text date,round(100.0*count(*) filter(where a.status='present' or (settings.late_counts_as_present and a.status='late'))/nullif(count(*) filter(where a.status<>'excused'),0),1)::float percentage from class_sessions cs join attendance_records a on a.session_id=cs.id cross join app_settings settings where cs.status='submitted' and cs.session_date>=${today}::date-interval '13 days' group by cs.session_date order by cs.session_date`,
    ),
    db.execute<{ name: string; percentage: number | null }>(
      sql`select b.name,round(100.0*count(*) filter(where a.status='present' or (settings.late_counts_as_present and a.status='late'))/nullif(count(*) filter(where a.status<>'excused'),0),1)::float percentage from batches b join class_sessions cs on cs.batch_id=b.id and cs.status='submitted' join attendance_records a on a.session_id=cs.id cross join app_settings settings group by b.id,b.name order by percentage desc limit 10`,
    ),
    reportRows(),
  ]);
  const attention = flags.filter(
    (r) =>
      (r.percentage !== null && r.percentage < Number(r.threshold)) ||
      r.consecutive_absences >= 2 ||
      (r.followup_date
        ? Math.floor((Date.parse(today) - Date.parse(r.followup_date)) / 86400000) >= 7
        : false),
  );
  return { metrics: result.rows[0], trend: trend.rows, performance: performance.rows, attention };
}
