ALTER TABLE "projects" DROP CONSTRAINT "projects_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "github_issue_number" integer;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "github_issue_url" text;--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD COLUMN "ci_status" varchar(32) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD COLUMN "review_status" varchar(32) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD COLUMN "deploy_env" varchar(64);--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD COLUMN "deploy_url" text;--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD COLUMN "release_tag" varchar(64);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;