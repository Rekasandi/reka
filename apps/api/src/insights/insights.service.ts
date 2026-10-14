import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lt, max, or } from 'drizzle-orm';
import {
  cycleSnapshots, cycles, issueHistory, issueLabels, issues, labels, projects, savedViews, users,
  type SavedIssueViewConfig,
} from '@reka/database';
import { DatabaseService } from '../common/database/database.service';
import {
  cycleScope, issueScope, labelScope, projectScope, requireCycle, requireProject, requireResourceId, requireTeam, requireWorkspace,
  userScope, visibleTeamIds,
} from '../common/access/workspace-access';
import type { WorkspaceActor } from '../common/access/workspace-access';
import type { InsightsCycleQueryDto, InsightsReportQueryDto } from './dto/insights.dto';

const MAX_HISTORY_ROWS = 50_000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type HistoryRow = typeof issueHistory.$inferSelect;
type MetricView = { teamId: string | null; config: SavedIssueViewConfig };

function dateOnly(value?: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Dates must use YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new BadRequestException('Invalid calendar date');
  return value;
}

function dayString(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Convert local midnight to UTC without assuming a fixed offset; this honors DST.
function localMidnightUtc(day: string, timezone: string) {
  const [year, month, date] = day.split('-').map(Number);
  const target = Date.UTC(year, month - 1, date);
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value || 0);
    const represented = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    const delta = target - represented;
    if (!delta) break;
    guess += delta;
  }
  return new Date(guess);
}

function resolveRange(query: InsightsReportQueryDto) {
  const timezone = query.timezone || 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { throw new BadRequestException('Timezone must be a valid IANA timezone'); }
  const today = dayString(new Date(), timezone);
  const to = dateOnly(query.to) ?? today;
  const toUtcDay = new Date(`${to}T00:00:00.000Z`);
  toUtcDay.setUTCDate(toUtcDay.getUTCDate() - 29);
  const from = dateOnly(query.from) ?? toUtcDay.toISOString().slice(0, 10);
  if (from > to) throw new BadRequestException('Start date must be on or before end date');
  const [fy, fm, fd] = from.split('-').map(Number); const [ty, tm, td] = to.split('-').map(Number);
  const dayCount = (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000 + 1;
  if (dayCount > 366) throw new BadRequestException('Insights date range cannot exceed 366 calendar days');
  return { from, to, timezone, start: localMidnightUtc(from, timezone), end: localMidnightUtc(new Date(Date.UTC(ty, tm - 1, td) + 86_400_000).toISOString().slice(0, 10), timezone), dayCount };
}

function average(values: number[]) { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : null; }
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
}
function stateString(state: Record<string, unknown> | null | undefined, key: string) {
  const value = state?.[key]; return typeof value === 'string' ? value : null;
}
function isFirstEntryToCompleted(row: HistoryRow) {
  if (row.afterStatusCategory !== 'completed') return false;
  if (row.event === 'created') return true;
  return row.event === 'updated' && row.beforeStatusCategory !== null && row.beforeStatusCategory !== 'completed';
}
function isFirstEntryToStarted(row: HistoryRow) {
  if (row.event === 'created') return row.afterStatusCategory === 'started';
  return row.event === 'updated' && row.afterStatusCategory === 'started' && row.beforeStatusCategory !== null && row.beforeStatusCategory !== 'started';
}

@Injectable()
export class InsightsService {
  constructor(private readonly database: DatabaseService) {}
  private get db() { return this.database.db; }

  private async resolveView(actor: WorkspaceActor, id?: string): Promise<MetricView | null> {
    if (!id) return null;
    requireResourceId(id);
    const [view] = await this.db.select().from(savedViews).where(and(
      eq(savedViews.id, id), eq(savedViews.organizationId, actor.organizationId),
      or(eq(savedViews.visibility, 'shared'), eq(savedViews.ownerId, actor.userId)),
      or(isNull(savedViews.teamId), inArray(savedViews.teamId, visibleTeamIds(this.db, actor))),
    )).limit(1);
    if (!view) throw new NotFoundException('Saved view not found');
    if (view.teamId) await requireTeam(this.db, actor, view.teamId);
    return { teamId: view.teamId, config: view.config };
  }

