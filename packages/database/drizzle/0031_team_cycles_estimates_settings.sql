ALTER TABLE "teams" ADD COLUMN "cycles_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "estimates_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "estimate_scale" varchar(16) DEFAULT 'fibonacci' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_estimate_scale_check" CHECK ("teams"."estimate_scale" IN ('fibonacci', 'exponential', 'linear', 'free'));