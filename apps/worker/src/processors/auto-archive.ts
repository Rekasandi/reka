import { sql } from 'drizzle-orm';
import type { DbClient } from '@reka/database';

/** Archive completed/canceled issues that nobody touched for the team's `auto_archive_months`. Parents wait until
 * their children are archived. Idempotent: archived issues are skipped, and each archive is recorded as activity. */
export async function processAutoArchive(db: DbClient, now = new Date()) {
  const result = await db.execute(sql`
    WITH due AS (
      SELECT i.id, i.project_id, i.identifier FROM issues i
      JOIN teams t ON t.id = i.team_id AND t.auto_archive_months IS NOT NULL
      LEFT JOIN team_workflow_states s ON s.team_id = i.team_id AND s.key = i.status
      WHERE i.archived_at IS NULL
        AND COALESCE(s.category, CASE i.status WHEN 'done' THEN 'completed' WHEN 'canceled' THEN 'canceled' ELSE 'open' END) IN ('completed', 'canceled')
        AND i.updated_at < ${now.toISOString()}::timestamptz - (t.auto_archive_months * interval '1 month')
        AND NOT EXISTS (SELECT 1 FROM issues c WHERE c.parent_id = i.id AND c.archived_at IS NULL)
      ORDER BY i.updated_at LIMIT 500
      FOR UPDATE OF i SKIP LOCKED
    ), archived AS (
      UPDATE issues i SET archived_at = ${now.toISOString()}::timestamptz, archive_batch_id = gen_random_uuid(), updated_at = ${now.toISOString()}::timestamptz
      FROM due WHERE i.id = due.id RETURNING i.id, i.project_id, i.identifier
    )
    INSERT INTO activities (actor_id, issue_id, project_id, type, metadata)
    SELECT NULL, id, project_id, 'issue.auto_archived', jsonb_build_object('identifier', identifier) FROM archived
    RETURNING issue_id
  `);
  return result.rows as Array<{ issue_id: string }>;
}

/** Cancel backlog/unstarted/triage issues nobody touched for the team's `auto_close_stale_months` (Linear "auto-close").
 * Issues planned in an open cycle are left alone. Uses the first active canceled state, preferring one that isn't "duplicate". */
export async function processAutoCloseStale(db: DbClient, now = new Date()) {
  const result = await db.execute(sql`
    WITH due AS (
      SELECT i.id, i.project_id, i.identifier, i.status AS from_status, target.key AS to_status FROM issues i
      JOIN teams t ON t.id = i.team_id AND t.auto_close_stale_months IS NOT NULL
      JOIN team_workflow_states s ON s.team_id = i.team_id AND s.key = i.status AND s.category IN ('backlog', 'unstarted', 'triage')
      JOIN LATERAL (SELECT c.key FROM team_workflow_states c WHERE c.team_id = i.team_id AND c.category = 'canceled' AND c.is_active
        ORDER BY (c.key = 'duplicate'), c.position LIMIT 1) target ON true
      LEFT JOIN cycles cy ON cy.id = i.cycle_id
      WHERE i.archived_at IS NULL AND (cy.id IS NULL OR cy.is_completed)
        AND i.updated_at < ${now.toISOString()}::timestamptz - (t.auto_close_stale_months * interval '1 month')
      ORDER BY i.updated_at LIMIT 500
      FOR UPDATE OF i SKIP LOCKED
    ), closed AS (
      UPDATE issues i SET status = due.to_status, sla_breaches_at = NULL, updated_at = ${now.toISOString()}::timestamptz
      FROM due WHERE i.id = due.id RETURNING i.id, i.project_id, i.identifier, due.from_status, due.to_status
    )
    INSERT INTO activities (actor_id, issue_id, project_id, type, metadata)
    SELECT NULL, id, project_id, 'issue.status_changed', jsonb_build_object('identifier', identifier, 'from', from_status, 'to', to_status, 'auto', 'stale')
    FROM closed RETURNING issue_id
  `);
  return result.rows as Array<{ issue_id: string }>;
}
