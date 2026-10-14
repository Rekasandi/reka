-- Duplicate branch links need explicit reconciliation; never discard existing rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM github_branches
    WHERE issue_id IS NOT NULL
    GROUP BY repository_id, issue_id, name
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate linked GitHub branches exist; reconcile before enabling branch webhook idempotency';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "github_branches_repo_issue_name_unique_idx" ON "github_branches" USING btree ("repository_id", "issue_id", "name");