  private async visibleViewFilters(actor: WorkspaceActor, view: MetricView | null) {
    if (!view) return null;
    const { assigneeIds, labelIds, projectIds } = view.config.filters;
    const [people, visibleLabels, visibleProjects] = await Promise.all([
      assigneeIds.length ? this.db.select({ id: users.id }).from(users)
        .where(and(inArray(users.id, assigneeIds), userScope(this.db, actor))) : [],
      labelIds.length ? this.db.select({ id: labels.id }).from(labels).where(and(inArray(labels.id, labelIds), labelScope(this.db, actor))) : [],
      projectIds.length ? this.db.select({ id: projects.id }).from(projects).where(and(inArray(projects.id, projectIds), projectScope(this.db, actor))) : [],
    ]);
    return {
      config: view.config,
      assigneeIds: new Set(people.map(row => row.id)),
      labelIds: new Set(visibleLabels.map(row => row.id)),
      projectIds: new Set(visibleProjects.map(row => row.id)),
    };
  }

  async overview(actorId: string, query: InsightsReportQueryDto) {
    const actor = await requireWorkspace(this.db, actorId);
    const range = resolveRange(query);
    if (query.teamId) await requireTeam(this.db, actor, query.teamId);
    if (query.projectId) {
      const project = await requireProject(this.db, actor, query.projectId);
      if (query.teamId && project.teamId !== query.teamId) throw new BadRequestException('Project must belong to the selected team');
    }
    const view = await this.resolveView(actor, query.viewId);
    if (view?.teamId && query.teamId && view.teamId !== query.teamId) throw new BadRequestException('Saved view belongs to another team');
    const teamId = query.teamId ?? view?.teamId ?? undefined;
    const filters = await this.visibleViewFilters(actor, view);
    const page = query.page ?? 1; const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    if (page < 1 || pageSize < 1 || pageSize > MAX_PAGE_SIZE) throw new BadRequestException(`Page size must be between 1 and ${MAX_PAGE_SIZE}`);

    const historyConditions = [inArray(issueHistory.teamId, visibleTeamIds(this.db, actor)), lt(issueHistory.recordedAt, range.end)];
    if (teamId) historyConditions.push(eq(issueHistory.teamId, teamId));
    const history = await this.db.select().from(issueHistory).where(and(...historyConditions))
      .orderBy(asc(issueHistory.recordedAt), asc(issueHistory.id)).limit(MAX_HISTORY_ROWS + 1);
    if (history.length > MAX_HISTORY_ROWS) throw new BadRequestException('This report exceeds the safe historical-event limit for one response. Ask an administrator to review this workspace history volume');
    if (!history.length) return this.emptyOverview(range, page, pageSize, { teamId: teamId ?? null, projectId: query.projectId ?? null, viewId: query.viewId ?? null });

    const allIssueIds = [...new Set(history.map(row => row.issueId))];
    const currentIssues = await this.db.select().from(issues).where(and(inArray(issues.id, allIssueIds), issueScope(this.db, actor)));
    const issueById = new Map(currentIssues.map(issue => [issue.id, issue]));
    let labelsByIssue = new Map<string, Set<string>>();
    if (filters?.config.filters.labelIds.length) {
      const assignments = await this.db.select({ issueId: issueLabels.issueId, labelId: issueLabels.labelId }).from(issueLabels)
        .innerJoin(labels, eq(labels.id, issueLabels.labelId)).where(and(
          inArray(issueLabels.issueId, allIssueIds), labelScope(this.db, actor),
        ));
      for (const assignment of assignments) {
        const current = labelsByIssue.get(assignment.issueId) ?? new Set<string>(); current.add(assignment.labelId); labelsByIssue.set(assignment.issueId, current);
      }
    }

    const eventsByIssue = new Map<string, HistoryRow[]>();
    const deletedIssueIds = new Set(history.filter(row => row.event === 'deleted').map(row => row.issueId));
    const firstCompletion = new Map<string, HistoryRow>();
    const repeatedCompletionEvents: HistoryRow[] = [];
    for (const row of history) {
      const group = eventsByIssue.get(row.issueId) ?? []; group.push(row); eventsByIssue.set(row.issueId, group);
      if (!isFirstEntryToCompleted(row)) continue;
      if (firstCompletion.has(row.issueId)) repeatedCompletionEvents.push(row);
      else firstCompletion.set(row.issueId, row);
    }

    const matchesEntityFilters = (row: HistoryRow) => {
      if (teamId && row.teamId !== teamId) return false;
      const state = row.afterState as Record<string, unknown> | null;
      if (query.projectId && stateString(state, 'project_id') !== query.projectId) return false;
      if (filters) {
        if (view?.teamId && row.teamId !== view.teamId) return false;
        const assigneeId = stateString(state, 'assignee_id'); const projectId = stateString(state, 'project_id');
        if (filters.config.filters.priorities.length && !filters.config.filters.priorities.includes(String(state?.priority ?? 'no_priority'))) return false;
        if (filters.config.filters.assigneeIds.length && (!assigneeId || !filters.assigneeIds.has(assigneeId))) return false;
        if (filters.config.filters.projectIds.length && (!projectId || !filters.projectIds.has(projectId))) return false;
        if (filters.config.filters.labelIds.length) {
          const assigned = labelsByIssue.get(row.issueId);
          if (!assigned || !filters.config.filters.labelIds.some(id => assigned.has(id) && filters.labelIds.has(id))) return false;
        }
      }
      // Deleted work is reportable from its visible deletion history; unreadable current issues are not.
      return issueById.has(row.issueId) || deletedIssueIds.has(row.issueId);
    };
    const inRange = (row: HistoryRow) => row.recordedAt >= range.start && row.recordedAt < range.end;
    const selectedCompletions = [...firstCompletion.values()].filter(row => inRange(row) && matchesEntityFilters(row));
    const selectedRepeatedCompletions = repeatedCompletionEvents.filter(row => inRange(row) && matchesEntityFilters(row));

    const baselineIssues = new Set(history.filter(row => row.event === 'baseline').map(row => row.issueId));
    const baselineCompletionCount = selectedCompletions.filter(row => baselineIssues.has(row.issueId)).length;
    const completionSet = new Set(selectedCompletions.map(row => row.issueId));
    const createdAtByIssue = new Map<string, Date>();
    const startedAtByIssue = new Map<string, Date>();
    for (const id of completionSet) {
      for (const row of eventsByIssue.get(id) ?? []) {
        if (row.event === 'created' && !createdAtByIssue.has(id)) createdAtByIssue.set(id, row.recordedAt);
        if (isFirstEntryToStarted(row) && !startedAtByIssue.has(id)) startedAtByIssue.set(id, row.recordedAt);
      }
    }

    const throughputCounts = new Map<string, number>();
    const leadValues: number[] = []; const cycleValues: number[] = [];
    const leadByDay = new Map<string, number[]>(); const cycleByDay = new Map<string, number[]>();
    let missingCreationHistoryCount = 0; let missingStartHistoryCount = 0;
    for (const completion of selectedCompletions) {
      const day = dayString(completion.recordedAt, range.timezone);
      throughputCounts.set(day, (throughputCounts.get(day) ?? 0) + 1);
      const createdAt = createdAtByIssue.get(completion.issueId);
      if (!createdAt) missingCreationHistoryCount++;
      else if (completion.recordedAt >= createdAt) {
        const hours = Math.round((completion.recordedAt.getTime() - createdAt.getTime()) / 3_600_000 * 100) / 100;
        leadValues.push(hours); const values = leadByDay.get(day) ?? []; values.push(hours); leadByDay.set(day, values);
      }
      const startedAt = startedAtByIssue.get(completion.issueId);
      if (!startedAt) missingStartHistoryCount++;
      else if (completion.recordedAt >= startedAt) {
        const hours = Math.round((completion.recordedAt.getTime() - startedAt.getTime()) / 3_600_000 * 100) / 100;
        cycleValues.push(hours); const values = cycleByDay.get(day) ?? []; values.push(hours); cycleByDay.set(day, values);
      }
    }

    const throughput = [];
    const cursor = new Date(`${range.from}T00:00:00.000Z`); const last = new Date(`${range.to}T00:00:00.000Z`);
    while (cursor <= last) {
      const date = cursor.toISOString().slice(0, 10); throughput.push({ date, count: throughputCounts.get(date) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const completionRows = selectedCompletions.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime() || Number(b.id) - Number(a.id));
    const total = completionRows.length;
    const completions = completionRows.slice((page - 1) * pageSize, page * pageSize).map(row => {
      const issue = issueById.get(row.issueId); const state = row.afterState as Record<string, unknown> | null;
      return { issueId: row.issueId, identifier: issue?.identifier ?? stateString(state, 'identifier'),
        title: issue?.title ?? stateString(state, 'title'), teamId: row.teamId,
        completedAt: row.recordedAt, projectId: stateString(state, 'project_id') };
    });
    const instrumentedEvents = history.filter(row => row.event !== 'baseline');
    const createdIssues = new Set(history.filter(row => row.event === 'created').map(row => row.issueId));
    return {
      range: { from: range.from, to: range.to, timezone: range.timezone },
      filters: { teamId: teamId ?? null, projectId: query.projectId ?? null, viewId: query.viewId ?? null },
      history: { hasHistory: instrumentedEvents.length > 0, measuredEventCount: instrumentedEvents.length,
        baselineIssueCount: baselineIssues.size, issuesWithCreationHistory: createdIssues.size,
        historyStartsAt: instrumentedEvents[0]?.recordedAt ?? null },
      throughput: { total: selectedCompletions.length, sampleSize: selectedCompletions.length,
        repeatedCompletionEvents: selectedRepeatedCompletions.length, baselineCompletionCount,
        points: throughput },
      leadTime: { sampleSize: leadValues.length, missingHistoryCount: missingCreationHistoryCount,
        averageHours: average(leadValues), medianHours: median(leadValues), points: [...leadByDay.entries()].map(([date, values]) => ({ date, sampleSize: values.length, averageHours: average(values) })) },
      cycleTime: { sampleSize: cycleValues.length, missingHistoryCount: missingStartHistoryCount,
        averageHours: average(cycleValues), medianHours: median(cycleValues), points: [...cycleByDay.entries()].map(([date, values]) => ({ date, sampleSize: values.length, averageHours: average(values) })) },
      completions: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), rows: completions },
      quality: { missingCreationHistoryCount, missingStartHistoryCount,
        explanation: 'Duration samples require recorded create/start events after instrumentation. Baseline rows and repeat completions do not invent or backfill elapsed time.' },
    };
  }

