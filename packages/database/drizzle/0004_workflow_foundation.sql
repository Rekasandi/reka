CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "workspace_invitations_role_check" CHECK ("workspace_invitations"."role" IN ('admin', 'member')),
	CONSTRAINT "workspace_invitations_email_check" CHECK ("workspace_invitations"."email" = lower(trim("workspace_invitations"."email")))
);
--> statement-breakpoint
CREATE TABLE "issue_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"actor_id" uuid,
	"event" varchar(32) NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_history_event_check" CHECK ("issue_history"."event" IN ('baseline', 'created', 'updated', 'deleted'))
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_by_id_users_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_invitations_organization_email_idx" ON "workspace_invitations" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "issue_history_team_recorded_idx" ON "issue_history" USING btree ("team_id","recorded_at");--> statement-breakpoint
CREATE INDEX "issue_history_issue_sequence_idx" ON "issue_history" USING btree ("issue_id","id");
--> statement-breakpoint
-- Never silently enroll existing users into multiple unrelated companies.
DO $$
BEGIN
  IF (SELECT count(*) FROM "organizations") > 1 THEN
    RAISE EXCEPTION 'REKA single-workspace migration requires an explicitly selected organization; multiple organizations found';
  END IF;
END;
$$;
--> statement-breakpoint
-- Preserve existing accounts and roles, without choosing/promoting an owner.
INSERT INTO "organization_members" ("organization_id", "user_id", "role")
SELECT o."id", u."id", u."role" FROM "organizations" o CROSS JOIN "users" u
ON CONFLICT ("organization_id", "user_id") DO NOTHING;
--> statement-breakpoint
-- This is the instrumentation cutoff, not historical creation/completion data.
INSERT INTO "issue_history" ("issue_id", "team_id", "event", "after_state")
SELECT "id", "team_id", 'baseline', to_jsonb(i) FROM "issues" i;
--> statement-breakpoint
CREATE FUNCTION "record_reka_issue_history"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_state jsonb;
  next_state jsonb;
  changed_issue_id uuid;
  changed_team_id uuid;
  event_actor_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
      RETURN NULL;
    END IF;
    previous_state := to_jsonb(OLD);
  ELSIF TG_OP = 'DELETE' THEN
    previous_state := to_jsonb(OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    changed_issue_id := OLD.id;
    changed_team_id := OLD.team_id;
  ELSE
    changed_issue_id := NEW.id;
    changed_team_id := NEW.team_id;
    next_state := to_jsonb(NEW);
    IF TG_OP = 'INSERT' THEN
      event_actor_id := NEW.reporter_id;
    END IF;
  END IF;

  -- Unknown update/delete actors remain NULL, never guessed from assignee/reporter.
  -- Team hard-deletion cascades must retain their existing behavior.
  IF EXISTS (SELECT 1 FROM "teams" WHERE "id" = changed_team_id) THEN
    INSERT INTO "issue_history" ("issue_id", "team_id", "actor_id", "event", "before_state", "after_state")
    VALUES (changed_issue_id, changed_team_id, event_actor_id,
      CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
      previous_state, next_state);
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "reka_issue_history_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "issues"
FOR EACH ROW EXECUTE FUNCTION "record_reka_issue_history"();