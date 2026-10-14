ALTER TABLE "users" ADD COLUMN "github_username" varchar(255);--> statement-breakpoint
DELETE FROM "notifications" WHERE "title" IN (
  'PR #142 Merged: Add optimistic UI updates for Kanban board',
  'Sarah Jenkins mentioned you on RS-58',
  'Assigned to RS-64: High-velocity triage inbox',
  'Alex Morgan requested your review on PR #149',
  'RS-49 moved to In Review',
  'Cycle 12 ends in 2 days',
  'Alex Morgan mentioned you on RS-104',
  'PR #182 Merged: Enhance issue query pagination'
);
