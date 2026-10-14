import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { cycles, cycleSnapshots, issues, teamCycleSettings, teamWorkflowStates, type DbClient } from '@reka/database';

const defaultCategory = (status: string) => ({ triage: 'triage', backlog: 'backlog', todo: 'unstarted', done: 'completed', canceled: 'canceled' } as Record<string, string>)[status] ?? 'started';
const included = new Set(['unstarted', 'started', 'completed']);
const active = new Set(['unstarted', 'started']);
const categoryFor = (issue: { teamId: string; status: string }, categories: Map<string, string>) => categories.get(`${issue.teamId}:${issue.status}`) ?? defaultCategory(issue.status);

/** Create at most one due cycle per configured team per invocation. A settings-row lock and
 * the scheduled-start unique index make concurrent/replayed worker jobs idempotent. */
export async function processDueTeamCycleSchedules(db: DbClient, now = new Date()) {
  const result = await db.execute(sql`
    WITH due AS (
      SELECT s.* FROM team_cycle_settings s
      WHERE s.auto_create = true AND (s.next_start_date::timestamp AT TIME ZONE s.timezone) <= ${now.toISOString()}::timestamptz
      ORDER BY s.team_id LIMIT 100 FOR UPDATE SKIP LOCKED
    ), ranges AS (
      SELECT d.*, d.next_start_date::timestamp AT TIME ZONE d.timezone AS starts_at,
        ((d.next_start_date + d.duration_days)::timestamp AT TIME ZONE d.timezone) - interval '1 millisecond' AS ends_at
      FROM due d
    ), blockers AS (
      SELECT r.team_id, r.next_start_date, MAX(c.end_date AT TIME ZONE r.timezone)::date AS overlap_end
      FROM ranges r LEFT JOIN cycles c ON c.team_id = r.team_id AND c.is_completed = false
        AND c.start_date < r.ends_at AND c.end_date > r.starts_at
      GROUP BY r.team_id, r.next_start_date
    ), ready AS (
      SELECT r.* FROM ranges r JOIN blockers b USING (team_id, next_start_date) WHERE b.overlap_end IS NULL
    ), created AS (
      INSERT INTO cycles (team_id, number, name, start_date, end_date, is_completed, scheduled_start_date)
      SELECT r.team_id,
        (SELECT COALESCE(MAX(c.number), 0) + 1 FROM cycles c WHERE c.team_id = r.team_id),
        'Cycle ' || (SELECT COALESCE(MAX(c.number), 0) + 1 FROM cycles c WHERE c.team_id = r.team_id),
        r.starts_at, r.ends_at, false, r.next_start_date
      FROM ready r
      ON CONFLICT (team_id, scheduled_start_date) WHERE scheduled_start_date IS NOT NULL DO NOTHING
      RETURNING id, team_id, number, scheduled_start_date
    ), advanced AS (
      UPDATE team_cycle_settings s SET
        next_start_date = CASE WHEN b.overlap_end IS NULL
          THEN s.next_start_date + s.duration_days + s.cooldown_days
          ELSE b.overlap_end + s.cooldown_days + 1 END,
        updated_at = ${now.toISOString()}::timestamptz
      FROM due d JOIN blockers b USING (team_id, next_start_date)
      WHERE s.team_id = d.team_id AND (SELECT count(*) FROM created) >= 0
      RETURNING s.team_id
    )
    SELECT created.*, (SELECT count(*)::integer FROM advanced) AS advanced_teams FROM created
  `);
  return result.rows as Array<{ id: string; team_id: string; number: number; scheduled_start_date: string }>;
}

/** Store one immutable six-hour sample per active cycle. Replaying in the same window is harmless. */
export async function captureCurrentCycleSnapshots(db: DbClient, now = new Date()) {
  const bucketMs = 6 * 60 * 60 * 1000;
  const snapshotAt = new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
  const currentCycles = await db.select().from(cycles).where(and(
    eq(cycles.isCompleted, false), lte(cycles.startDate, now), gte(cycles.endDate, now),
  ));
  if (!currentCycles.length) return [];
  const cycleIds = currentCycles.map(cycle => cycle.id);
  const [cycleIssues, states] = await Promise.all([
    db.select().from(issues).where(and(inArray(issues.cycleId, cycleIds), isNull(issues.archivedAt))),
    db.select({ teamId: teamWorkflowStates.teamId, key: teamWorkflowStates.key, category: teamWorkflowStates.category })
      .from(teamWorkflowStates).where(inArray(teamWorkflowStates.teamId, [...new Set(currentCycles.map(cycle => cycle.teamId))])),
  ]);
  const categories = new Map(states.map(state => [`${state.teamId}:${state.key}`, state.category]));
  const values = currentCycles.map(cycle => {
    const assigned = cycleIssues.filter(issue => issue.cycleId === cycle.id);
    const planned = assigned.filter(issue => included.has(categoryFor(issue, categories)));
    const completed = planned.filter(issue => categoryFor(issue, categories) === 'completed');
    const remaining = planned.filter(issue => active.has(categoryFor(issue, categories)));
    const sumEstimate = (items: typeof assigned) => items.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
    return {
      cycleId: cycle.id, snapshotAt, totalIssueCount: planned.length,
      completedIssueCount: completed.length, remainingIssueCount: remaining.length,
      plannedEstimate: sumEstimate(planned), completedEstimate: sumEstimate(completed), remainingEstimate: sumEstimate(remaining),
      missingEstimateCount: planned.filter(issue => issue.estimate === null).length,
    };
  });
  return db.insert(cycleSnapshots).values(values).onConflictDoNothing().returning();
}
