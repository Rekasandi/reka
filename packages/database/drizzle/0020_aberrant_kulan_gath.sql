CREATE TABLE "project_update_subscriptions" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_update_subscriptions_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_update_subscriptions" ADD CONSTRAINT "project_update_subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_update_subscriptions" ADD CONSTRAINT "project_update_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "project_update_subscriptions" ("project_id", "user_id") SELECT "id", "owner_id" FROM "projects" ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "project_update_subscriptions" ("project_id", "user_id") SELECT "project_id", "user_id" FROM "project_members" ON CONFLICT DO NOTHING;