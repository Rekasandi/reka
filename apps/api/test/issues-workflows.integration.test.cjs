// Real Nest HTTP -> DTO/authorization -> isolated Postgres issue workflow contract.
const { deepEqual, equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq, inArray } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, issues, labels, issueLabels, issueRelations, activities, issueRecurrences, projects, cycles } = require('@reka/database');
const { IssuesModule } = require('../dist/issues/issues.module');
const { TeamsModule } = require('../dist/teams/teams.module');
const { ProjectsModule } = require('../dist/projects/projects.module');
const { CyclesModule } = require('../dist/cycles/cycles.module');
const { LabelsModule } = require('../dist/labels/labels.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { processDueIssueRecurrences } = require('../../worker/dist/processors/issue-recurrence');

test('issue properties, labels, relations, ordering, bulk updates and archive/restore persist through real HTTP', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Issue workflow company', slug: `issue-${suffix}` }).returning();
    const [owner, member, outsider] = await postgres.db.insert(users).values([
      { name: 'Issue owner', email: `owner-${suffix}@example.test`, role: 'owner' },
      { name: 'Issue member', email: `member-${suffix}@example.test`, role: 'member' },
      { name: 'Other company', email: `outsider-${suffix}@example.test`, role: 'owner' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: member.id, role: 'member' },
    ]);
    const [team, secondTeam] = await postgres.db.insert(teams).values([
      { organizationId: org.id, name: 'Core', key: `I${suffix.slice(0, 4).toUpperCase()}` },
      { organizationId: org.id, name: 'Other', key: `O${suffix.slice(0, 4).toUpperCase()}` },
    ]).returning();
    await postgres.db.insert(teamMembers).values([
      { teamId: team.id, userId: owner.id, role: 'lead' },
      { teamId: team.id, userId: member.id, role: 'member' },
      { teamId: secondTeam.id, userId: owner.id, role: 'lead' },
    ]);
    const [project, otherTeamProject] = await postgres.db.insert(projects).values([
      { organizationId: org.id, teamId: team.id, name: 'Core project', slug: `core-${suffix}`, ownerId: owner.id },
      { organizationId: org.id, teamId: secondTeam.id, name: 'Other team project', slug: `other-${suffix}`, ownerId: owner.id },
    ]).returning();
    const [cycle, otherTeamCycle] = await postgres.db.insert(cycles).values([
      { teamId: team.id, number: 1, startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-14T00:00:00Z') },
      { teamId: secondTeam.id, number: 1, startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-14T00:00:00Z') },
    ]).returning();
    const tokens = {};
    for (const user of [owner, member, outsider]) {
      tokens[user.id] = randomUUID();
      await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
    }
    api = await createIsolatedApi(postgres, [IssuesModule, LabelsModule, TeamsModule, ProjectsModule, CyclesModule]);
    const request = (user, path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const labelResponse = await request(owner, '/labels', 'POST', { teamId: team.id, name: 'Backend', color: '#336699' });
    equal(labelResponse.status, 201);
    const label = await labelResponse.json();
    equal(label.organizationId, org.id);
    equal((await request(outsider, '/labels', 'POST', { teamId: team.id, name: 'Nope' })).status, 403);

    const workflowResponse = await request(owner, `/teams/${team.id}/workflow-states`);
    equal(workflowResponse.status, 200);
    const workflow = await workflowResponse.json();
    ok(workflow.some((state) => state.key === 'todo' && state.isActive));
    equal((await request(member, `/teams/${team.id}/workflow-states`)).status, 200, 'visible team members can read workflow settings');
    const customWorkflow = workflow.map(({ key, name, category, color, position, isActive }) => ({ key, name: key === 'todo' ? 'Ready' : name, category, color, position, isActive }));
    customWorkflow.push({ key: 'quality_check', name: 'Quality check', category: 'started', color: '#345678', position: 9, isActive: true });
    customWorkflow.push({ key: 'shipped', name: 'Shipped', category: 'completed', color: '#223344', position: 10, isActive: true });
    const savedWorkflow = await request(owner, `/teams/${team.id}/workflow-states`, 'PATCH', { states: customWorkflow });
    equal(savedWorkflow.status, 200, await savedWorkflow.clone().text());
    equal((await request(member, `/teams/${team.id}/workflow-states`, 'PATCH', { states: customWorkflow })).status, 403, 'non-leads cannot change team workflow');
    const create = async (title, extras = {}) => {
      const response = await request(owner, '/issues', 'POST', { title, teamId: team.id, assigneeId: null, ...extras });
      equal(response.status, 201, await response.clone().text());
      return response.json();
    };
    const customStateIssue = await create('Custom workflow issue', { status: 'quality_check' });
    equal(customStateIssue.status, 'quality_check');
    const customCompletedIssue = await create('Custom completed issue', { status: 'shipped', projectId: project.id, cycleId: cycle.id });
    equal(customCompletedIssue.status, 'shipped');
    const projectCounts = await (await request(owner, `/projects/${project.id}`)).json();
    const cycleCounts = await (await request(owner, `/cycles/${cycle.id}`)).json();
    equal(projectCounts.completedIssues, 1, 'project progress uses the team completed category, not a hardcoded status');
    equal(cycleCounts.completedIssues, 1, 'cycle progress uses the team completed category, not a hardcoded status');
    const customStateList = await (await request(owner, '/issues')).json();
    equal(customStateList.find((item) => item.id === customStateIssue.id).statusLabel, 'Quality check');
    equal((await request(owner, `/issues/${customStateIssue.id}`, 'PATCH', { status: 'not_a_state' })).status, 400);
    const associatedIssue = await create('Valid team project and cycle', { projectId: project.id, cycleId: cycle.id, assigneeId: member.id });
    equal(associatedIssue.projectId, project.id);
    equal(associatedIssue.cycleId, cycle.id);
    equal(associatedIssue.assigneeId, member.id);
    equal((await request(owner, '/issues', 'POST', { title: 'Cross-team project', teamId: team.id, projectId: otherTeamProject.id })).status, 400);
    equal((await request(owner, '/issues', 'POST', { title: 'Cross-team cycle', teamId: team.id, cycleId: otherTeamCycle.id })).status, 400);
    const foreignParent = await request(owner, '/issues', 'POST', { title: 'Other team parent', teamId: secondTeam.id });
    equal(foreignParent.status, 201);
    equal((await request(owner, '/issues', 'POST', { title: 'Cross-team child', teamId: team.id, parentId: (await foreignParent.json()).id })).status, 400);
    const hierarchyRoot = await create('Hierarchy cycle root');
    const hierarchyChild = await create('Hierarchy cycle child', { parentId: hierarchyRoot.id });
    equal((await request(owner, `/issues/${hierarchyRoot.id}`, 'PATCH', { parentId: hierarchyChild.id })).status, 400, 'cyclic parent updates are rejected');
    const issue = await create('Estimate zero and due date', {
      estimate: 0, dueDate: '2026-10-20', labelIds: [label.id], status: 'todo',
    });
    equal(issue.assigneeId, null);
    equal(issue.estimate, 0);
    equal(new Date(issue.dueDate).toISOString().slice(0, 10), '2026-10-20');
    const [savedLabel] = await postgres.db.select().from(issueLabels).where(eq(issueLabels.issueId, issue.id));
    equal(savedLabel.labelId, label.id);
    const propertyUpdate = await request(owner, `/issues/${issue.id}`, 'PATCH', { title: 'Edited issue title', description: 'Acceptance criteria', type: 'bug', priority: 'high', assigneeId: member.id });
    equal(propertyUpdate.status, 200);
    const updatedProperties = await propertyUpdate.json();
    equal(updatedProperties.title, 'Edited issue title');
    equal(updatedProperties.description, 'Acceptance criteria');
    equal(updatedProperties.type, 'bug');
    equal(updatedProperties.priority, 'high');
    equal(updatedProperties.assigneeId, member.id);
    const withoutUsedState = customWorkflow.filter((state) => state.key !== 'todo');
    equal((await request(owner, `/teams/${team.id}/workflow-states`, 'PATCH', { states: withoutUsedState })).status, 400, 'used workflow states cannot be removed');
    const invalidEstimate = await request(owner, `/issues/${issue.id}`, 'PATCH', { estimate: -1 });
    equal(invalidEstimate.status, 400);
    equal((await request(owner, `/issues/${issue.id}`, 'PATCH', { dueDate: 'not-a-date' })).status, 400);
    const cleared = await request(owner, `/issues/${issue.id}`, 'PATCH', { estimate: null, dueDate: null, labelIds: [], assigneeId: null });
    equal(cleared.status, 200);
    const clearedIssue = await cleared.json();
    equal(clearedIssue.estimate, null);
    equal(clearedIssue.dueDate, null);
    equal(clearedIssue.assigneeId, null);
    equal((await postgres.db.select().from(issueLabels).where(eq(issueLabels.issueId, issue.id))).length, 0);

    const second = await create('Second dependency');
    const third = await create('Third dependency');
    equal((await request(owner, `/issues/${issue.id}/relations`, 'POST', { relatedIssueId: issue.id, type: 'blocks' })).status, 400);
    equal((await request(owner, `/issues/${issue.id}/relations`, 'POST', { relatedIssueId: second.id, type: 'blocks' })).status, 201);
    equal((await request(owner, `/issues/${second.id}/relations`, 'POST', { relatedIssueId: third.id, type: 'blocks' })).status, 201);
    equal((await request(owner, `/issues/${third.id}/relations`, 'POST', { relatedIssueId: issue.id, type: 'blocks' })).status, 400, 'dependency cycles rejected');
    const reverse = await (await request(member, `/issues/${second.id}/relations`)).json();
    ok(reverse.some((relation) => relation.type === 'blocked_by' && relation.relatedIssue.id === issue.id), 'inverse dependency displays consistently');
    equal((await request(owner, `/issues/${issue.id}/relations`, 'POST', { relatedIssueId: second.id, type: 'related_to' })).status, 201);
    equal((await request(owner, `/issues/${second.id}/relations`, 'POST', { relatedIssueId: issue.id, type: 'related_to' })).status, 201);
    equal((await postgres.db.select().from(issueRelations).where(eq(issueRelations.type, 'related_to'))).length, 1, 'symmetric relation stored once');
    equal((await request(owner, `/issues/${issue.id}/relations/${second.id}?type=blocks`, 'DELETE')).status, 200);
    const remainingReverse = await (await request(owner, `/issues/${second.id}/relations`)).json();
    ok(!remainingReverse.some((relation) => relation.type === 'blocked_by'), 'deleting a directional edge also removes its inverse view');
    const duplicateTarget = await create('Original issue');
    const duplicateResponse = await request(owner, `/issues/${issue.id}/relations`, 'POST', { relatedIssueId: duplicateTarget.id, type: 'duplicate' });
    equal(duplicateResponse.status, 201);
    const duplicateReverse = await (await request(owner, `/issues/${duplicateTarget.id}/relations`)).json();
    ok(duplicateReverse.some((relation) => relation.type === 'duplicate' && relation.duplicateDirection === 'target'), 'duplicate relationship exposes the original issue direction from both ends');
    const duplicateRows = await postgres.db.select().from(issueRelations).where(eq(issueRelations.type, 'duplicate'));
    equal(duplicateRows.length, 1);
    equal(duplicateRows[0].duplicateSourceIssueId, issue.id, 'duplicate origin is retained as provenance');
    const reverseDuplicate = await request(owner, `/issues/${duplicateTarget.id}/relations`, 'POST', { relatedIssueId: issue.id, type: 'duplicate' });
    equal(reverseDuplicate.status, 201);
    equal((await postgres.db.select().from(issueRelations).where(eq(issueRelations.type, 'duplicate'))).length, 1, 'reverse duplicate replay does not create a second edge');
    const crossTeamResponse = await request(owner, '/issues', 'POST', { title: 'Other team issue', teamId: secondTeam.id });
    equal(crossTeamResponse.status, 201);
    const crossTeamIssue = await crossTeamResponse.json();
    equal((await request(owner, `/issues/${issue.id}/relations`, 'POST', { relatedIssueId: crossTeamIssue.id, type: 'related_to' })).status, 400, 'relations cannot cross team boundaries');
    equal((await request(outsider, `/issues/${issue.id}/relations`)).status, 403);

    const child = await create('Child issue', { parentId: issue.id });
    const grandchild = await create('Grandchild issue', { parentId: child.id });
    equal((await request(owner, `/issues/${issue.id}/archive`, 'POST')).status, 201);
    equal((await request(owner, `/issues`)).status, 200);
    const active = await (await request(owner, '/issues')).json();
    ok(!active.some((item) => [issue.id, child.id, grandchild.id].includes(item.id)), 'archived hierarchy is omitted from default lists');
    const archived = await (await request(owner, '/issues?archived=true')).json();
    ok([issue.id, child.id, grandchild.id].every((id) => archived.some((item) => item.id === id)));
    await postgres.reopen();
    equal((await request(owner, `/issues/${issue.id}/restore`, 'POST')).status, 201);
    const restored = await (await request(owner, '/issues')).json();
    ok([issue.id, child.id, grandchild.id].every((id) => restored.some((item) => item.id === id)), 'same archive operation restores its subtree after restart');
    const independentParent = await create('Independent archive parent');
    const independentlyArchivedChild = await create('Independently archived child', { parentId: independentParent.id });
    await request(owner, `/issues/${independentlyArchivedChild.id}/archive`, 'POST');
    await request(owner, `/issues/${independentParent.id}/archive`, 'POST');
    await request(owner, `/issues/${independentParent.id}/restore`, 'POST');
    const independentStates = await postgres.db.select().from(issues).where(inArray(issues.id, [independentParent.id, independentlyArchivedChild.id]));
    equal(independentStates.find((row) => row.id === independentParent.id).archivedAt, null);
    ok(independentStates.find((row) => row.id === independentlyArchivedChild.id).archivedAt, 'restoring a parent does not restore a separately archived child');
    await request(owner, `/issues/${independentlyArchivedChild.id}/restore`, 'POST');

    const oldest = await create('Move me to top');
    const another = await create('Neighbor');
    equal((await request(owner, `/issues/${oldest.id}/move-to-top`, 'POST')).status, 201);
    const ordered = await (await request(owner, '/issues')).json();
    equal(ordered[0].id, oldest.id);
    const bulk = await request(owner, '/issues/bulk', 'PATCH', { ids: [oldest.id, another.id], status: 'in_progress', estimate: 0 });
    equal(bulk.status, 200);
    const bulkRows = await bulk.json();
    equal(bulkRows.length, 2);
    ok(bulkRows.every((row) => row.status === 'in_progress' && row.estimate === 0));
    equal((await request(owner, '/issues/bulk', 'PATCH', { ids: [oldest.id] })).status, 400, 'empty bulk updates are rejected');
    equal((await request(member, '/issues/bulk', 'PATCH', { ids: [oldest.id], status: 'done' })).status, 200);
    ok((await postgres.db.select().from(activities).where(andIssueStatus(oldest.id))).length > 0);
    const recurringIssue = await create('Recurring API lifecycle');
    const recurrencePayload = { intervalCount: 2, unit: 'week', timezone: 'America/Los_Angeles', nextRunAt: '2099-03-01T09:00:00.000Z', dueDateOffsetDays: 3 };
    const recurrenceResponse = await request(owner, `/issues/${recurringIssue.id}/recurrence`, 'POST', recurrencePayload);
    equal(recurrenceResponse.status, 201, await recurrenceResponse.clone().text());
    const recurrence = await recurrenceResponse.json();
    equal(recurrence.timezone, recurrencePayload.timezone);
    equal(recurrence.template.dueDateOffsetDays, 3);
    equal((await request(member, `/issues/${recurringIssue.id}/recurrence`)).status, 200, 'team members can read recurrence details');
    equal((await request(owner, `/issues/${recurringIssue.id}/recurrence`, 'POST', { ...recurrencePayload, timezone: 'Not/A_Timezone' })).status, 400);
    equal((await request(owner, `/issues/${recurringIssue.id}/recurrence`, 'POST', { ...recurrencePayload, intervalCount: 0 })).status, 400);
    await postgres.db.update(issueRecurrences).set({ nextRunAt: new Date(Date.now() - 60_000) }).where(eq(issueRecurrences.id, recurrence.id));
    const generatedOccurrences = await processDueIssueRecurrences(postgres.db, new Date());
    equal(generatedOccurrences.length, 1, 'configured recurrence generates through the worker against the same database');
    const [generatedOccurrence] = await postgres.db.select().from(issues).where(eq(issues.id, generatedOccurrences[0].issueId));
    equal(generatedOccurrence.title, 'Recurring API lifecycle');
    equal((await request(owner, `/issues/${recurringIssue.id}`, 'PATCH', { title: 'Updated recurring template' })).status, 200);
    const editedRecurrence = await request(owner, `/issues/${recurringIssue.id}/recurrence`, 'POST', { ...recurrencePayload, nextRunAt: '2099-04-01T09:00:00.000Z' });
    equal(editedRecurrence.status, 201);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, generatedOccurrence.id)))[0].title, 'Recurring API lifecycle', 'editing the template does not rewrite prior generated issues');
    equal((await editedRecurrence.json()).template.title, 'Updated recurring template');
    equal((await request(owner, `/issues/${recurringIssue.id}/archive`, 'POST')).status, 201);
    const [stoppedByArchive] = await postgres.db.select().from(issueRecurrences).where(eq(issueRecurrences.id, recurrence.id));
    equal(stoppedByArchive.enabled, false, 'archiving the source stops future occurrences without deleting prior runs');
    equal((await request(owner, `/issues/${recurringIssue.id}/restore`, 'POST')).status, 201);
    equal((await request(owner, `/issues/${recurringIssue.id}/recurrence`, 'DELETE')).status, 200);
    const [stopped] = await postgres.db.select().from(issueRecurrences).where(eq(issueRecurrences.id, recurrence.id));
    equal(stopped.enabled, false, 'stopping a recurrence retains its configuration and history');
    ok(await postgres.db.select().from(labels).where(eq(labels.id, label.id)).then((rows) => rows.length === 1));
    ok(await postgres.db.select().from(issues).where(inArray(issues.id, [issue.id, child.id, grandchild.id])).then((rows) => rows.every((row) => !row.archivedAt)));
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});

function andIssueStatus(issueId) {
  const { and, eq } = require('drizzle-orm');
  return and(eq(activities.issueId, issueId), eq(activities.type, 'issue.status_changed'));
}
