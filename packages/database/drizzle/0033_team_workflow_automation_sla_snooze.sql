ALTER TABLE "teams" ADD COLUMN "auto_close_children" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "auto_close_stale_months" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "triage_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "sla_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "default_status" varchar(32);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "duplicate_status" varchar(32);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "github_draft_status" varchar(32);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "github_open_status" varchar(32);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "github_merged_status" varchar(32);--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "sla_breaches_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "snoozed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_auto_close_stale_months_check" CHECK ("teams"."auto_close_stale_months" IS NULL OR "teams"."auto_close_stale_months" BETWEEN 1 AND 60);