CREATE TABLE "cycle_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"total_issue_count" integer NOT NULL,
	"completed_issue_count" integer NOT NULL,
	"remaining_issue_count" integer NOT NULL,
	"planned_estimate" integer NOT NULL,
	"completed_estimate" integer NOT NULL,
	"remaining_estimate" integer NOT NULL,
	"missing_estimate_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_cycle_settings" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"timezone" varchar(80) DEFAULT 'UTC' NOT NULL,
	"duration_days" integer DEFAULT 14 NOT NULL,
	"cooldown_days" integer DEFAULT 0 NOT NULL,
	"next_start_date" date NOT NULL,
	"auto_create" boolean DEFAULT false NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_cycle_settings_duration_check" CHECK ("team_cycle_settings"."duration_days" BETWEEN 1 AND 90),
	CONSTRAINT "team_cycle_settings_cooldown_check" CHECK ("team_cycle_settings"."cooldown_days" BETWEEN 0 AND 90)
);
--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "scheduled_start_date" date;--> statement-breakpoint
ALTER TABLE "cycle_snapshots" ADD CONSTRAINT "cycle_snapshots_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_cycle_settings" ADD CONSTRAINT "team_cycle_settings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_cycle_settings" ADD CONSTRAINT "team_cycle_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_snapshots_cycle_at_unique" ON "cycle_snapshots" USING btree ("cycle_id","snapshot_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cycles_team_scheduled_start_unique" ON "cycles" USING btree ("team_id","scheduled_start_date") WHERE "cycles"."scheduled_start_date" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_date_range_check" CHECK ("cycles"."start_date" < "cycles"."end_date");--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_capacity_check" CHECK ("cycles"."capacity" IS NULL OR "cycles"."capacity" >= 0);--> statement-breakpoint
CREATE FUNCTION "guard_cycle_schedule_overlap"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."team_id"::text));
  IF NEW."is_completed" THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM "cycles" c
    WHERE c."team_id" = NEW."team_id"
      AND c."is_completed" = false
      AND c."id" IS DISTINCT FROM NEW."id"
      AND c."start_date" < NEW."end_date"
      AND c."end_date" > NEW."start_date"
  ) THEN
    RAISE EXCEPTION 'Cycle date range overlaps another open cycle for this team'
      USING ERRCODE = '23P01', CONSTRAINT = 'cycles_no_open_overlap';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "cycles_no_open_overlap_trigger"
