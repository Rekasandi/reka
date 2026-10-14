-- Existing GitHub activity is preserved; ambiguous duplicate delivery rows need review first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM activities
    WHERE type LIKE 'github.%' AND metadata ? 'webhookEventId'
    GROUP BY issue_id, type, metadata->>'webhookEventId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate GitHub webhook activity exists; reconcile before enabling delivery idempotency';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "github_activity_webhook_delivery_unique_idx" ON "activities" USING btree ("issue_id","type",("metadata"->>'webhookEventId')) WHERE "activities"."type" like 'github.%' and "activities"."metadata" ? 'webhookEventId';
