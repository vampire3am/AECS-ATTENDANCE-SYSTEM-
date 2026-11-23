import { randomBytes, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  actorTransaction,
  requireBatch,
  requireCourse,
  teacherBatchScope,
  type Actor,
} from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { invariant } from '@/lib/errors';
import { isoWeekday, localDate } from '@/lib/utils';
import { day, scheduleInput, studentInput, teacherInput, uuid } from '@/lib/validations';
import { openSessionInTransaction } from './attendance';
import { saveEntity } from './admin';

export async function createTeacherAccount(actor: Actor, raw: unknown) {
  invariant(actor.role === 'super_admin', 'Administrator access required.', 403);
  const input = teacherInput.pick({ fullName: true, email: true, phone: true }).parse(raw);
  const password = randomBytes(18).toString('base64url');
  const row = await saveEntity(actor, 'teachers', { ...input, password });
  return { id: row.id, email: input.email, password };
}

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const batchSetup = z
  .object({
    name: z.string().trim().min(2).max(150),
    course: z.union([
      z.object({ id: uuid }),
      z.object({ name: z.string().trim().min(2).max(150) }),
    ]),
    teacher: z
      .union([
        z.object({ id: uuid }),
        z.object({ fullName: teacherInput.shape.fullName, email: teacherInput.shape.email }),
      ])
      .optional(),
    startDate: day,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    startTime: clock,
    endTime: clock,
  })
  .refine((p) => p.endTime > p.startTime, 'Class end time must be after its start time.');

export async function createBatchSetup(actor: Actor, raw: unknown) {
  const p = batchSetup.parse(raw);
  invariant(
    actor.role === 'super_admin' ||
      ('id' in p.course && (!p.teacher || ('id' in p.teacher && p.teacher.id === actor.id))),
    'Teachers can only create their own batches in assigned courses.',
    403,
  );
  invariant(p.startDate >= localDate(), 'Choose today or a future start date.');
  const password =
    p.teacher && 'email' in p.teacher ? randomBytes(18).toString('base64url') : undefined;
  const passwordHash = password
    ? await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
    : undefined;
  return actorTransaction(actor, async (tx) => {
    let courseId: string;
    if ('id' in p.course) {
      await requireCourse(tx, actor, p.course.id);
      const [course] = await tx
        .select({ id: s.courses.id })
        .from(s.courses)
        .where(and(eq(s.courses.id, p.course.id), eq(s.courses.status, 'active')))
        .for('share');
      invariant(course, 'Choose an active course.');
      courseId = course.id;
    } else {
      const [course] = await tx
        .insert(s.courses)
        .values({ name: p.course.name, code: 'C-' + randomUUID().slice(0, 12) })
        .returning({ id: s.courses.id });
      courseId = course.id;
      await tx.insert(s.auditLogs).values({
        actorId: actor.id,
        action: 'record_created',
        entityType: 'courses',
        entityId: course.id,
      });
    }
    let teacherId: string | undefined = actor.role === 'teacher' ? actor.id : undefined;
    if (p.teacher && 'id' in p.teacher) {
      const [teacher] = await tx
        .select({ id: s.profiles.id })
        .from(s.profiles)
        .where(
          and(
            eq(s.profiles.id, p.teacher.id),
            eq(s.profiles.role, 'teacher'),
            eq(s.profiles.status, 'active'),
          ),
        )
        .for('share');
      invariant(teacher, 'Choose an active teacher.');
      teacherId = teacher.id;
    } else if (p.teacher && 'email' in p.teacher) {
      invariant(passwordHash, 'Teacher password could not be generated.');
      const [teacher] = await tx
        .insert(s.profiles)
        .values({
          fullName: p.teacher.fullName,
          email: p.teacher.email,
          passwordHash,
          role: 'teacher',
        })
        .returning({ id: s.profiles.id });
      teacherId = teacher.id;
      await tx.insert(s.auditLogs).values({
        actorId: actor.id,
        action: 'record_created',
        entityType: 'teachers',
        entityId: teacher.id,
      });
    }
    const [batch] = await tx
      .insert(s.batches)
      .values({
        name: p.name,
        courseId,
        code: 'B-' + randomUUID().slice(0, 12),
        startDate: p.startDate,
      })
      .returning({ id: s.batches.id });
    if (teacherId) {
      await tx.insert(s.teacherAssignments).values({ batchId: batch.id, teacherId });
      if (actor.role === 'super_admin')
        await tx
          .insert(s.teacherCourseAssignments)
          .values({ teacherId, courseId })
          .onConflictDoUpdate({
            target: [s.teacherCourseAssignments.teacherId, s.teacherCourseAssignments.courseId],
            set: { active: true },
          });
    }
    const schedules = [...new Set(p.weekdays)].map((weekday) =>
      scheduleInput.parse({
        batchId: batch.id,
        weekday,
        startTime: p.startTime,
        endTime: p.endTime,
        effectiveFrom: p.startDate,
      }),
    );
    await tx
      .insert(s.batchSchedules)
      .values(schedules.map((v) => ({ ...v, effectiveUntil: null })));
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'batch_setup_created',
      entityType: 'batch',
      entityId: batch.id,
      metadata: { courseId, teacherId, weekdays: [...new Set(p.weekdays)] },
    });
    return {
      id: batch.id,
      teacherAccess:
        password && p.teacher && 'email' in p.teacher ? { email: p.teacher.email, password } : null,
    };
  });
}

