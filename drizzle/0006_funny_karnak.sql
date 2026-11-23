CREATE TABLE "teacher_course_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_course_key" UNIQUE("teacher_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "teacher_course_assignments" ADD CONSTRAINT "teacher_course_assignments_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_course_assignments" ADD CONSTRAINT "teacher_course_assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teacher_course_teacher_idx" ON "teacher_course_assignments" USING btree ("teacher_id");INSERT INTO teacher_course_assignments (teacher_id, course_id)
SELECT DISTINCT a.teacher_id,b.course_id FROM teacher_assignments a JOIN batches b ON b.id=a.batch_id JOIN profiles p ON p.id=a.teacher_id WHERE a.active AND p.role='teacher'
ON CONFLICT (teacher_id,course_id) DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION guard_teacher_course_access() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_role text;
BEGIN
 IF nullif(current_setting('app.actor_id',true),'') IS NOT NULL THEN
  SELECT role::text INTO actor_role FROM profiles WHERE id=nullif(current_setting('app.actor_id',true),'')::uuid AND status='active';
  IF actor_role IS DISTINCT FROM 'super_admin' THEN RAISE EXCEPTION 'Only administrators may grant course access' USING ERRCODE='42501'; END IF;
 ELSIF current_user='aecs_runtime' THEN
  RAISE EXCEPTION 'Authenticated administrator required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.teacher_id AND role='teacher') THEN RAISE EXCEPTION 'Teacher account required'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER teacher_course_access_guard BEFORE INSERT OR UPDATE ON teacher_course_assignments FOR EACH ROW EXECUTE FUNCTION guard_teacher_course_access();
--> statement-breakpoint
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aecs_runtime') THEN GRANT SELECT,INSERT,UPDATE ON teacher_course_assignments TO aecs_runtime; END IF; END $$;
