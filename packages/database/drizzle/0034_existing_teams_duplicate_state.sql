-- Linear-style workflow for teams created before 0033: add a Duplicate state (canceled category)
-- and drop the old default Blocked state when nothing uses it ("blocked" is a relation now).
INSERT INTO "team_workflow_states" ("team_id", "key", "name", "category", "color", "position", "is_active")
SELECT "team_id", 'duplicate', 'Duplicate', 'canceled', '#8f8f8f', MAX("position") + 1, true
FROM "team_workflow_states"
GROUP BY "team_id"
HAVING bool_and("key" <> 'duplicate') AND COUNT(*) < 16;--> statement-breakpoint
DELETE FROM "team_workflow_states" s
WHERE s."key" = 'blocked'
  AND NOT EXISTS (SELECT 1 FROM "issues" i WHERE i."team_id" = s."team_id" AND i."status" = 'blocked')
  AND NOT EXISTS (SELECT 1 FROM "issue_recurrences" r WHERE r."team_id" = s."team_id" AND r."template"->>'status' = 'blocked')
  AND NOT EXISTS (SELECT 1 FROM "issue_templates" t WHERE t."team_id" = s."team_id" AND t."default_status" = 'blocked')
  AND NOT EXISTS (SELECT 1 FROM "teams" tm WHERE tm."id" = s."team_id"
    AND 'blocked' IN (COALESCE(tm."default_status", ''), COALESCE(tm."duplicate_status", ''), COALESCE(tm."github_draft_status", ''), COALESCE(tm."github_open_status", ''), COALESCE(tm."github_merged_status", '')));