export async function createEnrolledStudent(actor: Actor, raw: unknown) {
  const p = studentInput
    .pick({ fullName: true, phone: true, email: true })
    .extend({ batchId: uuid })
    .parse(raw);
  return actorTransaction(actor, async (tx) => {
    await tx
      .select({ id: s.batches.id })
      .from(s.batches)
      .where(eq(s.batches.id, p.batchId))
      .for('update');
    const batch = await requireBatch(tx, actor, p.batchId, true);
    const today = localDate();
    const enrolledOn = batch.startDate > today ? batch.startDate : today;
    invariant(
      !batch.endDate || enrolledOn <= batch.endDate,
      'This batch has ended. Choose a current batch.',
    );
    const [student] = await tx
      .insert(s.students)
      .values({ fullName: p.fullName, phone: p.phone, email: p.email || null, joinedOn: today })
      .returning({ id: s.students.id, studentCode: s.students.studentCode });
    const [enrollment] = await tx
      .insert(s.enrollments)
      .values({ studentId: student.id, batchId: p.batchId, courseId: batch.courseId, enrolledOn })
      .returning({ id: s.enrollments.id, code: s.enrollments.checkinCode });
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'student_created_and_enrolled',
      entityType: 'student',
      entityId: student.id,
      metadata: { batchId: p.batchId, enrollmentId: enrollment.id, enrolledOn },
    });
    return { ...student, enrollmentCode: enrollment.code, enrolledOn, batchId: p.batchId };
  });
}