BEFORE INSERT OR UPDATE OF "team_id", "start_date", "end_date", "is_completed" ON "cycles"
FOR EACH ROW EXECUTE FUNCTION "guard_cycle_schedule_overlap"();--> statement-breakpoint
CREATE FUNCTION "complete_reka_cycle"(p_cycle_id uuid, p_action text, p_next_cycle_id uuid)
RETURNS TABLE(success boolean, rolled_over_count integer, target_cycle_id uuid, already_completed boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_cycle "cycles"%ROWTYPE;
  v_target_id uuid;
  v_backlog_key text;
  v_issue_ids uuid[];
  v_total integer;
  v_completed integer;
  v_remaining integer;
  v_planned_estimate integer;
  v_completed_estimate integer;
  v_remaining_estimate integer;
  v_missing_estimates integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_action NOT IN ('backlog', 'next_cycle') THEN RAISE EXCEPTION 'Invalid incomplete issue action'; END IF;
  SELECT * INTO v_cycle FROM "cycles" WHERE "id" = p_cycle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cycle not found'; END IF;
  IF v_cycle."is_completed" THEN
    RETURN QUERY SELECT true, 0, NULL::uuid, true;
    RETURN;
  END IF;

  IF p_next_cycle_id IS NOT NULL THEN
    SELECT c."id" INTO v_target_id FROM "cycles" c
      WHERE c."id" = p_next_cycle_id AND c."team_id" = v_cycle."team_id"
        AND c."id" <> v_cycle."id" AND c."is_completed" = false AND c."start_date" >= v_cycle."end_date";
    IF v_target_id IS NULL THEN RAISE EXCEPTION 'Rollover target must be an open, non-overlapping cycle in the same team'; END IF;
  ELSIF p_action = 'next_cycle' THEN
    SELECT c."id" INTO v_target_id FROM "cycles" c
      WHERE c."team_id" = v_cycle."team_id" AND c."id" <> v_cycle."id"
        AND c."is_completed" = false AND c."start_date" >= v_cycle."end_date"
      ORDER BY c."start_date", c."number" LIMIT 1;
  END IF;

  SELECT COALESCE(array_agg(x."id"), ARRAY[]::uuid[]) INTO v_issue_ids
  FROM (
    SELECT i."id", COALESCE(s."category", CASE i."status"
      WHEN 'triage' THEN 'triage' WHEN 'backlog' THEN 'backlog' WHEN 'todo' THEN 'unstarted'
      WHEN 'done' THEN 'completed' WHEN 'canceled' THEN 'canceled' ELSE 'started' END) AS category
    FROM "issues" i LEFT JOIN "team_workflow_states" s ON s."team_id" = i."team_id" AND s."key" = i."status"
    WHERE i."cycle_id" = p_cycle_id AND i."team_id" = v_cycle."team_id" AND i."archived_at" IS NULL
  ) x WHERE x.category NOT IN ('completed', 'canceled', 'triage', 'backlog');
  IF p_action = 'next_cycle' AND cardinality(v_issue_ids) > 0 AND v_target_id IS NULL THEN
    RAISE EXCEPTION 'No later open cycle exists; choose Backlog or create a target cycle first';
  END IF;

  SELECT COALESCE(s."key", 'backlog') INTO v_backlog_key FROM "team_workflow_states" s
    WHERE s."team_id" = v_cycle."team_id" AND s."category" = 'backlog' AND s."is_active" = true
    ORDER BY s."position" LIMIT 1;
  v_backlog_key := COALESCE(v_backlog_key, 'backlog');

  SELECT count(*) FILTER (WHERE category IN ('unstarted', 'started', 'completed'))::integer,
         count(*) FILTER (WHERE category = 'completed')::integer,
         count(*) FILTER (WHERE category IN ('unstarted', 'started'))::integer,
         COALESCE(sum(estimate) FILTER (WHERE category IN ('unstarted', 'started', 'completed')), 0)::integer,
         COALESCE(sum(estimate) FILTER (WHERE category = 'completed'), 0)::integer,
         COALESCE(sum(estimate) FILTER (WHERE category IN ('unstarted', 'started')), 0)::integer,
         count(*) FILTER (WHERE category IN ('unstarted', 'started') AND estimate IS NULL)::integer
    INTO v_total, v_completed, v_remaining, v_planned_estimate, v_completed_estimate, v_remaining_estimate, v_missing_estimates
  FROM (
    SELECT i."estimate", COALESCE(s."category", CASE i."status"
      WHEN 'triage' THEN 'triage' WHEN 'backlog' THEN 'backlog' WHEN 'todo' THEN 'unstarted'
      WHEN 'done' THEN 'completed' WHEN 'canceled' THEN 'canceled' ELSE 'started' END) AS category
    FROM "issues" i LEFT JOIN "team_workflow_states" s ON s."team_id" = i."team_id" AND s."key" = i."status"
    WHERE i."cycle_id" = p_cycle_id AND i."team_id" = v_cycle."team_id" AND i."archived_at" IS NULL
  ) snapshot_issues;
  INSERT INTO "cycle_snapshots" ("cycle_id", "snapshot_at", "total_issue_count", "completed_issue_count", "remaining_issue_count", "planned_estimate", "completed_estimate", "remaining_estimate", "missing_estimate_count")
    VALUES (p_cycle_id, v_now, v_total, v_completed, v_remaining, v_planned_estimate, v_completed_estimate, v_remaining_estimate, v_missing_estimates)
    ON CONFLICT ("cycle_id", "snapshot_at") DO NOTHING;

  UPDATE "cycles" SET "is_completed" = true, "updated_at" = v_now WHERE "id" = p_cycle_id;
  IF cardinality(v_issue_ids) > 0 THEN
    UPDATE "issues" SET
      "cycle_id" = CASE WHEN p_action = 'backlog' THEN NULL ELSE v_target_id END,
      "status" = CASE WHEN p_action = 'backlog' THEN v_backlog_key ELSE "status" END,
      "updated_at" = v_now
    WHERE "id" = ANY(v_issue_ids);
  END IF;
  RETURN QUERY SELECT true, cardinality(v_issue_ids), v_target_id, false;
END;
$$;