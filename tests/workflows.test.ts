import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { db, pool } from '../lib/db';
import * as s from '../lib/db/schema';
import type { Actor } from '../lib/auth/permissions';
import { authenticateStaff } from '../lib/auth/credentials';
import {
  createBatchSetup,
  createEnrolledStudent,
  createTeacherAccount,
  startClass,
  todayBatches,
} from '../lib/services/workflows';
import { getSession, saveAttendance } from '../lib/services/attendance';
import {
  submitStudentCheckin,
  listCheckins,
  verifyCheckin,
  verifyEnrollmentCode,
} from '../lib/services/check-in';
import { isoWeekday, localDate } from '../lib/utils';

const enabled =
  process.env.TEST_DATABASE_BRANCH === 'integration-tests' && Boolean(process.env.DATABASE_URL);
describe.skipIf(!enabled)('Simple workflows on isolated PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8),
    today = localDate();
  const input = {
    name: 'Morning ' + suffix,
    course: { name: 'IELTS ' + suffix },
    teacher: { fullName: 'Teacher ' + suffix, email: 'simple-' + suffix + '@example.test' },
    startDate: today,
    weekdays: [isoWeekday(today), isoWeekday(today)],
    startTime: '07:00',
    endTime: '08:00',
  };
  let admin: Actor,
    teacher: Actor,
    outsider: Actor,
    batchId: string,
    code: string,
    studentId: string,
    sessionId: string;
  beforeAll(async () => {
    const [profile] = await db
      .insert(s.profiles)
      .values({
        fullName: 'Workflow Admin',
        email: 'workflow-admin-' + suffix + '@example.test',
        passwordHash: await hash(randomUUID()),
        role: 'super_admin',
      })
      .returning();
    admin = profile;
  });
  afterAll(async () => {
    await pool.end();
  });
  it('creates the course, teacher, assignment and deduplicated timetable together', async () => {
    const result = await createBatchSetup(admin, input);
    batchId = result.id;
    expect(result.teacherAccess?.password.length).toBeGreaterThanOrEqual(20);
    expect(
      (
        await authenticateStaff({
          email: result.teacherAccess!.email,
          password: result.teacherAccess!.password,
        })
      )?.email,
    ).toBe(input.teacher.email);
    [teacher] = await db.select().from(s.profiles).where(eq(s.profiles.email, input.teacher.email));
    const schedules = await db
      .select()
      .from(s.batchSchedules)
      .where(eq(s.batchSchedules.batchId, batchId));
    expect(schedules).toHaveLength(1);
    const assignments = await db
      .select()
      .from(s.teacherAssignments)
      .where(
        and(
          eq(s.teacherAssignments.batchId, batchId),
          eq(s.teacherAssignments.teacherId, teacher.id),
        ),
      );
    expect(assignments).toHaveLength(1);
    expect((await todayBatches(teacher)).some((b) => b.id === batchId)).toBe(true);
  });
  it('rolls back a new course and batch if the teacher email already exists', async () => {
    const courseName = 'Rollback ' + suffix;
    await expect(
      createBatchSetup(admin, { ...input, name: courseName, course: { name: courseName } }),
    ).rejects.toBeDefined();
    expect(
      await db.select({ id: s.courses.id }).from(s.courses).where(eq(s.courses.name, courseName)),
    ).toHaveLength(0);
    expect(
      await db.select({ id: s.batches.id }).from(s.batches).where(eq(s.batches.name, courseName)),
    ).toHaveLength(0);
  });
  it('rejects invalid times and prevents teachers from changing setup', async () => {
    await expect(createBatchSetup(admin, { ...input, startTime: '29:00' })).rejects.toBeDefined();
    await expect(createBatchSetup(teacher, input)).rejects.toMatchObject({ status: 403 });
    await expect(
      createEnrolledStudent(teacher, { fullName: 'Forbidden', phone: '9800000000', batchId }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(startClass(admin, { batchId })).rejects.toMatchObject({ status: 409 });
  });
  it('adds a student and enrollment atomically and returns the private code', async () => {
    const student = await createEnrolledStudent(admin, {
      fullName: 'Learner ' + suffix,
      phone: '9800000000',
      email: '',
      batchId,
    });
    code = student.enrollmentCode;
    studentId = student.id;
    expect(code).toMatch(/^AECS-[A-F0-9]{20}$/);
    expect((await verifyEnrollmentCode({ code })).batchName).toBe(input.name);
    const name = 'Invalid ' + suffix;
    await expect(
      createEnrolledStudent(admin, { fullName: name, phone: '9800000000', batchId: randomUUID() }),
    ).rejects.toBeDefined();
    expect(
      await db.select({ id: s.students.id }).from(s.students).where(eq(s.students.fullName, name)),
    ).toHaveLength(0);
  });
  it('starts once across concurrent devices, seals the roster and supports common QR check-in', async () => {
    const results = await Promise.all([
      startClass(admin, { batchId }),
      startClass(teacher, { batchId }),
    ]);
    expect(results[0].id).toBe(results[1].id);
    sessionId = results[0].id;
    const model = await getSession(teacher, sessionId);
    expect(model.session.status).toBe('open');
    expect(model.session.rosterLocked).toBe(true);
    expect(model.records.map((r) => r.studentId)).toEqual([studentId]);
    await submitStudentCheckin({ code });
    const rows = await listCheckins(teacher, sessionId);
    expect(rows).toHaveLength(1);
    expect(rows[0].verifiedAt).toBeNull();
    await verifyCheckin(teacher, rows[0].id);
    expect((await getSession(teacher, sessionId)).records[0].status).toBe('present');
  });
  it('finishes the class and cannot reopen the completed slot', async () => {
    const model = await getSession(teacher, sessionId);
    await saveAttendance(
      teacher,
      {
        sessionId,
        operationId: randomUUID(),
        version: model.session.version,
        records: [{ studentId, status: 'present' }],
      },
      true,
    );
    await expect(startClass(admin, { batchId })).rejects.toMatchObject({ status: 409 });
    await expect(submitStudentCheckin({ code })).rejects.toMatchObject({ status: 409 });
  });
  it('generates a standalone teacher login and enforces assignment isolation', async () => {
    const access = await createTeacherAccount(admin, {
      fullName: 'Other Teacher',
      email: 'other-simple-' + suffix + '@example.test',
      phone: '',
    });
    [outsider] = await db.select().from(s.profiles).where(eq(s.profiles.id, access.id));
    expect((await authenticateStaff({ email: access.email, password: access.password }))?.id).toBe(
      access.id,
    );
    expect(await todayBatches(outsider)).toHaveLength(0);
    await expect(startClass(outsider, { batchId })).rejects.toMatchObject({ status: 403 });
  });
  it('allows a timed extra class without creating or changing the weekly timetable', async () => {
    const batch = await createBatchSetup(admin, {
      ...input,
      name: 'Extra ' + suffix,
      teacher: undefined,
      course: { name: 'Extra course ' + suffix },
      weekdays: [(isoWeekday(today) % 7) + 1],
    });
    await createEnrolledStudent(admin, {
      fullName: 'Extra learner ' + suffix,
      phone: '9800000001',
      batchId: batch.id,
    });
    const started = await startClass(admin, {
      batchId: batch.id,
      startTime: '12:00',
      endTime: '13:00',
    });
    expect((await getSession(admin, started.id)).session.scheduleId).toBeNull();
    expect(
      await db.select().from(s.batchSchedules).where(eq(s.batchSchedules.batchId, batch.id)),
    ).toHaveLength(1);
  });
  it('enrolls into a future batch from its start date and blocks starting it early', async () => {
    const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
    const batch = await createBatchSetup(admin, {
      ...input,
      name: 'Future ' + suffix,
      teacher: undefined,
      course: { name: 'Future course ' + suffix },
      startDate: tomorrow,
    });
    const student = await createEnrolledStudent(admin, {
      fullName: 'Future learner ' + suffix,
      phone: '9800000002',
      batchId: batch.id,
    });
    expect(student.enrolledOn).toBe(tomorrow);
    await expect(verifyEnrollmentCode({ code: student.enrollmentCode })).rejects.toMatchObject({
      status: 400,
    });
    await expect(startClass(admin, { batchId: batch.id })).rejects.toMatchObject({ status: 409 });
  });
});
