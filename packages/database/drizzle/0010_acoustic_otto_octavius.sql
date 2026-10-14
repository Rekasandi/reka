DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM activities
    WHERE type IN ('github.pr_opened', 'github.pr_merged') AND metadata ? 'webhookEventId'
    GROUP BY issue_id, type, metadata->>'webhookEventId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate GitHub webhook activities exist; reconcile before enforcing delivery idempotency';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "github_activity_webhook_event_unique_idx" ON "activities" USING btree ("issue_id","type",("metadata"->>'webhookEventId')) WHERE "activities"."type" in ('github.pr_opened', 'github.pr_merged') and "activities"."metadata" ? 'webhookEventId';