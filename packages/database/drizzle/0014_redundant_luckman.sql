CREATE TABLE "team_workflow_states" (
	"team_id" uuid NOT NULL,
	"key" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"category" varchar(16) NOT NULL,
	"color" varchar(7) DEFAULT '#8f8f8f' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_workflow_states_team_id_key_pk" PRIMARY KEY("team_id","key")
);
--> statement-breakpoint
ALTER TABLE "team_workflow_states" ADD CONSTRAINT "team_workflow_states_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE team_workflow_states ADD CONSTRAINT team_workflow_states_key_check CHECK (key ~ '^[a-z][a-z0-9_]{0,31}$');
--> statement-breakpoint
ALTER TABLE team_workflow_states ADD CONSTRAINT team_workflow_states_category_check CHECK (category IN ('backlog','unstarted','started','completed','canceled'));
--> statement-breakpoint
ALTER TABLE team_workflow_states ADD CONSTRAINT team_workflow_states_color_check CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
--> statement-breakpoint
ALTER TABLE team_workflow_states ADD CONSTRAINT team_workflow_states_position_check CHECK (position >= 0);
--> statement-breakpoint
INSERT INTO team_workflow_states (team_id, key, name, category, color, position) 
SELECT teams.id, defaults.key, defaults.name, defaults.category, defaults.color, defaults.position
FROM teams CROSS JOIN (VALUES
  ('backlog','Backlog','backlog','#8f8f8f',0),
  ('todo','Todo','unstarted','#b0b0b0',1),
  ('in_progress','In Progress','started','#f5a623',2),
  ('in_review','In Review','started','#50e3c2',3),
  ('ready_to_deploy','Ready to Deploy','started','#0070f3',4),
  ('done','Done','completed','#7928ca',5),
  ('canceled','Canceled','canceled','#8f8f8f',6),
  ('blocked','Blocked','started','#ee0000',7)
) AS defaults(key,name,category,color,position);