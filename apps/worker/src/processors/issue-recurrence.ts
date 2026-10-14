import { sql } from 'drizzle-orm';
import type { DbClient } from '@reka/database';

export async function processDueIssueRecurrences(db: DbClient, now = new Date(), maxOccurrences = 100) {
  const created: { recurrenceId: string; issueId: string; scheduledFor: Date }[] = [];
  for (let index = 0; index < maxOccurrences; index++) {
    const result = await db.execute(sql`
      WITH due AS MATERIALIZED (
        SELECT r.id, r.next_run_at AS scheduled_for
        FROM issue_recurrences r
        INNER JOIN issues source ON source.id = r.source_issue_id AND source.archived_at IS NULL
        WHERE r.enabled AND r.next_run_at <= ${now}
        ORDER BY r.next_run_at, r.id
        FOR UPDATE OF r SKIP LOCKED
        LIMIT 1
      ), claimed AS (
        UPDATE issue_recurrences r
        SET next_run_at = ((due.scheduled_for AT TIME ZONE r.timezone) + CASE r.unit
              WHEN 'day' THEN make_interval(days => r.interval_count)
              WHEN 'week' THEN make_interval(weeks => r.interval_count)
              ELSE make_interval(months => r.interval_count)
            END) AT TIME ZONE r.timezone,
            updated_at = ${now}
        FROM due
        WHERE r.id = due.id AND r.enabled
        RETURNING r.*, due.scheduled_for
      ), bumped AS (
        UPDATE teams team
        SET issue_counter = GREATEST(team.issue_counter, (SELECT COALESCE(MAX(number), 0) FROM issues WHERE team_id = team.id)) + 1
        FROM claimed recurrence
        WHERE team.id = recurrence.team_id
        RETURNING team.id AS team_id, team.key AS team_key, team.issue_counter AS issue_number, recurrence.id AS recurrence_id
      ), created AS (
        INSERT INTO issues (team_id, identifier, number, title, description, status, priority, type, project_id, cycle_id,
          assignee_id, reporter_id, parent_id, estimate, due_date)
        SELECT recurrence.team_id,
          bumped.team_key || '-' || bumped.issue_number::text,
          bumped.issue_number,
          recurrence.template->>'title',
          recurrence.template->>'description',
          recurrence.template->>'status',
          recurrence.template->>'priority',
          recurrence.template->>'type',
          (SELECT project.id FROM projects project WHERE project.id = NULLIF(recurrence.template->>'projectId', '')::uuid AND project.team_id = recurrence.team_id LIMIT 1),
          (SELECT cycle.id FROM cycles cycle WHERE cycle.id = NULLIF(recurrence.template->>'cycleId', '')::uuid AND cycle.team_id = recurrence.team_id AND cycle.end_date >= (recurrence.scheduled_for AT TIME ZONE recurrence.timezone)::date LIMIT 1),
          CASE WHEN EXISTS (
            SELECT 1 FROM teams target_team
            INNER JOIN organization_members membership ON membership.organization_id = target_team.organization_id
              AND membership.user_id = NULLIF(recurrence.template->>'assigneeId', '')::uuid AND membership.is_active
              AND membership.role IN ('owner','admin','member')
            WHERE target_team.id = recurrence.team_id AND (NOT target_team.is_private OR EXISTS (
              SELECT 1 FROM team_members member WHERE member.team_id = target_team.id AND member.user_id = membership.user_id
            ))
          ) THEN NULLIF(recurrence.template->>'assigneeId', '')::uuid ELSE NULL END,
          COALESCE(recurrence.created_by, source.reporter_id),
          (SELECT parent.id FROM issues parent WHERE parent.id = NULLIF(recurrence.template->>'parentId', '')::uuid
            AND parent.team_id = recurrence.team_id AND parent.archived_at IS NULL LIMIT 1),
          NULLIF(recurrence.template->>'estimate', '')::integer,
          CASE WHEN NULLIF(recurrence.template->>'dueDateOffsetDays', '') IS NULL THEN NULL
            ELSE (((recurrence.scheduled_for AT TIME ZONE recurrence.timezone)::date + (recurrence.template->>'dueDateOffsetDays')::integer)::timestamp AT TIME ZONE recurrence.timezone)
          END
        FROM claimed recurrence
        INNER JOIN bumped ON bumped.recurrence_id = recurrence.id
        INNER JOIN issues source ON source.id = recurrence.source_issue_id
        RETURNING id, team_id
      ), attached_labels AS (
        INSERT INTO issue_labels (issue_id, label_id)
        SELECT created.id, label.id
        FROM created
        INNER JOIN claimed recurrence ON recurrence.team_id = created.team_id
        INNER JOIN teams target_team ON target_team.id = created.team_id
        CROSS JOIN LATERAL jsonb_array_elements_text(recurrence.template->'labelIds') label_value(value)
        INNER JOIN labels label ON label.id = label_value.value::uuid AND label.organization_id = target_team.organization_id
          AND (label.team_id IS NULL OR label.team_id = target_team.id)
          AND (label.project_id IS NULL OR label.project_id = NULLIF(recurrence.template->>'projectId', '')::uuid)
        ON CONFLICT DO NOTHING
        RETURNING issue_id
      ), logged AS (
        INSERT INTO activities (actor_id, issue_id, type, metadata)
        SELECT COALESCE(recurrence.created_by, source.reporter_id), created.id, 'issue.recurring_created',
          jsonb_build_object('recurrenceId', recurrence.id, 'sourceIssueId', recurrence.source_issue_id, 'scheduledFor', recurrence.scheduled_for)
        FROM created
        INNER JOIN claimed recurrence ON recurrence.team_id = created.team_id
        INNER JOIN issues source ON source.id = recurrence.source_issue_id
        RETURNING id
      ), recorded AS (
        INSERT INTO issue_recurrence_runs (recurrence_id, scheduled_for, issue_id)
        SELECT recurrence.id, recurrence.scheduled_for, created.id
        FROM claimed recurrence
        INNER JOIN created ON created.team_id = recurrence.team_id
        CROSS JOIN (SELECT COUNT(*) FROM attached_labels) labels_written
        CROSS JOIN (SELECT COUNT(*) FROM logged) events_written
        RETURNING recurrence_id, issue_id, scheduled_for
      )
      SELECT recurrence_id AS "recurrenceId", issue_id AS "issueId", scheduled_for AS "scheduledFor" FROM recorded
    `);
    const row = result.rows[0] as { recurrenceId: string; issueId: string; scheduledFor: Date | string } | undefined;
    if (!row) break;
    created.push({ ...row, scheduledFor: new Date(row.scheduledFor) });
  }
  return created;
}
