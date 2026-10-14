ALTER TABLE team_workflow_states DROP CONSTRAINT team_workflow_states_category_check;
--> statement-breakpoint
ALTER TABLE team_workflow_states ADD CONSTRAINT team_workflow_states_category_check CHECK (category IN ('triage','backlog','unstarted','started','completed','canceled'));
--> statement-breakpoint
INSERT INTO team_workflow_states (team_id, key, name, category, color, position)
SELECT teams.id, 'triage', 'Triage', 'triage', '#ec9a3c', COALESCE(MAX(states.position), -1) + 1
FROM teams LEFT JOIN team_workflow_states states ON states.team_id = teams.id
GROUP BY teams.id
ON CONFLICT (team_id, key) DO NOTHING;
--> statement-breakpoint
CREATE TABLE "issue_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid,
	"name" varchar(100) NOT NULL,
	"title_prefix" varchar(80) DEFAULT '' NOT NULL,
	"description" text,
	"default_status" varchar(32) DEFAULT 'triage' NOT NULL,
	"default_type" varchar(32) DEFAULT 'task' NOT NULL,
	"default_priority" varchar(32) DEFAULT 'no_priority' NOT NULL,
	"default_estimate" integer,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_templates_estimate_check" CHECK ("issue_templates"."default_estimate" IS NULL OR ("issue_templates"."default_estimate" BETWEEN 0 AND 100))
);
--> statement-breakpoint
ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_templates_team_name_unique_idx" ON "issue_templates" USING btree ("organization_id","team_id","name");