  async cycleReport(actorId: string, query: InsightsCycleQueryDto) {
    const actor = await requireWorkspace(this.db, actorId);
    const range = resolveRange(query);
    if (query.projectId || query.viewId) throw new BadRequestException('Cycle snapshot metrics are cycle-wide; project and saved-view filters apply to issue trends only');
    let selectedCycle: typeof cycles.$inferSelect | undefined;
    if (query.cycleId) {
      selectedCycle = await requireCycle(this.db, actor, query.cycleId);
      if (query.teamId && selectedCycle.teamId !== query.teamId) throw new BadRequestException('Cycle must belong to the selected team');
    }
    if (query.teamId) await requireTeam(this.db, actor, query.teamId);
    const cycleConditions = [cycleScope(this.db, actor), lt(cycles.startDate, range.end)];
    if (query.teamId) cycleConditions.push(eq(cycles.teamId, query.teamId));
    if (selectedCycle) cycleConditions.push(eq(cycles.id, selectedCycle.id));
    const cycleRows = selectedCycle ? [selectedCycle] : await this.db.select().from(cycles).where(and(...cycleConditions)).orderBy(desc(cycles.startDate)).limit(501);
    const cycleScopeTruncated = !selectedCycle && cycleRows.length > 500;
    const scopedCycles = cycleRows.slice(0, 500).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const cycleIds = scopedCycles.map(cycle => cycle.id);
    const latestSnapshotRows = cycleIds.length ? await this.db.select({ cycleId: cycleSnapshots.cycleId, snapshotAt: max(cycleSnapshots.snapshotAt) })
      .from(cycleSnapshots).where(and(inArray(cycleSnapshots.cycleId, cycleIds), lt(cycleSnapshots.snapshotAt, range.end))).groupBy(cycleSnapshots.cycleId) : [];
    const latestSnapshotAt = new Map(latestSnapshotRows.map(row => [row.cycleId, row.snapshotAt ? new Date(row.snapshotAt as any).getTime() : null]));
    const finalSnapshotCandidates = latestSnapshotRows.filter(row => row.snapshotAt && new Date(row.snapshotAt as any) >= range.start);
    const finalSnapshotRows = finalSnapshotCandidates.length ? await this.db.select().from(cycleSnapshots).where(or(...finalSnapshotCandidates.map(row => and(
      eq(cycleSnapshots.cycleId, row.cycleId), eq(cycleSnapshots.snapshotAt, new Date(row.snapshotAt as any)),
    )!))) : [];
    const finalSamples = new Map(finalSnapshotRows.map(snapshot => [snapshot.cycleId, snapshot]));
    const measuredCompletions = scopedCycles.filter(cycle => cycle.isCompleted).flatMap(cycle => {
      const sample = finalSamples.get(cycle.id);
      return sample ? [{ cycle, sample }] : [];
    });
    const velocity = measuredCompletions.map(({ cycle, sample }) => ({ cycleId: cycle.id, cycleName: cycle.name ?? `Cycle ${cycle.number}`, teamId: cycle.teamId,
      measuredAt: sample.snapshotAt, completedIssues: sample.completedIssueCount, completedEstimate: sample.completedEstimate,
      missingEstimateCount: sample.missingEstimateCount, unit: query.unit ?? 'issues' }));
    const unmeasuredCompletedCycles = scopedCycles.filter(cycle => cycle.isCompleted && !latestSnapshotAt.has(cycle.id)).length;
    let selectedSnapshots: Array<typeof cycleSnapshots.$inferSelect> = [];
    let snapshotHistoryTruncated = false;
    if (selectedCycle) {
      const recorded = await this.db.select().from(cycleSnapshots).where(and(
        eq(cycleSnapshots.cycleId, selectedCycle.id), gte(cycleSnapshots.snapshotAt, range.start), lt(cycleSnapshots.snapshotAt, range.end),
      )).orderBy(asc(cycleSnapshots.snapshotAt)).limit(10_001);
      snapshotHistoryTruncated = recorded.length > 10_000;
      selectedSnapshots = snapshotHistoryTruncated ? recorded.slice(-10_000) : recorded;
    }
    const unit = query.unit ?? 'issues';
    return {
      range: { from: range.from, to: range.to, timezone: range.timezone },
      filters: { teamId: query.teamId ?? selectedCycle?.teamId ?? null, cycleId: selectedCycle?.id ?? null, unit },
      velocity: { sampleSize: velocity.length, unmeasuredCompletedCycles, scopeTruncated: cycleScopeTruncated,
        points: velocity.map(item => ({ ...item, value: unit === 'estimate' ? item.completedEstimate : item.completedIssues })) },
      burndown: { cycle: selectedCycle ? { id: selectedCycle.id, name: selectedCycle.name ?? `Cycle ${selectedCycle.number}`,
        startDate: selectedCycle.startDate, endDate: selectedCycle.endDate } : null,
        hasHistory: selectedSnapshots.length > 0, historyStartsAt: selectedSnapshots[0]?.snapshotAt ?? null, truncated: snapshotHistoryTruncated,
        sampleSize: selectedSnapshots.length, points: selectedSnapshots.map(snapshot => ({
          snapshotAt: snapshot.snapshotAt, totalIssueCount: snapshot.totalIssueCount, completedIssueCount: snapshot.completedIssueCount,
          remainingIssueCount: snapshot.remainingIssueCount, plannedEstimate: snapshot.plannedEstimate,
          completedEstimate: snapshot.completedEstimate, remainingEstimate: snapshot.remainingEstimate,
          missingEstimateCount: snapshot.missingEstimateCount,
          value: unit === 'estimate' ? snapshot.remainingEstimate : snapshot.remainingIssueCount,
        })) },
      quality: { message: selectedCycle && !selectedSnapshots.length
        ? 'No recorded cycle snapshots exist in this window. No burndown curve is inferred.'
        : snapshotHistoryTruncated
          ? 'Velocity includes completed cycles only when their final snapshot is recorded in the selected window. Burndown shows the latest 10,000 recorded samples; older samples in this window are omitted.'
          : 'Velocity includes completed cycles only when their final snapshot is recorded in the selected window. Burndown uses recorded samples only; gaps and missing estimates remain visible.' },
    };
  }

