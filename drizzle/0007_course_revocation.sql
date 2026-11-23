-- Reconcile legacy assignments that remained active after a course was removed.
WITH revoked AS (
 UPDATE teacher_assignments a SET active=false
 FROM batches b WHERE b.id=a.batch_id AND a.active
 AND NOT EXISTS(SELECT 1 FROM teacher_course_assignments g WHERE g.teacher_id=a.teacher_id AND g.course_id=b.course_id AND g.active)
 RETURNING a.teacher_id
)
UPDATE profiles SET session_version=session_version+1,updated_at=now()
WHERE id IN(SELECT DISTINCT teacher_id FROM revoked);
--> statement-breakpoint
CREATE FUNCTION revoke_teacher_course_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.active AND NOT NEW.active THEN
  UPDATE teacher_assignments a SET active=false FROM batches b
  WHERE a.batch_id=b.id AND a.teacher_id=NEW.teacher_id AND b.course_id=NEW.course_id AND a.active;
  UPDATE profiles SET session_version=session_version+1,updated_at=now() WHERE id=NEW.teacher_id;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER revoke_teacher_course AFTER UPDATE OF active ON teacher_course_assignments
FOR EACH ROW EXECUTE FUNCTION revoke_teacher_course_access();
