import { randomUUID, createHmac } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '../lib/db';
import * as s from '../lib/db/schema';
import { actorTransaction, type Actor } from '../lib/auth/permissions';
import { authenticateStaff } from '../lib/auth/credentials';
import {
  saveEntity,
  enrollStudent,
  transferStudent,
  endEnrollment,
  assignTeacher,
} from '../lib/services/admin';
import {
  createBatchSetup,
  createEnrolledStudent,
  createTeacherAccount,
  startClass,
  todayBatches,
} from '../lib/services/workflows';
import { setTeacherCourses } from '../lib/services/teacher-access';
import { teacherBatch, teacherStudents } from '../lib/services/teacher-workspace';
import { catalog, reportRows, studentList } from '../lib/services/queries';
import { getSession, listSessions } from '../lib/services/attendance';
import { accessState } from '../lib/services/access-state';
import { existingStudentOptions } from '../lib/services/enrollment-options';
import { isoWeekday, localDate } from '../lib/utils';
const enabled =
  process.env.TEST_DATABASE_BRANCH === 'integration-tests' && Boolean(process.env.DATABASE_URL);
describe.skipIf(!enabled)('Teacher isolation and staff login security', () => {
  const suffix = randomUUID().slice(0, 8),
    today = localDate(),
    password = randomUUID() + randomUUID();
  let admin: Actor,
    t1: Actor,
    t2: Actor,
    ielts: string,
    pte: string,
    b1: string,
    b2: string,
    student1: string,
    enrollment1: string,
    session1: string;
  const setup = (courseId: string, name: string) => ({
    name: name + ' ' + suffix,
    course: { id: courseId },
    startDate: today,
    weekdays: [isoWeekday(today)],
    startTime: '07:00',
    endTime: '08:00',
  });
  beforeAll(async () => {
    const rows = await db
      .insert(s.profiles)
      .values([
        {
          fullName: 'Isolation Admin',
          email: 'iso-admin-' + suffix + '@example.test',
          passwordHash: await hash(password),
          role: 'super_admin' as const,
        },
        {
          fullName: 'IELTS Teacher',
          email: 'iso-one-' + suffix + '@example.test',
          passwordHash: await hash(password),
          role: 'teacher' as const,
        },
        {
          fullName: 'PTE Teacher',
          email: 'iso-two-' + suffix + '@example.test',
          passwordHash: await hash(password),
          role: 'teacher' as const,
        },
      ])
      .returning();
    [admin, t1, t2] = rows;
    ielts = (await saveEntity(admin, 'courses', { name: 'IELTS ' + suffix, code: 'I-' + suffix }))
      .id;
    pte = (await saveEntity(admin, 'courses', { name: 'PTE ' + suffix, code: 'P-' + suffix })).id;
    await setTeacherCourses(admin, { teacherId: t1.id, courseIds: [ielts] });
    await setTeacherCourses(admin, { teacherId: t2.id, courseIds: [pte] });
  });
  afterAll(async () => {
    await pool.end();
  });
  it('exposes only granted courses and no unassigned batches', async () => {
    const c = await catalog(t1);
    expect(c.courses.map((v) => v.id)).toEqual([ielts]);
    expect(c.batches).toHaveLength(0);
    expect(c.teachers).toHaveLength(0);
    await expect(createBatchSetup(t1, setup(pte, 'Forbidden PTE'))).rejects.toMatchObject({
      status: 403,
    });
  });
  it('automatically assigns newly created batches to their teacher', async () => {
    b1 = (await createBatchSetup(t1, setup(ielts, 'Private IELTS'))).id;
    b2 = (await createBatchSetup(t2, setup(pte, 'Private PTE'))).id;
    expect((await todayBatches(t1)).map((b) => b.id)).toEqual([b1]);
    expect((await todayBatches(t2)).map((b) => b.id)).toEqual([b2]);
    await expect(
      createBatchSetup(t1, { ...setup(ielts, 'Spoofed'), teacher: { id: t2.id } }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createBatchSetup(t1, { ...setup(ielts, 'New course'), course: { name: 'Escalated' } }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('does not grant another teacher’s batches when course access is shared', async () => {
    await setTeacherCourses(admin, { teacherId: t2.id, courseIds: [pte, ielts] });
    expect((await catalog(t2)).courses).toHaveLength(2);
    expect((await catalog(t2)).batches.map((b) => b.id)).toEqual([b2]);
    await expect(teacherBatch(t2, b1)).rejects.toMatchObject({ status: 403 });
    await expect(teacherStudents(t2, b1)).rejects.toMatchObject({ status: 403 });
  });
  it('allows student creation only in an assigned batch and keeps codes private', async () => {
    const learner = await createEnrolledStudent(t1, {
      fullName: "O'Connor; -- " + suffix,
      phone: '9800000099',
      batchId: b1,
    });
    student1 = learner.id;
    [enrollment1] = (
      await db
        .select({ id: s.enrollments.id })
        .from(s.enrollments)
        .where(eq(s.enrollments.studentId, student1))
    ).map((v) => v.id);
    expect((await teacherStudents(t1)).map((v) => v.code)).toContain(learner.enrollmentCode);
    expect(await teacherStudents(t2)).toHaveLength(0);
    const forbidden = 'Hidden student ' + suffix;
    await expect(
      createEnrolledStudent(t2, { fullName: forbidden, phone: '9800000088', batchId: b1 }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await db.select().from(s.students).where(eq(s.students.fullName, forbidden)),
    ).toHaveLength(0);
    await expect(
      enrollStudent(t2, { studentId: student1, batchId: b2, enrolledOn: today }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('scopes the existing-student picker and excludes overlapping course enrollments', async () => {
    await expect(existingStudentOptions(t1, { batchId: b2 })).rejects.toMatchObject({
      status: 403,
    });
    expect(
      (await existingStudentOptions(t2, { batchId: b2, search: suffix })).map((s) => s.id),
    ).not.toContain(student1);
    expect(
      (await existingStudentOptions(admin, { batchId: b2, search: suffix })).map((s) => s.id),
    ).toContain(student1);
    expect(
      (await existingStudentOptions(t1, { batchId: b1, search: suffix })).map((s) => s.id),
    ).not.toContain(student1);
    expect(
      await existingStudentOptions(admin, { batchId: b2, search: "'; DROP TABLE students; --" }),
    ).toEqual([]);
  });
  it('blocks foreign schedule, batch and enrollment mutations with forged IDs', async () => {
    await expect(
      saveEntity(t2, 'schedules', {
        batchId: b1,
        weekday: isoWeekday(today),
        startTime: '12:00',
        endTime: '13:00',
        effectiveFrom: today,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const { batch } = await teacherBatch(t1, b1);
    await expect(
      saveEntity(
        t2,
        'batches',
        { ...batch, endDate: batch.endDate ?? '', name: 'Stolen batch' },
        b1,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      endEnrollment(t2, { id: enrollment1, endedOn: today, reason: 'Not my enrollment' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      transferStudent(t2, {
        enrollmentId: enrollment1,
        batchId: b2,
        effectiveOn: today,
        reason: 'Not my enrollment',
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await teacherBatch(t1, b1)).batch.name).toBe(batch.name);
  });
  it('lets a teacher edit their own timetable and transfer between their own batches', async () => {
    const other = (await createBatchSetup(t1, setup(ielts, 'Other IELTS'))).id;
    await saveEntity(t1, 'schedules', {
      batchId: other,
      weekday: isoWeekday(today),
      startTime: '12:00',
      endTime: '13:00',
      effectiveFrom: today,
    });
    const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
    await transferStudent(t1, {
      enrollmentId: enrollment1,
      batchId: other,
      effectiveOn: tomorrow,
      reason: 'Move to another assigned batch',
    });
    const rows = await db.select().from(s.enrollments).where(eq(s.enrollments.studentId, student1));
    expect(rows).toHaveLength(2);
    expect(rows.find((v) => v.batchId === other)?.checkinCode).not.toBe(
      rows.find((v) => v.batchId === b1)?.checkinCode,
    );
  });
  it('scopes reports and exports even when another batch or student is explicitly requested', async () => {
    const learner = await createEnrolledStudent(t2, {
      fullName: 'PTE learner ' + suffix,
      phone: '9800000077',
      batchId: b2,
    });
    await enrollStudent(admin, { studentId: learner.id, batchId: b1, enrolledOn: today });
    const ownReports = await reportRows({}, t2);
    expect(ownReports).toHaveLength(1);
    expect(ownReports.every((r) => r.batch_id === b2)).toBe(true);
    expect(await reportRows({ batchId: b1 }, t2)).toHaveLength(0);
    expect((await reportRows({ studentId: learner.id }, t1)).map((r) => r.batch_id)).toEqual([b1]);
  });
  it('cannot self-grant courses, create staff or spoof administrator identity', async () => {
    await expect(
      setTeacherCourses(t1, { teacherId: t1.id, courseIds: [pte] }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createTeacherAccount(t1, { fullName: 'Bad', email: 'bad-' + suffix + '@example.test' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      actorTransaction(t1, (tx) =>
        tx.insert(s.teacherCourseAssignments).values({ teacherId: t1.id, courseId: pte }),
      ),
    ).rejects.toBeDefined();
    await expect(
      createBatchSetup({ ...t1, role: 'super_admin' }, setup(pte, 'Spoofed admin')),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('revokes an existing session, all course batches, private rosters, history and reports together', async () => {
    session1 = (await startClass(t1, { batchId: b1 })).id;
    await expect(getSession(t2, session1)).rejects.toMatchObject({ status: 403 });
    const unchangedVersion = t2.sessionVersion;
    await setTeacherCourses(admin, { teacherId: t2.id, courseIds: [pte, ielts] });
    expect((await accessState(t2)).sessionVersion).toBe(unchangedVersion);
    expect((await catalog(t2)).batches.map((b) => b.id)).toEqual([b2]);
    await setTeacherCourses(admin, { teacherId: t1.id, courseIds: [] });
    await expect(accessState(t1)).rejects.toMatchObject({ status: 401 });
    await expect(teacherStudents(t1)).rejects.toMatchObject({ status: 401 });
    await expect(createBatchSetup(t1, setup(ielts, 'Revoked'))).rejects.toMatchObject({
      status: 401,
    });
    [t1] = await db.select().from(s.profiles).where(eq(s.profiles.id, t1.id));
    expect((await accessState(t1)).batchIds).toEqual([]);
    expect((await catalog(t1)).batches).toEqual([]);
    expect(await todayBatches(t1)).toEqual([]);
    expect(await teacherStudents(t1)).toEqual([]);
    expect(await listSessions(t1)).toEqual([]);
    expect(await reportRows({}, t1)).toEqual([]);
    await expect(teacherBatch(t1, b1)).rejects.toMatchObject({ status: 403 });
    await expect(getSession(t1, session1)).rejects.toMatchObject({ status: 403 });
    await expect(startClass(t1, { batchId: b1 })).rejects.toMatchObject({ status: 403 });
    const assignment = await db
      .select()
      .from(s.teacherAssignments)
      .where(eq(s.teacherAssignments.teacherId, t1.id));
    expect(assignment.every((a) => !a.active)).toBe(true);
  });
  it('denies access even if a stale batch assignment exists without course permission', async () => {
    await db.insert(s.teacherAssignments).values({ teacherId: t1.id, batchId: b1 });
    expect((await catalog(t1)).batches).toEqual([]);
    expect(await todayBatches(t1)).toEqual([]);
    expect(await teacherStudents(t1)).toEqual([]);
    expect(await reportRows({}, t1)).toEqual([]);
    expect(await listSessions(t1)).toEqual([]);
    await expect(teacherBatch(t1, b1)).rejects.toMatchObject({ status: 403 });
    await expect(
      createEnrolledStudent(t1, { fullName: 'Not allowed', phone: '9800000000', batchId: b1 }),
    ).rejects.toMatchObject({ status: 403 });
    await db
      .update(s.teacherAssignments)
      .set({ active: false })
      .where(eq(s.teacherAssignments.teacherId, t1.id));
  });
  it('does not restore old batch assignments when a course is added back', async () => {
    await setTeacherCourses(admin, { teacherId: t1.id, courseIds: [ielts] });
    expect((await catalog(t1)).courses.map((c) => c.id)).toEqual([ielts]);
    expect((await catalog(t1)).batches).toEqual([]);
    await assignTeacher(admin, { teacherId: t1.id, batchId: b1, active: true });
    expect((await catalog(t1)).batches.map((b) => b.id)).toEqual([b1]);
  });
  it('rejects SQL injection as credentials and treats search text as parameter data', async () => {
    expect(await authenticateStaff({ email: "admin' OR 1=1 --", password: 'anything' })).toBeNull();
    expect(await authenticateStaff({ email: admin.email, password: "' OR '1'='1" })).toBeNull();
    expect((await studentList("'; DROP TABLE profiles; --")).total).toBe(0);
    expect(
      await db.select({ id: s.profiles.id }).from(s.profiles).where(eq(s.profiles.id, admin.id)),
    ).toHaveLength(1);
    expect(
      (await authenticateStaff({ email: '  ' + admin.email.toUpperCase() + '  ', password }))?.id,
    ).toBe(admin.id);
  });
  it('enforces network throttling and rejects archived accounts and revoked sessions', async () => {
    const ip = '198.51.100.' + Math.floor(Math.random() * 240 + 1);
    const key =
      'staff-ip:' + createHmac('sha256', process.env.AUTH_SECRET!).update(ip).digest('hex');
    await db
      .insert(s.loginAttempts)
      .values({ key, attempts: 100 })
      .onConflictDoUpdate({
        target: s.loginAttempts.key,
        set: { attempts: 100, windowStart: new Date() },
      });
    expect(
      await authenticateStaff(
        { email: admin.email, password },
        { headers: { 'x-forwarded-for': ip } },
      ),
    ).toBeNull();
    await db.update(s.profiles).set({ status: 'archived' }).where(eq(s.profiles.id, t2.id));
    expect(await authenticateStaff({ email: t2.email, password })).toBeNull();
    await expect(teacherStudents(t2)).rejects.toMatchObject({ status: 401 });
    await db
      .update(s.profiles)
      .set({ sessionVersion: admin.sessionVersion + 1 })
      .where(eq(s.profiles.id, admin.id));
    await expect(
      createEnrolledStudent(admin, { fullName: 'Stale session', phone: '9800000000', batchId: b2 }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