  private emptyOverview(range: ReturnType<typeof resolveRange>, page: number, pageSize: number, filters: { teamId: string | null; projectId: string | null; viewId: string | null }) {
    const throughput = []; const cursor = new Date(`${range.from}T00:00:00.000Z`); const last = new Date(`${range.to}T00:00:00.000Z`);
    while (cursor <= last) { throughput.push({ date: cursor.toISOString().slice(0, 10), count: 0 }); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    return {
      range: { from: range.from, to: range.to, timezone: range.timezone }, filters,
      history: { hasHistory: false, measuredEventCount: 0, baselineIssueCount: 0, issuesWithCreationHistory: 0, historyStartsAt: null },
      throughput: { total: 0, sampleSize: 0, repeatedCompletionEvents: 0, baselineCompletionCount: 0, points: throughput },
      leadTime: { sampleSize: 0, missingHistoryCount: 0, averageHours: null, medianHours: null, points: [] },
      cycleTime: { sampleSize: 0, missingHistoryCount: 0, averageHours: null, medianHours: null, points: [] },
      completions: { page, pageSize, total: 0, totalPages: 0, rows: [] },
      quality: { missingCreationHistoryCount: 0, missingStartHistoryCount: 0, explanation: 'No instrumented issue history exists in the selected workspace scope.' },
    };
  }
}
