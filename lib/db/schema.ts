import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const staffRole = pgEnum('staff_role', ['super_admin', 'teacher']);
export const recordStatus = pgEnum('record_status', ['active', 'archived']);
export const enrollmentStatus = pgEnum('enrollment_status', ['active', 'ended']);
export const sessionStatus = pgEnum('session_status', [
  'scheduled',
  'open',
  'submitted',
  'cancelled',
]);
export const attendanceStatus = pgEnum('attendance_status', [
  'present',
  'absent',
  'late',
  'excused',
]);
const id = () => uuid('id').primaryKey().defaultRandom();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
export const profiles = pgTable('profiles', {
  id: id(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  role: staffRole('role').notNull(),
  status: recordStatus('status').notNull().default('active'),
  sessionVersion: integer('session_version').notNull().default(1),
  createdAt: created(),
  updatedAt: updated(),
});
export const courses = pgTable('courses', {
  id: id(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  status: recordStatus('status').notNull().default('active'),
  createdAt: created(),
  updatedAt: updated(),
});
export const batches = pgTable(
  'batches',
  {
    id: id(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    timezone: text('timezone').notNull().default('Asia/Kathmandu'),
    status: recordStatus('status').notNull().default('active'),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    unique('batch_course_key').on(t.id, t.courseId),
    index('batch_course_idx').on(t.courseId),
    check('batch_dates', sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    check('batch_timezone', sql`${t.timezone} = 'Asia/Kathmandu'`),
  ],
);
export const students = pgTable(
  'students',
  {
    id: id(),
    studentCode: text('student_code')
      .notNull()
      .unique()
      .default(sql`'AECS-' || lpad(nextval('student_code_seq')::text, 6, '0')`),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    joinedOn: date('joined_on').notNull(),
    status: recordStatus('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index('student_name_idx').on(t.fullName),
    uniqueIndex('student_email_unique').on(t.email),
    unique('student_name_phone_key').on(t.fullName, t.phone),
  ],
);
export const enrollments = pgTable(
  'enrollments',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    batchId: uuid('batch_id').notNull(),
    courseId: uuid('course_id').notNull(),
    checkinCode: text('checkin_code')
      .notNull()
      .unique()
      .default(sql`'AECS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20))`),
    enrolledOn: date('enrolled_on').notNull(),
    endedOn: date('ended_on'),
    status: enrollmentStatus('status').notNull().default('active'),
    createdAt: created(),
  },
  (t) => [
    foreignKey({
      columns: [t.batchId, t.courseId],
      foreignColumns: [batches.id, batches.courseId],
    }),
    uniqueIndex('active_student_course')
      .on(t.studentId, t.courseId)
      .where(sql`${t.status} = 'active'`),
    index('enrollment_batch_idx').on(t.batchId),
    index('enrollment_student_idx').on(t.studentId),
    check(
      'enrollment_dates',
      sql`(${t.status} = 'active' and ${t.endedOn} is null) or (${t.status} = 'ended' and ${t.endedOn} >= ${t.enrolledOn})`,
    ),
  ],
);
export const batchSchedules = pgTable(
  'batch_schedules',
  {
    id: id(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id),
    weekday: integer('weekday').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveUntil: date('effective_until'),
    status: recordStatus('status').notNull().default('active'),
    createdAt: created(),
  },
  (t) => [
    index('schedule_batch_idx').on(t.batchId),
    check('iso_weekday', sql`${t.weekday} between 1 and 7`),
    check('schedule_times', sql`${t.endTime} > ${t.startTime}`),
    check(
      'schedule_dates',
      sql`${t.effectiveUntil} is null or ${t.effectiveUntil} >= ${t.effectiveFrom}`,
    ),
  ],
);
export const teacherAssignments = pgTable(
  'teacher_assignments',
  {
    id: id(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => profiles.id),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('active_assignment_key')
      .on(t.teacherId, t.batchId)
      .where(sql`${t.active}`),
    index('assignment_batch_idx').on(t.batchId),
  ],
);
export const teacherCourseAssignments = pgTable(
  'teacher_course_assignments',
  {
    id: id(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => profiles.id),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    active: boolean('active').notNull().default(true),
    assignedAt: created(),
  },
  (t) => [
    unique('teacher_course_key').on(t.teacherId, t.courseId),
    index('teacher_course_teacher_idx').on(t.teacherId),
  ],
);
export const classSessions = pgTable(
  'class_sessions',
  {
    id: id(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id),
    scheduleId: uuid('schedule_id').references(() => batchSchedules.id),
    sessionDate: date('session_date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    status: sessionStatus('status').notNull().default('scheduled'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    submittedBy: uuid('submitted_by').references(() => profiles.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    operationId: uuid('operation_id').unique(),
    version: integer('version').notNull().default(1),
    rosterLocked: boolean('roster_locked').notNull().default(false),
    notes: text('notes'),
    createdAt: created(),
  },
  (t) => [
    unique('session_slot_key').on(t.batchId, t.sessionDate, t.startTime),
    index('session_date_idx').on(t.sessionDate),
    check('session_times', sql`${t.endTime} > ${t.startTime}`),
    check(
      'submission_fields',
      sql`(${t.status} = 'submitted' and ${t.submittedAt} is not null and ${t.submittedBy} is not null) or (${t.status} <> 'submitted' and ${t.submittedAt} is null and ${t.submittedBy} is null)`,
    ),
  ],
);
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: id(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    status: attendanceStatus('status'),
    markedBy: uuid('marked_by').references(() => profiles.id),
    markedAt: timestamp('marked_at', { withTimezone: true }),
    updatedAt: updated(),
  },
  (t) => [
    unique('attendance_session_student_key').on(t.sessionId, t.studentId),
    index('attendance_student_idx').on(t.studentId),
  ],
);
export const appSettings = pgTable(
  'app_settings',
  {
    id: integer('id').primaryKey().default(1),
    lateCountsAsPresent: boolean('late_counts_as_present').notNull().default(true),
    minimumAttendancePercentage: numeric('minimum_attendance_percentage', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('75'),
    organizationTimezone: text('organization_timezone').notNull().default('Asia/Kathmandu'),
    updatedAt: updated(),
  },
  (t) => [
    check('settings_singleton', sql`${t.id}=1`),
    check('settings_percentage', sql`${t.minimumAttendancePercentage} between 0 and 100`),
    check('settings_timezone', sql`${t.organizationTimezone}='Asia/Kathmandu'`),
  ],
);
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => profiles.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: created(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
);
export const loginAttempts = pgTable('login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});
export const checkinWindows = pgTable('checkin_windows', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => classSessions.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  openedBy: uuid('opened_by')
    .notNull()
    .references(() => profiles.id),
});
export const studentCheckins = pgTable(
  'student_checkins',
  {
    id: id(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedBy: uuid('verified_by').references(() => profiles.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (t) => [
    unique('checkin_session_student_key').on(t.sessionId, t.studentId),
    index('checkin_session_idx').on(t.sessionId),
    check(
      'checkin_verification_fields',
      sql`(${t.verifiedBy} is null) = (${t.verifiedAt} is null)`,
    ),
  ],
);
