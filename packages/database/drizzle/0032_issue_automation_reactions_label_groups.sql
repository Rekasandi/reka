CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid,
	"comment_id" uuid,
	"user_id" uuid NOT NULL,
	"emoji" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_single_target_check" CHECK (("reactions"."issue_id" IS NOT NULL) <> ("reactions"."comment_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "auto_close_parent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "auto_archive_months" integer;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "team_cycle_settings" ADD COLUMN "auto_rollover" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_issue_user_emoji_unique" ON "reactions" USING btree ("issue_id","user_id","emoji") WHERE "reactions"."issue_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_comment_user_emoji_unique" ON "reactions" USING btree ("comment_id","user_id","emoji") WHERE "reactions"."comment_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_parent_id_labels_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_auto_archive_months_check" CHECK ("teams"."auto_archive_months" IS NULL OR "teams"."auto_archive_months" BETWEEN 1 AND 60);