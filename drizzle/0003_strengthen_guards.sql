CREATE OR REPLACE FUNCTION guard_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s class_sessions%ROWTYPE; actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; reason text:=current_setting('app.reason',true);
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Roster records cannot be deleted'; END IF;
 SELECT * INTO s FROM class_sessions WHERE id=NEW.session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing session'; END IF;
 IF TG_OP='UPDATE' AND (OLD.session_id,OLD.student_id) IS DISTINCT FROM (NEW.session_id,NEW.student_id) THEN RAISE EXCEPTION 'Roster identity is immutable'; END IF;
 IF TG_OP='INSERT' THEN
  IF s.status<>'open' OR s.roster_locked OR current_setting('app.opening_roster',true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Roster snapshot requires an open session'; END IF;
  IF NOT EXISTS(SELECT 1 FROM enrollments WHERE batch_id=s.batch_id AND student_id=NEW.student_id AND enrolled_on<=s.session_date AND (ended_on IS NULL OR ended_on>s.session_date)) THEN RAISE EXCEPTION 'Student not enrolled on session date'; END IF;
  IF EXISTS(SELECT 1 FROM attendance_records WHERE session_id=s.id) AND current_setting('app.opening_roster',true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Roster snapshot is immutable'; END IF;
 END IF;
 IF s.status='cancelled' OR s.status='scheduled' THEN RAISE EXCEPTION 'Session is not open'; END IF;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=actor AND status='active' AND (role='super_admin' OR EXISTS(SELECT 1 FROM teacher_assignments WHERE teacher_id=actor AND batch_id=s.batch_id AND active))) THEN RAISE EXCEPTION 'Unauthorized attendance operation'; END IF;
 IF s.status='submitted' THEN
  IF TG_OP<>'UPDATE' OR NEW.status IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=actor AND role='super_admin' AND status='active') OR length(trim(coalesce(reason,'')))<5 THEN RAISE EXCEPTION 'Correction requires an administrator and reason'; END IF;
  INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,reason,metadata) VALUES(actor,'attendance_corrected','attendance_record',NEW.id,reason,jsonb_build_object('previous_status',OLD.status,'new_status',NEW.status,'session_id',s.id,'student_id',NEW.student_id));
 END IF;
 RETURN NEW;
END $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid:=nullif(current_setting('app.actor_id',true),'')::uuid; is_admin boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM profiles WHERE id=actor AND role='super_admin' AND status='active') INTO is_admin;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Sessions must be cancelled, not deleted'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.roster_locked AND NOT NEW.roster_locked THEN RAISE EXCEPTION 'Roster cannot be unsealed'; END IF;
  IF OLD.status IN ('submitted','cancelled') THEN RAISE EXCEPTION 'Finalized sessions are immutable'; END IF;
  IF (NEW.batch_id,NEW.schedule_id,NEW.session_date,NEW.start_time,NEW.end_time,NEW.created_by) IS DISTINCT FROM (OLD.batch_id,OLD.schedule_id,OLD.session_date,OLD.start_time,OLD.end_time,OLD.created_by) THEN RAISE EXCEPTION 'Session identity is immutable'; END IF;
  IF NEW.status='scheduled' AND OLD.status='open' THEN RAISE EXCEPTION 'An open session cannot be reset'; END IF;
 END IF;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=actor AND status='active') THEN RAISE EXCEPTION 'Active staff context required'; END IF;
 IF NOT is_admin AND NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE teacher_id=actor AND batch_id=NEW.batch_id AND active) THEN RAISE EXCEPTION 'Unassigned batch'; END IF;
 IF NEW.status='cancelled' THEN
  IF NOT is_admin OR length(trim(coalesce(current_setting('app.reason',true),'')))<5 THEN RAISE EXCEPTION 'Cancellation requires admin and reason'; END IF;
  INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,reason,metadata) VALUES(actor,'session_cancelled','class_session',NEW.id,current_setting('app.reason',true),jsonb_build_object('previous_status',OLD.status));
 END IF;
 IF NEW.status='submitted' THEN
  IF TG_OP<>'UPDATE' OR OLD.status<>'open' THEN RAISE EXCEPTION 'Only open sessions can be submitted'; END IF;
  IF NOT NEW.roster_locked THEN RAISE EXCEPTION 'Roster snapshot must be sealed'; END IF;
  IF NEW.submitted_by<>actor THEN RAISE EXCEPTION 'Invalid submitter'; END IF;
  IF NOT EXISTS(SELECT 1 FROM batches b JOIN courses c ON c.id=b.course_id WHERE b.id=NEW.batch_id AND b.status='active' AND c.status='active') THEN RAISE EXCEPTION 'Batch is archived'; END IF;
  IF NOT EXISTS(SELECT 1 FROM attendance_records WHERE session_id=NEW.id) OR EXISTS(SELECT 1 FROM attendance_records WHERE session_id=NEW.id AND status IS NULL) THEN RAISE EXCEPTION 'Incomplete roster'; END IF;
 END IF;
 RETURN NEW;
END $$;

--> statement-breakpoint
ALTER TABLE class_sessions DISABLE TRIGGER session_guard;
UPDATE class_sessions SET roster_locked=true WHERE status IN ('open','submitted','cancelled');
ALTER TABLE class_sessions ENABLE TRIGGER session_guard;
--> statement-breakpoint
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L',current_database(),'Asia/Kathmandu'); END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_audit_truncate BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
