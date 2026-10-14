DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM github_pull_requests
    GROUP BY repository_id, pr_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate GitHub pull request records exist; reconcile before enforcing repository/PR identity';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "github_pull_requests_repository_pr_unique_idx" ON "github_pull_requests" USING btree ("repository_id","pr_number");