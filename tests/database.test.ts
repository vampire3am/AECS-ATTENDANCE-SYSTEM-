import { verifyEnrollmentCode } from '../lib/services/check-in';
import { hash } from '@node-rs/argon2';
import { authenticateStaff } from '../lib/auth/credentials';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actorTransaction, type Actor } from '../lib/auth/permissions';
import { db, pool } from '../lib/db';
import * as s from '../lib/db/schema';
import { assignTeacher, enrollStudent, transferStudent } from '../lib/services/admin';
import {
  cancelSession,
  correctAttendance,
  generateToday,
  getSession,
  openSession,
  saveAttendance,
} from '../lib/services/attendance';
import { reportRows } from '../lib/services/queries';
import {
  startCheckin,
  submitStudentCheckin,
  listCheckins,
  verifyCheckin,
} from '../lib/services/check-in';
import { isoWeekday, localDate } from '../lib/utils';
const enabled = Boolean(
  process.env.TEST_DATABASE_BRANCH === 'integration-tests' && process.env.DATABASE_URL,
);
describe.skipIf(!enabled)('Live PostgreSQL attendance invariants', () => {
  let admin: Actor, teacher: Actor, other: Actor;
  let batchId: string, batch2: string, studentIds: string[], sessionId: string;
  let version = 1;
  let qrBatchId: string,
    qrSessionId: string,
    qrToken: string,
    enrollmentCode: string,
    checkinId: string;
  const operationId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const loginPassword = randomUUID() + randomUUID();
  const today = localDate();
  beforeAll(async () => {
    const passwordHash = await hash(loginPassword);
    const users = await db
      .insert(s.profiles)
      .values([
        {
          fullName: 'Test administrator',
          email: `admin-${suffix}@example.test`,
          passwordHash,
          role: 'super_admin',
        },
        {
          fullName: 'Assigned teacher',
          email: `teacher-${suffix}@example.test`,
          passwordHash,
          role: 'teacher',
        },
        {
          fullName: 'Unassigned teacher',
          email: `other-${suffix}@example.test`,
          passwordHash,
          role: 'teacher',
        },
      ])
      .returning();
    [admin, teacher, other] = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      sessionVersion: u.sessionVersion,
    }));
    const [course] = await db
      .insert(s.courses)
      .values({ code: `T-${suffix}`, name: 'Integration course' })
      .returning();
    const batches = await db
      .insert(s.batches)
      .values([
        { code: `A-${suffix}`, name: 'Integration A', courseId: course.id, startDate: today },
        { code: `B-${suffix}`, name: 'Integration B', courseId: course.id, startDate: today },
      ])
      .returning();
    batchId = batches[0].id;
    batch2 = batches[1].id;
    await assignTeacher(admin, { teacherId: teacher.id, batchId, active: true });
    const students = await db
      .insert(s.students)
      .values(
        Array.from({ length: 5 }, (_, i) => ({
          fullName: `Student ${suffix} ${i}`,
          phone: `98000${suffix}${i}`,
          joinedOn: today,
        })),
      )
      .returning();
    studentIds = students.map((s) => s.id);
    for (const studentId of studentIds.slice(0, 4))
      await enrollStudent(admin, { studentId, batchId, enrolledOn: today });
    const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
    await enrollStudent(admin, { studentId: studentIds[4], batchId, enrolledOn: tomorrow });
    await db.insert(s.batchSchedules).values({
      batchId,
      weekday: isoWeekday(today),
      startTime: '07:00',
      endTime: '08:00',
      effectiveFrom: today,
    });
  });
  afterAll(async () => {
    await pool.end();
  });
  it('authenticates valid staff credentials without exposing the password hash', async () => {
    const user = await authenticateStaff({ email: admin.email, password: loginPassword });
    expect(user?.id).toBe(admin.id);
    expect(user).not.toHaveProperty('passwordHash');
  });
  it('rejects invalid and unknown credentials', async () => {
    expect(
      await authenticateStaff({ email: admin.email, password: 'incorrect-password' }),
    ).toBeNull();
    expect(
      await authenticateStaff({ email: `missing-${suffix}@example.test`, password: loginPassword }),
    ).toBeNull();
  });
  it('applies a shared persistent login attempt limit', async () => {
    for (let i = 0; i < 10; i++)
      await authenticateStaff({ email: teacher.email, password: 'wrong-password' });
    expect(await authenticateStaff({ email: teacher.email, password: loginPassword })).toBeNull();
  });
  it('generates today once even on repeat calls', async () => {
    await generateToday(teacher);
    await generateToday(teacher);
    const sessions = await db
      .select()
      .from(s.classSessions)
      .where(eq(s.classSessions.batchId, batchId));
    expect(sessions).toHaveLength(1);
    sessionId = sessions[0].id;
  });
  it('denies an unassigned teacher', async () => {
    await expect(openSession(other, sessionId)).rejects.toMatchObject({ status: 403 });
  });
  it('snapshots only students enrolled on the session date', async () => {
    await openSession(teacher, sessionId);
    await openSession(teacher, sessionId);
    const model = await getSession(teacher, sessionId);
    expect(model.records).toHaveLength(4);
    expect(model.records.some((r) => r.studentId === studentIds[4])).toBe(false);
  });
  it('issues private enrollment codes and classroom QR tokens only to assigned staff', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://aecs-attendance.vercel.app';
    const [course] = await db
      .insert(s.courses)
      .values({ code: 'QR-' + suffix, name: 'QR integration course' })
      .returning();
    const [batch] = await db
      .insert(s.batches)
      .values({
        courseId: course.id,
        code: 'QR-' + suffix,
        name: 'QR test batch',
        startDate: today,
      })
      .returning();
    qrBatchId = batch.id;
    await assignTeacher(admin, { teacherId: teacher.id, batchId: qrBatchId, active: true });
    for (const studentId of studentIds.slice(0, 4))
      await enrollStudent(admin, { studentId, batchId: qrBatchId, enrolledOn: today });
    await enrollStudent(admin, {
      studentId: studentIds[4],
      batchId: qrBatchId,
      enrolledOn: new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10),
    });
    const [row] = await actorTransaction(admin, (tx) =>
      tx
        .insert(s.classSessions)
        .values({
          batchId: qrBatchId,
          sessionDate: today,
          startTime: '13:00',
          endTime: '14:00',
          createdBy: admin.id,
        })
        .returning(),
    );
    qrSessionId = row.id;
    await openSession(teacher, qrSessionId);
    const enrollment = await db
      .select()
      .from(s.enrollments)
      .where(eq(s.enrollments.batchId, qrBatchId));
    enrollmentCode = enrollment.find((e) => e.studentId === studentIds[0])!.checkinCode;
    const identity = await verifyEnrollmentCode({ code: enrollmentCode });
    expect(identity.studentCode).toBeDefined();
    expect(identity.batchName).toBe('QR test batch');
    expect(identity).not.toHaveProperty('phone');
    expect(identity).not.toHaveProperty('checkinCode');
    await expect(
      verifyEnrollmentCode({
        code: enrollment.find((e) => e.studentId === studentIds[4])!.checkinCode,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(new Set(enrollment.map((e) => e.checkinCode)).size).toBe(enrollment.length);
    expect(enrollmentCode).toMatch(/^AECS-[A-F0-9]{20}$/);
    await expect(startCheckin(other, qrSessionId)).rejects.toMatchObject({ status: 403 });
    const qr = await startCheckin(teacher, qrSessionId);
    qrToken = new URL(qr.url).searchParams.get('token')!;
    expect(qr.url).toContain('/check-in?');
  });
  it('queues duplicate student scans once without automatically marking present', async () => {
    const input = { sessionId: qrSessionId, token: qrToken, code: enrollmentCode };
    await Promise.all([submitStudentCheckin(input), submitStudentCheckin(input)]);
    const rows = await listCheckins(teacher, qrSessionId);
    expect(rows).toHaveLength(1);
    checkinId = rows[0].id;
    expect(rows[0].verifiedAt).toBeNull();
    expect(
      (await getSession(teacher, qrSessionId)).records.find((r) => r.studentId === studentIds[0])!
        .status,
    ).toBeNull();
  });
  it('blocks wrong-batch codes, future enrollment, refreshed and expired QR tokens', async () => {
    const [future] = await db
      .select()
      .from(s.enrollments)
      .where(and(eq(s.enrollments.studentId, studentIds[4]), eq(s.enrollments.batchId, qrBatchId)));
    await expect(
      submitStudentCheckin({ sessionId: qrSessionId, token: qrToken, code: future.checkinCode }),
    ).rejects.toMatchObject({ status: 400 });
    const next = await startCheckin(teacher, qrSessionId);
    await expect(
      submitStudentCheckin({ sessionId: qrSessionId, token: qrToken, code: enrollmentCode }),
    ).rejects.toMatchObject({ status: 410 });
    qrToken = new URL(next.url).searchParams.get('token')!;
    const [otherSession] = await actorTransaction(admin, (tx) =>
      tx
        .insert(s.classSessions)
        .values({
          batchId: batch2,
          sessionDate: today,
          startTime: '13:00',
          endTime: '14:00',
          createdBy: admin.id,
        })
        .returning(),
    );
    await openSession(admin, otherSession.id);
    const otherQR = await startCheckin(admin, otherSession.id);
    await expect(
      submitStudentCheckin({
        sessionId: otherSession.id,
        token: new URL(otherQR.url).searchParams.get('token'),
        code: enrollmentCode,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await db
      .update(s.checkinWindows)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.checkinWindows.sessionId, qrSessionId));
    await expect(
      submitStudentCheckin({ sessionId: qrSessionId, token: qrToken, code: enrollmentCode }),
    ).rejects.toMatchObject({ status: 410 });
  });
  it('requires assigned teacher confirmation and protects verified records', async () => {
    await expect(verifyCheckin(other, checkinId)).rejects.toMatchObject({ status: 403 });
    await verifyCheckin(teacher, checkinId);
    await verifyCheckin(teacher, checkinId);
    const model = await getSession(teacher, qrSessionId);
    expect(model.records.find((r) => r.studentId === studentIds[0])!.status).toBe('present');
    expect(model.session.version).toBe(2);
    expect((await listCheckins(teacher, qrSessionId))[0].verifiedAt).not.toBeNull();
    await expect(
      db
        .update(s.studentCheckins)
        .set({ studentId: studentIds[1] })
        .where(eq(s.studentCheckins.id, checkinId)),
    ).rejects.toBeDefined();
    await expect(
      db
        .update(s.enrollments)
        .set({ checkinCode: 'AECS-00000000000000000000' })
        .where(eq(s.enrollments.checkinCode, enrollmentCode)),
    ).rejects.toBeDefined();
  });
  it('rejects check-ins and QR issuance after final submission', async () => {
    const qr = await startCheckin(teacher, qrSessionId);
    const model = await getSession(teacher, qrSessionId);
    await saveAttendance(
      teacher,
      {
        sessionId: qrSessionId,
        operationId: randomUUID(),
        version: model.session.version,
        records: model.records.map((r) => ({ studentId: r.studentId, status: 'present' })),
      },
      true,
    );
    await expect(startCheckin(teacher, qrSessionId)).rejects.toMatchObject({ status: 409 });
    await expect(
      submitStudentCheckin({
        sessionId: qrSessionId,
        token: new URL(qr.url).searchParams.get('token'),
        code: enrollmentCode,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects active same-course duplicate enrollment in PostgreSQL', async () => {
    await expect(
      enrollStudent(admin, { studentId: studentIds[0], batchId: batch2, enrolledOn: today }),
    ).rejects.toBeDefined();
  });
  it('rejects teacher admin actions', async () => {
    await expect(
      assignTeacher(teacher, { teacherId: teacher.id, batchId: batch2, active: true }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rolls back incomplete and duplicate roster submissions', async () => {
    await expect(
      saveAttendance(
        teacher,
        {
          sessionId,
          operationId,
          version,
          records: [{ studentId: studentIds[0], status: 'present' }],
        },
        true,
      ),
    ).rejects.toBeDefined();
    await expect(
      saveAttendance(
        teacher,
        {
          sessionId,
          operationId,
          version,
          records: [
            { studentId: studentIds[0], status: 'present' },
            { studentId: studentIds[0], status: 'absent' },
          ],
        },
        true,
      ),
    ).rejects.toBeDefined();
    const model = await getSession(teacher, sessionId);
    expect(model.records.every((r) => r.status === null)).toBe(true);
  });
  it('submits all four statuses atomically and tolerates an idempotent retry', async () => {
    const payload = {
      sessionId,
      operationId,
      version,
      records: studentIds.slice(0, 4).map((studentId, i) => ({
        studentId,
        status: ['present', 'absent', 'late', 'excused'][i],
      })),
    };
    const result = await saveAttendance(teacher, payload, true);
    version = result.version;
    expect(result.status).toBe('submitted');
    expect((await saveAttendance(teacher, payload, true)).status).toBe('submitted');
  });
  it('blocks submitted record mutation directly in PostgreSQL', async () => {
    await expect(
      actorTransaction(teacher, (tx) =>
        tx
          .update(s.attendanceRecords)
          .set({ status: 'absent' })
          .where(
            and(
              eq(s.attendanceRecords.sessionId, sessionId),
              eq(s.attendanceRecords.studentId, studentIds[0]),
            ),
          ),
      ),
    ).rejects.toBeDefined();
    await expect(
      actorTransaction(admin, (tx) =>
        tx
          .update(s.classSessions)
          .set({ status: 'open', submittedAt: null, submittedBy: null })
          .where(eq(s.classSessions.id, sessionId)),
      ),
    ).rejects.toBeDefined();
  });
  it('allows only audited admin corrections with a reason', async () => {
    const model = await getSession(admin, sessionId);
    const record = model.records.find((r) => r.studentId === studentIds[1])!;
    await expect(
      correctAttendance(teacher, {
        recordId: record.id,
        status: 'present',
        reason: 'Verified register',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      correctAttendance(admin, { recordId: record.id, status: 'present', reason: '' }),
    ).rejects.toBeDefined();
    await correctAttendance(admin, {
      recordId: record.id,
      status: 'present',
      reason: 'Verified original paper register',
    });
    const logs = await db
      .select()
      .from(s.auditLogs)
      .where(
        and(eq(s.auditLogs.entityId, record.id), eq(s.auditLogs.action, 'attendance_corrected')),
      );
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata.previous_status).toBe('absent');
    expect(logs[0].metadata.new_status).toBe('present');
  });
  it('prevents modifying or deleting audit history', async () => {
    await expect(
      db.execute(sql`update audit_logs set reason='tampered' where actor_id=${admin.id}::uuid`),
    ).rejects.toBeDefined();
  });
  it('uses submitted attendance and excludes excused from denominator', async () => {
    const rows = await reportRows({ batchId });
    expect(rows.find((r) => r.student_id === studentIds[0])?.percentage).toBe(100);
    expect(rows.find((r) => r.student_id === studentIds[3])?.percentage).toBeNull();
  });
  it('preserves historical rosters during a future transfer', async () => {
    const future = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
    const [enrollment] = await db
      .select()
      .from(s.enrollments)
      .where(
        and(
          eq(s.enrollments.studentId, studentIds[0]),
          eq(s.enrollments.batchId, batchId),
          eq(s.enrollments.status, 'active'),
        ),
      );
    await transferStudent(admin, {
      enrollmentId: enrollment.id,
      batchId: batch2,
      effectiveOn: future,
      reason: 'Changed to the later class',
    });
    expect((await getSession(admin, sessionId)).records).toHaveLength(4);
  });
  it('revokes a deactivated account immediately', async () => {
    await db.update(s.profiles).set({ status: 'archived' }).where(eq(s.profiles.id, other.id));
    await expect(openSession(other, sessionId)).rejects.toMatchObject({ status: 401 });
    expect(await authenticateStaff({ email: other.email, password: loginPassword })).toBeNull();
  });
  it('rejects concurrent non-idempotent finalizations', async () => {
    const [newSession] = await actorTransaction(admin, (tx) =>
      tx
        .insert(s.classSessions)
        .values({
          batchId,
          sessionDate: today,
          startTime: '09:00',
          endTime: '10:00',
          createdBy: admin.id,
        })
        .returning(),
    );
    await openSession(teacher, newSession.id);
    const model = await getSession(teacher, newSession.id);
    const base = {
      sessionId: newSession.id,
      version: 1,
      records: model.records.map((r) => ({ studentId: r.studentId, status: 'present' })),
    };
    const results = await Promise.allSettled([
      saveAttendance(teacher, { ...base, operationId: randomUUID() }, true),
      saveAttendance(teacher, { ...base, operationId: randomUUID() }, true),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('cancels sessions with an admin reason and blocks opening', async () => {
    const [row] = await actorTransaction(admin, (tx) =>
      tx
        .insert(s.classSessions)
        .values({
          batchId,
          sessionDate: today,
          startTime: '11:00',
          endTime: '12:00',
          createdBy: admin.id,
        })
        .returning(),
    );
    await cancelSession(admin, row.id, 'Public holiday cancellation');
    await expect(openSession(teacher, row.id)).rejects.toMatchObject({ status: 409 });
  });
});
