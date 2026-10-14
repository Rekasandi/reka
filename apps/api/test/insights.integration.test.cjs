const { equal, deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq, desc } = require('drizzle-orm');
const { cycles, cycleSnapshots, issueHistory, issues, organizationMembers, organizations, projects, savedViews, sessions, teamMembers, teamWorkflowStates, teams, users } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { InsightsModule } = require('../dist/insights/insights.module');

test('Insights API reports measured throughput/durations with scoped filters, pagination and honest cycle samples', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const db = postgres.db; const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org, foreignOrg] = await db.insert(organizations).values([
      { name: 'Insights Co', slug: `insights-${suffix}` }, { name: 'Foreign Co', slug: `foreign-insights-${suffix}` },
    ]).returning();
    const [owner, member, outsider, foreignOwner] = await db.insert(users).values([
      { name: 'Insight Owner', email: `insight-owner-${suffix}@example.test`, role: 'owner' },
      { name: 'Insight Member', email: `insight-member-${suffix}@example.test`, role: 'member' },
      { name: 'Private Outsider', email: `insight-outsider-${suffix}@example.test`, role: 'member' },
      { name: 'Foreign Owner', email: `foreign-insight-${suffix}@example.test`, role: 'owner' },
    ]).returning();
    await db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' }, { organizationId: org.id, userId: member.id, role: 'member' },
      { organizationId: org.id, userId: outsider.id, role: 'member' }, { organizationId: foreignOrg.id, userId: foreignOwner.id, role: 'owner' },
    ]);
    const [team, privateTeam, foreignTeam, emptyTeam] = await db.insert(teams).values([
      { organizationId: org.id, name: 'Insights public', key: `INS${suffix.slice(0, 4).toUpperCase()}` },
      { organizationId: org.id, name: 'Insights private', key: `PRV${suffix.slice(0, 4).toUpperCase()}`, isPrivate: true },
      { organizationId: foreignOrg.id, name: 'Foreign team', key: `FRN${suffix.slice(0, 4).toUpperCase()}` },
      { organizationId: org.id, name: 'Empty Insights team', key: `EMP${suffix.slice(0, 4).toUpperCase()}` },
    ]).returning();
    await db.insert(teamMembers).values([
      { teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: team.id, userId: member.id, role: 'member' },
      { teamId: privateTeam.id, userId: owner.id, role: 'lead' }, { teamId: foreignTeam.id, userId: foreignOwner.id, role: 'lead' },
    ]);
    const states = teamId => [
      { teamId, key: 'queued', name: 'Queued', category: 'unstarted', color: '#888888', position: 0 },
      { teamId, key: 'working', name: 'Working', category: 'started', color: '#4488ff', position: 1 },
      { teamId, key: 'shipped', name: 'Shipped', category: 'completed', color: '#44aa77', position: 2 },
      { teamId, key: 'backlog', name: 'Backlog', category: 'backlog', color: '#777777', position: 3 },
      { teamId, key: 'triage', name: 'Triage', category: 'triage', color: '#aa8844', position: 4 },
      { teamId, key: 'canceled', name: 'Canceled', category: 'canceled', color: '#777777', position: 5 },
    ];
    await db.insert(teamWorkflowStates).values([...states(team.id), ...states(privateTeam.id), ...states(foreignTeam.id)]);
    const [project, otherProject, privateProject, foreignProject] = await db.insert(projects).values([
      { organizationId: org.id, teamId: team.id, ownerId: owner.id, name: 'Measured project', slug: `measured-${suffix}` },
      { organizationId: org.id, teamId: team.id, ownerId: owner.id, name: 'Other project', slug: `other-${suffix}` },
      { organizationId: org.id, teamId: privateTeam.id, ownerId: owner.id, name: 'Private project', slug: `private-${suffix}` },
      { organizationId: foreignOrg.id, teamId: foreignTeam.id, ownerId: foreignOwner.id, name: 'Foreign project', slug: `foreign-${suffix}` },
    ]).returning();

    const timestamp = async (issueId, expectedEvent) => {
      const [row] = await db.select().from(issueHistory).where(eq(issueHistory.issueId, issueId)).orderBy(desc(issueHistory.id)).limit(1);
      equal(row.event, expectedEvent);
      return async at => { await db.update(issueHistory).set({ recordedAt: new Date(at) }).where(eq(issueHistory.id, row.id)); };
    };
    const makeIssue = async ({ teamId, issueProjectId, reporterId, assigneeId, number, title, priority = 'urgent', status = 'queued' }) => {
      const [issue] = await db.insert(issues).values({
        identifier: `${teamId === team.id ? team.key : teamId === privateTeam.id ? privateTeam.key : foreignTeam.key}-${number}`,
        number, title, status, priority, teamId, projectId: issueProjectId, reporterId, assigneeId,
      }).returning();
      return issue;
    };
    const makeMeasured = async ({ issue, created, started, completed, repeated, baseline = false }) => {
      if (baseline) {
        await db.delete(issueHistory).where(eq(issueHistory.issueId, issue.id));
        await db.insert(issueHistory).values({ issueId: issue.id, teamId: issue.teamId, event: 'baseline', afterState: { status: 'working' }, recordedAt: new Date('2026-01-01T00:00:00Z') });
      } else {
        await (await timestamp(issue.id, 'created'))(created);
        await db.update(issues).set({ status: 'working' }).where(eq(issues.id, issue.id));
        await (await timestamp(issue.id, 'updated'))(started);
      }
      if (baseline) await db.update(issues).set({ status: 'shipped' }).where(eq(issues.id, issue.id));
      else await db.update(issues).set({ status: 'shipped' }).where(eq(issues.id, issue.id));
      await (await timestamp(issue.id, 'updated'))(completed);
      if (repeated) {
        await db.update(issues).set({ status: 'working' }).where(eq(issues.id, issue.id));
        await (await timestamp(issue.id, 'updated'))(repeated.start);
        await db.update(issues).set({ status: 'shipped' }).where(eq(issues.id, issue.id));
        await (await timestamp(issue.id, 'updated'))(repeated.end);
      }
    };

    const issueA = await makeIssue({ teamId: team.id, issueProjectId: project.id, reporterId: owner.id, assigneeId: member.id, number: 1, title: 'DST measured issue' });
    await makeMeasured({ issue: issueA, created: '2026-03-08T09:30:00Z', started: '2026-03-08T09:45:00Z', completed: '2026-03-08T10:30:00Z', repeated: { start: '2026-03-09T08:00:00Z', end: '2026-03-09T10:00:00Z' } });
    const issueB = await makeIssue({ teamId: team.id, issueProjectId: project.id, reporterId: owner.id, assigneeId: member.id, number: 2, title: 'Baseline issue', priority: 'urgent', status: 'working' });
    await makeMeasured({ issue: issueB, baseline: true, completed: '2026-03-08T12:00:00Z' });
    const issueC = await makeIssue({ teamId: team.id, issueProjectId: otherProject.id, reporterId: owner.id, assigneeId: member.id, number: 3, title: 'Other project issue', priority: 'low' });
    await makeMeasured({ issue: issueC, created: '2026-03-08T10:00:00Z', started: '2026-03-08T10:10:00Z', completed: '2026-03-09T12:00:00Z' });
    const privateIssue = await makeIssue({ teamId: privateTeam.id, issueProjectId: privateProject.id, reporterId: owner.id, assigneeId: owner.id, number: 1, title: 'Hidden private completion' });
    await makeMeasured({ issue: privateIssue, created: '2026-03-08T10:00:00Z', started: '2026-03-08T10:15:00Z', completed: '2026-03-09T13:00:00Z' });
    const foreignIssue = await makeIssue({ teamId: foreignTeam.id, issueProjectId: foreignProject.id, reporterId: foreignOwner.id, assigneeId: foreignOwner.id, number: 1, title: 'Foreign completion' });
    await makeMeasured({ issue: foreignIssue, created: '2026-03-08T10:00:00Z', started: '2026-03-08T10:15:00Z', completed: '2026-03-09T13:30:00Z' });

    const viewConfig = { filterTab: 'all', viewMode: 'list', groupBy: 'none', sortBy: 'updated', showSubtasks: false,
      filters: { assigneeIds: [member.id], labelIds: [], priorities: ['urgent'], projectIds: [project.id] } };
    const [view, privateView] = await db.insert(savedViews).values([
      { organizationId: org.id, ownerId: owner.id, teamId: team.id, name: 'Urgent measured work', visibility: 'shared', config: viewConfig },
      { organizationId: org.id, ownerId: owner.id, teamId: team.id, name: 'Owner only view', visibility: 'private', config: viewConfig },
    ]).returning();
    const startDate = new Date('2026-03-07T00:00:00Z'); const endDate = new Date('2026-03-09T00:00:00Z');
    const [cycle, noHistoryCycle, privateCycle] = await db.insert(cycles).values([
      { teamId: team.id, number: 1, name: 'Measured cycle', startDate, endDate, isCompleted: true },
      { teamId: team.id, number: 2, name: 'Legacy no-sample cycle', startDate: new Date('2026-03-09T00:00:00Z'), endDate: new Date('2026-03-18T00:00:00Z'), isCompleted: true },
      { teamId: privateTeam.id, number: 1, name: 'Private cycle', startDate, endDate, isCompleted: true },
    ]).returning();
    await db.insert(cycleSnapshots).values([
      { cycleId: cycle.id, snapshotAt: new Date('2026-03-08T09:00:00Z'), totalIssueCount: 4, completedIssueCount: 1, remainingIssueCount: 3, plannedEstimate: 13, completedEstimate: 3, remainingEstimate: 10, missingEstimateCount: 1 },
      { cycleId: cycle.id, snapshotAt: new Date('2026-03-08T15:00:00Z'), totalIssueCount: 4, completedIssueCount: 2, remainingIssueCount: 2, plannedEstimate: 13, completedEstimate: 8, remainingEstimate: 5, missingEstimateCount: 1 },
      { cycleId: privateCycle.id, snapshotAt: new Date('2026-03-08T15:00:00Z'), totalIssueCount: 1, completedIssueCount: 1, remainingIssueCount: 0, plannedEstimate: 5, completedEstimate: 5, remainingEstimate: 0, missingEstimateCount: 0 },
    ]);

    const tokens = new Map();
    for (const user of [owner, member, outsider]) {
      const token = randomUUID(); tokens.set(user.id, token);
      await db.insert(sessions).values({ id: token, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) });
    }
    api = await createIsolatedApi(postgres, [InsightsModule]);
    const call = async (user, path) => fetch(`${api.url}/api${path}`, { headers: { authorization: `Bearer ${tokens.get(user.id)}` } });
    const params = { from: '2026-03-08', to: '2026-03-09', timezone: 'America/Los_Angeles' };
    const response = await call(member, `/insights/overview?${new URLSearchParams(params)}`);
    equal(response.status, 200);
    const report = await response.json();
    equal(report.throughput.total, 3, 'three unique first completions; re-completion is separate audit data, not throughput');
    equal(report.throughput.repeatedCompletionEvents, 1);
    deepEqual(report.throughput.points, [{ date: '2026-03-08', count: 2 }, { date: '2026-03-09', count: 1 }], 'local-day buckets honor the DST transition');
    equal(report.leadTime.sampleSize, 2); equal(report.leadTime.missingHistoryCount, 1); equal(report.leadTime.averageHours, 13.5);
    equal(report.cycleTime.sampleSize, 2); equal(report.cycleTime.missingHistoryCount, 1); equal(report.cycleTime.averageHours, 13.29);
    equal(report.completions.total, 3);
    equal(report.history.baselineIssueCount >= 1, true);
    const emptyResponse = await call(outsider, `/insights/overview?${new URLSearchParams({ ...params, teamId: emptyTeam.id })}`);
    const emptyReport = await emptyResponse.json(); equal(emptyReport.history.hasHistory, false); equal(emptyReport.throughput.total, 0);
    equal(emptyReport.filters.teamId, emptyTeam.id);
    const ownerPrivateResponse = await call(owner, `/insights/overview?${new URLSearchParams({ ...params, teamId: privateTeam.id })}`);
    const ownerPrivate = await ownerPrivateResponse.json(); equal(ownerPrivate.throughput.total, 1);
    const ownerWorkspaceResponse = await call(owner, `/insights/overview?${new URLSearchParams(params)}`);
    const ownerWorkspace = await ownerWorkspaceResponse.json(); equal(ownerWorkspace.throughput.total, 4, 'private-team metrics are visible to its explicit member, while foreign-workspace data stays excluded');

    const projectReportResponse = await call(member, `/insights/overview?${new URLSearchParams({ ...params, projectId: project.id, pageSize: '1' })}`);
    const projectReport = await projectReportResponse.json();
    equal(projectReport.throughput.total, 2); equal(projectReport.completions.total, 2); equal(projectReport.completions.rows.length, 1);
    equal(projectReport.completions.totalPages, 2, 'completion rows are paginated');

    const viewResponse = await call(member, `/insights/overview?${new URLSearchParams({ ...params, viewId: view.id })}`);
    const viewReport = await viewResponse.json();
    equal(viewReport.throughput.total, 2, 'saved view project/priority/assignee filters are applied server-side');
    equal((await call(member, `/insights/overview?${new URLSearchParams({ ...params, projectId: privateProject.id })}`)).status, 404);
    equal((await call(member, `/insights/overview?${new URLSearchParams({ ...params, teamId: privateTeam.id })}`)).status, 404);
    equal((await call(outsider, `/insights/overview?${new URLSearchParams({ ...params, viewId: privateView.id })}`)).status, 404, 'private saved view is hidden from non-owner');
    const memberCycleResponse = await call(member, `/insights/cycles?${new URLSearchParams({ ...params, teamId: team.id, cycleId: cycle.id, unit: 'estimate' })}`);
    const memberCycle = await memberCycleResponse.json();
    equal(memberCycle.velocity.sampleSize, 1, 'only a completed cycle with a recorded final snapshot contributes velocity');
    equal(memberCycle.velocity.unmeasuredCompletedCycles, 0); equal(memberCycle.velocity.points[0].value, 8); equal(memberCycle.burndown.hasHistory, true); equal(memberCycle.burndown.sampleSize, 2);
    const teamCycleReport = await call(member, `/insights/cycles?${new URLSearchParams({ ...params, teamId: team.id })}`);
    const teamCycleMetrics = await teamCycleReport.json(); equal(teamCycleMetrics.velocity.unmeasuredCompletedCycles, 1);
    equal(teamCycleMetrics.velocity.sampleSize, 1);
    equal(memberCycle.burndown.points[1].value, 5); equal(memberCycle.filters.unit, 'estimate');
    equal((await call(member, `/insights/cycles?${new URLSearchParams({ ...params, cycleId: privateCycle.id })}`)).status, 404);
    const noHistoryResponse = await call(member, `/insights/cycles?${new URLSearchParams({ ...params, cycleId: noHistoryCycle.id })}`);
    const noHistory = await noHistoryResponse.json(); equal(noHistory.burndown.hasHistory, false);
    equal((await call(member, `/insights/cycles?${new URLSearchParams({ ...params, projectId: project.id })}`)).status, 400, 'cycle snapshots cannot pretend to apply issue-level project filters');
    equal((await call(member, `/insights/overview?${new URLSearchParams({ from: '2026-03-10', to: '2026-03-08' })}`)).status, 400);
    equal((await call(member, `/insights/overview?${new URLSearchParams({ ...params, timezone: 'Not/A_Timezone' })}`)).status, 400);
    equal((await call(member, `/insights/overview?${new URLSearchParams({ from: '2026-02-30', to: '2026-03-08' })}`)).status, 400);
    equal(noHistoryCycle.isCompleted, true);
  } finally { if (api) await api.close(); await postgres.close(); }
});
