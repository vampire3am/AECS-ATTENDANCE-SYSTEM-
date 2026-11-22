CREATE FUNCTION guard_student_checkin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session class_sessions%ROWTYPE; actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Check-in history cannot be deleted'; END IF;
 SELECT * INTO session FROM class_sessions WHERE id=NEW.session_id FOR UPDATE;
 IF NOT FOUND OR session.status<>'open' OR session.session_date<>(now() AT TIME ZONE 'Asia/Kathmandu')::date THEN RAISE EXCEPTION 'Check-in requires today''s open session'; END IF;
 IF NOT EXISTS(SELECT 1 FROM enrollments e JOIN attendance_records a ON a.student_id=e.student_id AND a.session_id=session.id WHERE e.id=NEW.enrollment_id AND e.student_id=NEW.student_id AND e.batch_id=session.batch_id AND e.enrolled_on<=session.session_date AND (e.ended_on IS NULL OR e.ended_on>session.session_date)) THEN RAISE EXCEPTION 'Check-in does not match the enrollment and roster'; END IF;
 IF TG_OP='INSERT' AND (NEW.verified_by IS NOT NULL OR NEW.verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Student check-ins must await verification'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (OLD.session_id,OLD.student_id,OLD.enrollment_id,OLD.checked_in_at) IS DISTINCT FROM (NEW.session_id,NEW.student_id,NEW.enrollment_id,NEW.checked_in_at) OR OLD.verified_at IS NOT NULL THEN RAISE EXCEPTION 'Check-in identity and verification are immutable'; END IF;
  IF NEW.verified_by IS DISTINCT FROM actor OR NEW.verified_at IS NULL OR NOT EXISTS(SELECT 1 FROM profiles p WHERE p.id=actor AND p.status='active' AND (p.role='super_admin' OR EXISTS(SELECT 1 FROM teacher_assignments a WHERE a.teacher_id=actor AND a.batch_id=session.batch_id AND a.active))) THEN RAISE EXCEPTION 'Verification requires an assigned staff member'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER student_checkin_guard BEFORE INSERT OR UPDATE OR DELETE ON student_checkins FOR EACH ROW EXECUTE FUNCTION guard_student_checkin();
--> statement-breakpoint
CREATE FUNCTION guard_enrollment_code() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.checkin_code IS DISTINCT FROM NEW.checkin_code THEN RAISE EXCEPTION 'Enrollment codes are immutable; a transfer creates a new enrollment and code'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_enrollment_code BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION guard_enrollment_code();
--> statement-breakpoint
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aecs_runtime') THEN
 GRANT SELECT,INSERT,UPDATE ON checkin_windows,student_checkins TO aecs_runtime;
END IF; END $$;
REVOKE ALL ON FUNCTION guard_student_checkin(),guard_enrollment_code() FROM PUBLIC;
