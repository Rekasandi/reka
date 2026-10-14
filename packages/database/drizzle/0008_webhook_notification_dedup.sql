-- Preserve existing rows and fail safely rather than discarding any duplicate history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM notifications
    WHERE metadata->>'webhookEventId' IS NOT NULL
      AND metadata->>'issueId' IS NOT NULL
    GROUP BY user_id, type, metadata->>'webhookEventId', metadata->>'issueId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate GitHub webhook notifications exist; reconcile before adding the idempotency guard';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX notifications_webhook_delivery_unique_idx
  ON notifications (user_id, type, (metadata->>'webhookEventId'), (metadata->>'issueId'))
  WHERE metadata->>'webhookEventId' IS NOT NULL
    AND metadata->>'issueId' IS NOT NULL;
