CREATE TABLE "issue_recurrence_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurrence_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"issue_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_issue_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" uuid,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"unit" varchar(16) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"template" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_recurrence_runs" ADD CONSTRAINT "issue_recurrence_runs_recurrence_id_issue_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."issue_recurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_recurrence_runs" ADD CONSTRAINT "issue_recurrence_runs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_recurrences" ADD CONSTRAINT "issue_recurrences_source_issue_id_issues_id_fk" FOREIGN KEY ("source_issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_recurrences" ADD CONSTRAINT "issue_recurrences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_recurrences" ADD CONSTRAINT "issue_recurrences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_recurrence_runs_schedule_unique_idx" ON "issue_recurrence_runs" USING btree ("recurrence_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "issue_recurrence_runs_issue_idx" ON "issue_recurrence_runs" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_recurrences_source_issue_unique_idx" ON "issue_recurrences" USING btree ("source_issue_id");--> statement-breakpoint
CREATE INDEX "issue_recurrences_due_idx" ON "issue_recurrences" USING btree ("enabled","next_run_at");
--> statement-breakpoint
ALTER TABLE issue_recurrences ADD CONSTRAINT issue_recurrences_interval_check CHECK (interval_count BETWEEN 1 AND 52);
--> statement-breakpoint
ALTER TABLE issue_recurrences ADD CONSTRAINT issue_recurrences_unit_check CHECK (unit IN ('day','week','month'));
--> statement-breakpoint
ALTER TABLE issue_recurrences ADD CONSTRAINT issue_recurrences_timezone_check CHECK (length(trim(timezone)) BETWEEN 1 AND 64);
--> statement-breakpoint
ALTER TABLE issue_recurrences ADD CONSTRAINT issue_recurrences_template_check CHECK (jsonb_typeof(template) = 'object' AND jsonb_typeof(template->'title') = 'string' AND jsonb_typeof(template->'labelIds') = 'array');