export async function startClass(actor: Actor, raw: unknown) {
  const p = z
    .object({
      batchId: uuid,
      scheduleId: uuid.optional(),
      startTime: clock.optional(),
      endTime: clock.optional(),
    })
    .parse(raw);
  return actorTransaction(actor, async (tx) => {
    // A batch lock serializes double clicks and starts on different devices.
    await tx
      .select({ id: s.batches.id })
      .from(s.batches)
      .where(eq(s.batches.id, p.batchId))
      .for('update');
    const batch = await requireBatch(tx, actor, p.batchId, true);
    const today = localDate();
    invariant(
      batch.startDate <= today && (!batch.endDate || batch.endDate >= today),
      'This batch is not running today.',
      409,
    );
    const open = await tx
      .select({ id: s.classSessions.id })
      .from(s.classSessions)
      .where(
        and(
          eq(s.classSessions.batchId, p.batchId),
          eq(s.classSessions.sessionDate, today),
          eq(s.classSessions.status, 'open'),
        ),
      )
      .limit(2);
    invariant(open.length < 2, 'Finish the previous open classes before starting another.', 409);
    if (open[0]) return { id: open[0].id };
    const [eligibleStudent] = await tx
      .select({ id: s.enrollments.id })
      .from(s.enrollments)
      .innerJoin(s.students, eq(s.students.id, s.enrollments.studentId))
      .where(
        and(
          eq(s.enrollments.batchId, p.batchId),
          eq(s.students.status, 'active'),
          sql`${s.enrollments.enrolledOn}<=${today}::date and (${s.enrollments.endedOn} is null or ${s.enrollments.endedOn}>${today}::date)`,
        ),
      )
      .limit(1);
    invariant(eligibleStudent, 'Add students to this batch before starting the class.', 409);
    const schedules = await tx
      .select()
      .from(s.batchSchedules)
      .where(
        and(
          eq(s.batchSchedules.batchId, p.batchId),
          eq(s.batchSchedules.status, 'active'),
          eq(s.batchSchedules.weekday, isoWeekday(today)),
          sql`${s.batchSchedules.effectiveFrom}<=${today}::date and (${s.batchSchedules.effectiveUntil} is null or ${s.batchSchedules.effectiveUntil}>=${today}::date)`,
          p.scheduleId ? eq(s.batchSchedules.id, p.scheduleId) : undefined,
        ),
      );
    invariant(
      !p.scheduleId || schedules.length === 1,
      'This class time is no longer scheduled today.',
      409,
    );
    invariant(schedules.length < 2, 'Choose the class time you want to start.', 409);
    const schedule = schedules[0];
    const startTime = schedule?.startTime ?? p.startTime;
    const endTime = schedule?.endTime ?? p.endTime;
    invariant(
      startTime && endTime && endTime > startTime,
      'Choose valid start and end times for this extra class.',
    );
    const [existing] = await tx
      .select()
      .from(s.classSessions)
      .where(
        and(
          eq(s.classSessions.batchId, p.batchId),
          eq(s.classSessions.sessionDate, today),
          eq(s.classSessions.startTime, startTime),
        ),
      );
    invariant(
      !existing || existing.status === 'scheduled',
      'This class is already finished or cancelled. Open its attendance history.',
      409,
    );
    const session =
      existing ??
      (
        await tx
          .insert(s.classSessions)
          .values({
            batchId: p.batchId,
            scheduleId: schedule?.id,
            sessionDate: today,
            startTime,
            endTime,
            createdBy: actor.id,
          })
          .returning()
      )[0];
    await openSessionInTransaction(tx, actor, session.id);
    await tx.insert(s.auditLogs).values({
      actorId: actor.id,
      action: 'class_started',
      entityType: 'class_session',
      entityId: session.id,
    });
    return { id: session.id };
  });
}

export type TodayBatch = {
  id: string;
  name: string;
  courseName: string;
  startDate: string;
  endDate: string | null;
  studentCount: number;
  teacherNames: string;
  schedules: { id: string; startTime: string; endTime: string }[];
  sessions: { id: string; status: string; startTime: string; endTime: string }[];
};
export async function todayBatches(actor: Actor) {
  const today = localDate();
  const result =
    await db.execute<TodayBatch>(sql`select b.id,b.name,c.name as "courseName",b.start_date::text as "startDate",b.end_date::text as "endDate",
    (select count(*)::int from enrollments e join students st on st.id=e.student_id where e.batch_id=b.id and st.status='active' and e.enrolled_on<=${today}::date and (e.ended_on is null or e.ended_on>${today}::date)) as "studentCount",
    coalesce((select string_agg(p.full_name,', ' order by p.full_name) from teacher_assignments a join profiles p on p.id=a.teacher_id join teacher_course_assignments g on g.teacher_id=a.teacher_id and g.course_id=b.course_id and g.active where a.batch_id=b.id and a.active and p.status='active'),'Admin-led') as "teacherNames",
    coalesce((select json_agg(json_build_object('id',sc.id,'startTime',sc.start_time::text,'endTime',sc.end_time::text) order by sc.start_time) from batch_schedules sc where sc.batch_id=b.id and sc.status='active' and sc.weekday=${isoWeekday(today)} and sc.effective_from<=${today}::date and (sc.effective_until is null or sc.effective_until>=${today}::date)),'[]'::json) as schedules,
    coalesce((select json_agg(json_build_object('id',cs.id,'status',cs.status,'startTime',cs.start_time::text,'endTime',cs.end_time::text) order by cs.start_time) from class_sessions cs where cs.batch_id=b.id and cs.session_date=${today}::date),'[]'::json) as sessions
    from batches b join courses c on c.id=b.course_id where b.status='active' and c.status='active'
    ${actor.role === 'teacher' ? sql`and ${teacherBatchScope(actor.id, sql`b.id`)}` : sql``}
    order by b.name`);
  return result.rows;
}
