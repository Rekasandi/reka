CREATE TABLE "initiative_projects" (
	"initiative_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_projects_initiative_id_project_id_pk" PRIMARY KEY("initiative_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "initiatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" varchar(24) DEFAULT 'planned' NOT NULL,
	"health" varchar(24) DEFAULT 'on_track' NOT NULL,
	"owner_id" uuid NOT NULL,
	"start_date" timestamp with time zone,
	"target_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiatives_status_check" CHECK ("initiatives"."status" IN ('planned', 'in_progress', 'completed', 'canceled')),
	CONSTRAINT "initiatives_health_check" CHECK ("initiatives"."health" IN ('on_track', 'at_risk', 'off_track')),
	CONSTRAINT "initiatives_date_range_check" CHECK ("initiatives"."start_date" IS NULL OR "initiatives"."target_date" IS NULL OR "initiatives"."start_date" <= "initiatives"."target_date")
);
--> statement-breakpoint
ALTER TABLE "initiative_projects" ADD CONSTRAINT "initiative_projects_initiative_id_initiatives_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_projects" ADD CONSTRAINT "initiative_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_projects" ADD CONSTRAINT "initiative_projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_projects_project_idx" ON "initiative_projects" USING btree ("project_id","initiative_id");--> statement-breakpoint
CREATE INDEX "initiatives_org_updated_idx" ON "initiatives" USING btree ("organization_id","updated_at");