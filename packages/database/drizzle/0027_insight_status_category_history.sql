ALTER TABLE "issue_history" ADD COLUMN "before_status_category" varchar(16);
--> statement-breakpoint
ALTER TABLE "issue_history" ADD COLUMN "after_status_category" varchar(16);
--> statement-breakpoint
-- Preserve legacy rows as unknown; only future trigger events have category-at-the-time evidence.
CREATE OR REPLACE FUNCTION "record_reka_issue_history"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_state jsonb;
  next_state jsonb;
  changed_issue_id uuid;
  changed_team_id uuid;
  event_actor_id uuid;
  previous_status_category varchar(16);
  next_status_category varchar(16);
  previous_team_id uuid;
  previous_status varchar(32);
  next_team_id uuid;
  next_status varchar(32);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
      RETURN NULL;
    END IF;
    previous_state := to_jsonb(OLD);
    previous_team_id := OLD.team_id;
    previous_status := OLD.status;
  ELSIF TG_OP = 'DELETE' THEN
    previous_state := to_jsonb(OLD);
    previous_team_id := OLD.team_id;
    previous_status := OLD.status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    changed_issue_id := OLD.id;
    changed_team_id := OLD.team_id;
  ELSE
    changed_issue_id := NEW.id;
    changed_team_id := NEW.team_id;
    next_state := to_jsonb(NEW);
    next_team_id := NEW.team_id;
    next_status := NEW.status;
    IF TG_OP = 'INSERT' THEN
      event_actor_id := NEW.reporter_id;
    END IF;
  END IF;

  IF previous_team_id IS NOT NULL THEN
    SELECT category INTO previous_status_category FROM team_workflow_states
      WHERE team_id = previous_team_id AND key = previous_status;
    IF previous_status_category IS NULL THEN
      previous_status_category := CASE previous_status
        WHEN 'backlog' THEN 'backlog' WHEN 'todo' THEN 'unstarted'
        WHEN 'in_progress' THEN 'started' WHEN 'in_review' THEN 'started'
        WHEN 'ready_to_deploy' THEN 'started' WHEN 'blocked' THEN 'started'
        WHEN 'done' THEN 'completed' WHEN 'canceled' THEN 'canceled' WHEN 'triage' THEN 'triage'
        ELSE NULL END;
    END IF;
  END IF;
  IF next_team_id IS NOT NULL THEN
    SELECT category INTO next_status_category FROM team_workflow_states
      WHERE team_id = next_team_id AND key = next_status;
    IF next_status_category IS NULL THEN
      next_status_category := CASE next_status
        WHEN 'backlog' THEN 'backlog' WHEN 'todo' THEN 'unstarted'
        WHEN 'in_progress' THEN 'started' WHEN 'in_review' THEN 'started'
        WHEN 'ready_to_deploy' THEN 'started' WHEN 'blocked' THEN 'started'
        WHEN 'done' THEN 'completed' WHEN 'canceled' THEN 'canceled' WHEN 'triage' THEN 'triage'
        ELSE NULL END;
    END IF;
  END IF;

  -- Unknown update/delete actors remain NULL, never guessed from assignee/reporter.
  -- Team hard-deletion cascades must retain their existing behavior.
  IF EXISTS (SELECT 1 FROM teams WHERE id = changed_team_id) THEN
    INSERT INTO issue_history (issue_id, team_id, actor_id, event, before_state, after_state, before_status_category, after_status_category)
    VALUES (changed_issue_id, changed_team_id, event_actor_id,
      CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
      previous_state, next_state, previous_status_category, next_status_category);
  END IF;
  RETURN NULL;
END;
$$;
