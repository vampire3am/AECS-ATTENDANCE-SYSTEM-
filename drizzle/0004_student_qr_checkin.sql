CREATE TABLE "checkin_windows" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"opened_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "checkin_session_student_key" UNIQUE("session_id","student_id"),
	CONSTRAINT "checkin_verification_fields" CHECK (("student_checkins"."verified_by" is null) = ("student_checkins"."verified_at" is null))
);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "checkin_code" text DEFAULT 'AECS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)) NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin_windows" ADD CONSTRAINT "checkin_windows_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_windows" ADD CONSTRAINT "checkin_windows_opened_by_profiles_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_checkins" ADD CONSTRAINT "student_checkins_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_checkins" ADD CONSTRAINT "student_checkins_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_checkins" ADD CONSTRAINT "student_checkins_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_checkins" ADD CONSTRAINT "student_checkins_verified_by_profiles_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkin_session_idx" ON "student_checkins" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_checkin_code_unique" UNIQUE("checkin_code");