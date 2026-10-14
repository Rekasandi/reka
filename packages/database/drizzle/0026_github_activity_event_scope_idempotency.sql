-- Keep the existing per-type delivery index; do not rewrite historical activity.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM activities
    WHERE type LIKE 'github.%' AND metadata ? 'webhookEventId'
    GROUP BY issue_id, metadata->>'webhookEventId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate GitHub webhook activity exists for an issue delivery; reconcile before enabling cross-type idempotency';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "github_activity_webhook_delivery_per_issue_unique_idx" ON "activities" USING btree ("issue_id", ("metadata"->>'webhookEventId')) WHERE "activities"."type" like 'github.%' and "activities"."metadata" ? 'webhookEventId';
