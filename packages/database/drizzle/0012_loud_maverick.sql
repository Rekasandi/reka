ALTER TABLE "teams" ADD COLUMN "issue_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM issues GROUP BY team_id, number HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate issue numbers exist within a team; reconcile before enforcing issue identity';
  END IF;
END $$;
--> statement-breakpoint
UPDATE teams SET issue_counter = COALESCE((SELECT max(number) FROM issues WHERE issues.team_id = teams.id), 0);
--> statement-breakpoint
CREATE UNIQUE INDEX "issues_team_number_unique_idx" ON "issues" USING btree ("team_id","number");