CREATE SEQUENCE student_code_seq START 1;
--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'late', 'excused');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'open', 'submitted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('super_admin', 'teacher');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"late_counts_as_present" boolean DEFAULT true NOT NULL,
	"minimum_attendance_percentage" numeric(5, 2) DEFAULT '75' NOT NULL,
	"organization_timezone" text DEFAULT 'Asia/Kathmandu' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("app_settings"."id"=1),
	CONSTRAINT "settings_percentage" CHECK ("app_settings"."minimum_attendance_percentage" between 0 and 100),
	CONSTRAINT "settings_timezone" CHECK ("app_settings"."organization_timezone"='Asia/Kathmandu')
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attendance_status",
	"marked_by" uuid,
	"marked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_session_student_key" UNIQUE("session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"status" "record_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "iso_weekday" CHECK ("batch_schedules"."weekday" between 1 and 7),
	CONSTRAINT "schedule_times" CHECK ("batch_schedules"."end_time" > "batch_schedules"."start_time"),
	CONSTRAINT "schedule_dates" CHECK ("batch_schedules"."effective_until" is null or "batch_schedules"."effective_until" >= "batch_schedules"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"timezone" text DEFAULT 'Asia/Kathmandu' NOT NULL,
	"status" "record_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_code_unique" UNIQUE("code"),
	CONSTRAINT "batch_course_key" UNIQUE("id","course_id"),
	CONSTRAINT "batch_dates" CHECK ("batches"."end_date" is null or "batches"."end_date" >= "batches"."start_date"),
	CONSTRAINT "batch_timezone" CHECK ("batches"."timezone" = 'Asia/Kathmandu')
);
--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"schedule_id" uuid,
	"session_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"created_by" uuid NOT NULL,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"operation_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_sessions_operation_id_unique" UNIQUE("operation_id"),
	CONSTRAINT "session_slot_key" UNIQUE("batch_id","session_date","start_time"),
	CONSTRAINT "session_times" CHECK ("class_sessions"."end_time" > "class_sessions"."start_time"),
	CONSTRAINT "submission_fields" CHECK (("class_sessions"."status" = 'submitted' and "class_sessions"."submitted_at" is not null and "class_sessions"."submitted_by" is not null) or ("class_sessions"."status" <> 'submitted' and "class_sessions"."submitted_at" is null and "class_sessions"."submitted_by" is null))
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "record_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"enrolled_on" date NOT NULL,
	"ended_on" date,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_dates" CHECK (("enrollments"."status" = 'active' and "enrollments"."ended_on" is null) or ("enrollments"."status" = 'ended' and "enrollments"."ended_on" >= "enrollments"."enrolled_on"))
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "staff_role" NOT NULL,
	"status" "record_status" DEFAULT 'active' NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_code" text DEFAULT 'AECS-' || lpad(nextval('student_code_seq')::text, 6, '0') NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"joined_on" date NOT NULL,
	"status" "record_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_student_code_unique" UNIQUE("student_code"),
	CONSTRAINT "student_name_phone_key" UNIQUE("full_name","phone")
);
--> statement-breakpoint
CREATE TABLE "teacher_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_profiles_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_schedules" ADD CONSTRAINT "batch_schedules_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_schedule_id_batch_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."batch_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_batch_id_course_id_batches_id_course_id_fk" FOREIGN KEY ("batch_id","course_id") REFERENCES "public"."batches"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_student_idx" ON "attendance_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "schedule_batch_idx" ON "batch_schedules" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_course_idx" ON "batches" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "session_date_idx" ON "class_sessions" USING btree ("session_date");--> statement-breakpoint
CREATE UNIQUE INDEX "active_student_course" ON "enrollments" USING btree ("student_id","course_id") WHERE "enrollments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "enrollment_batch_idx" ON "enrollments" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "enrollment_student_idx" ON "enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_name_idx" ON "students" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "student_email_unique" ON "students" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "active_assignment_key" ON "teacher_assignments" USING btree ("teacher_id","batch_id") WHERE "teacher_assignments"."active";--> statement-breakpoint
CREATE INDEX "assignment_batch_idx" ON "teacher_assignments" USING btree ("batch_id");