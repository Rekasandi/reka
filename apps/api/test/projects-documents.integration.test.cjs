// Project workflows and scoped documents through authenticated Nest HTTP + isolated Postgres.
const { equal, ok, deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { and, eq, sql } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, projects, projectMembers, issues, milestones, documents, projectUpdates, projectDependencies, projectUpdateSubscriptions, notifications } = require('@reka/database');
const { ProjectsModule } = require('../dist/projects/projects.module');
const { DocumentsModule } = require('../dist/documents/documents.module');
const { SearchModule } = require('../dist/search/search.module');
const { ViewsModule } = require('../dist/views/views.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

const migrationSource = path.resolve(__dirname, '../../../packages/database/drizzle');

test('projects, milestones, dependencies, updates and documents persist with workspace/private access', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Project company', slug: `projects-${suffix.toLowerCase()}` }).returning();
    const [owner, member, outsider] = await postgres.db.insert(users).values([
      { name: 'Project owner', email: `project-owner-${suffix}@example.test`, role: 'owner' },
      { name: 'Project member', email: `project-member-${suffix}@example.test`, role: 'member' },
      { name: 'Unrelated owner', email: `project-outsider-${suffix}@example.test`, role: 'owner' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: member.id, role: 'member' },
    ]);
    const [publicTeam, privateTeam] = await postgres.db.insert(teams).values([
      { organizationId: org.id, name: 'Project team', key: `PRJ${suffix}` },
      { organizationId: org.id, name: 'Secret team', key: `SEC${suffix}`, isPrivate: true },
    ]).returning();
    await postgres.db.insert(teamMembers).values([
      { teamId: publicTeam.id, userId: owner.id, role: 'lead' },
      { teamId: publicTeam.id, userId: member.id, role: 'member' },
      { teamId: privateTeam.id, userId: owner.id, role: 'lead' },
    ]);
    const [project, second, third, privateProject] = await postgres.db.insert(projects).values([
      { organizationId: org.id, teamId: publicTeam.id, name: `Main project ${suffix}`, slug: `main-${suffix.toLowerCase()}`, ownerId: owner.id },
      { organizationId: org.id, teamId: publicTeam.id, name: `Prerequisite ${suffix}`, slug: `pre-${suffix.toLowerCase()}`, ownerId: owner.id },
      { organizationId: org.id, teamId: publicTeam.id, name: `Third project ${suffix}`, slug: `third-${suffix.toLowerCase()}`, ownerId: owner.id },
      { organizationId: org.id, teamId: privateTeam.id, name: `SECRET_PRIVATE_PROJECT_${suffix}`, slug: `secret-${suffix.toLowerCase()}`, ownerId: owner.id },
    ]).returning();
    await postgres.db.insert(projectMembers).values([{ projectId: project.id, userId: owner.id, role: 'owner' }, { projectId: project.id, userId: member.id, role: 'member' }]);
    await postgres.db.insert(projectUpdateSubscriptions).values([{ projectId: project.id, userId: owner.id }, { projectId: project.id, userId: member.id }]);
    const [done, open, canceled, privateIssue] = await postgres.db.insert(issues).values([
      { identifier: `${publicTeam.key}-1`, number: 1, title: 'Delivered milestone work', teamId: publicTeam.id, projectId: project.id, reporterId: owner.id, status: 'done' },
      { identifier: `${publicTeam.key}-2`, number: 2, title: 'Remaining milestone work', teamId: publicTeam.id, projectId: project.id, reporterId: owner.id, status: 'backlog' },
      { identifier: `${publicTeam.key}-3`, number: 3, title: 'Canceled milestone work', teamId: publicTeam.id, projectId: project.id, reporterId: owner.id, status: 'canceled' },
      { identifier: `${privateTeam.key}-1`, number: 1, title: `SECRET_PRIVATE_ISSUE_${suffix}`, teamId: privateTeam.id, projectId: privateProject.id, reporterId: owner.id },
    ]).returning();
    const tokens = {};
    for (const user of [owner, member, outsider]) {
      tokens[user.id] = randomUUID();
      await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    }
    api = await createIsolatedApi(postgres, [ProjectsModule, DocumentsModule, SearchModule, ViewsModule]);
    const request = (user, url, method = 'GET', body) => fetch(`${api.url}/api${url}`, {
      method, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // Ordered milestones preserve their legacy table and use issue-state categories for rollup.
    equal((await request(member, `/projects/${project.id}/milestones`, 'POST', { name: 'Not manager' })).status, 403);
    const firstResponse = await request(owner, `/projects/${project.id}/milestones`, 'POST', { name: 'Alpha', description: 'First stage', targetDate: '2026-11-02' });
    equal(firstResponse.status, 201, await firstResponse.clone().text());
    const first = await firstResponse.json();
    const secondResponse = await request(owner, `/projects/${project.id}/milestones`, 'POST', { name: 'Beta' });
    equal(secondResponse.status, 201);
    const next = await secondResponse.json();
    equal(first.position, 0); equal(next.position, 1);
    equal((await request(member, `/projects/${project.id}/milestones/${first.id}/issues/${open.id}`, 'POST')).status, 201);
    equal((await request(member, `/projects/${project.id}/milestones/${first.id}/issues/${done.id}`, 'POST')).status, 201);
    equal((await request(member, `/projects/${project.id}/milestones/${first.id}/issues/${canceled.id}`, 'POST')).status, 201);
    equal((await request(member, `/projects/${project.id}/milestones/${first.id}/issues/${privateIssue.id}`, 'POST')).status, 404);
    const milestoneRows = await (await request(member, `/projects/${project.id}/milestones`)).json();
    const rollup = milestoneRows.find(item => item.id === first.id);
    equal(rollup.totalIssues, 2); equal(rollup.completedIssues, 1); equal(rollup.progress, 50); equal(rollup.isComplete, false);
    equal((await request(member, `/projects/${project.id}/milestones/${first.id}`, 'PATCH', { position: 1 })).status, 403);
    equal((await request(owner, `/projects/${project.id}/milestones/${first.id}`, 'PATCH', { position: 1 })).status, 200);
    const reordered = await (await request(owner, `/projects/${project.id}/milestones`)).json();
    deepEqual(reordered.map(item => item.name), ['Beta', 'Alpha']);
    equal((await request(member, `/projects/${project.id}/milestones/${next.id}/issues/${open.id}`, 'DELETE')).status, 404, 'wrong milestone path cannot remove a different assignment');
    equal((await request(member, `/projects/${project.id}/milestones/${first.id}/issues/${open.id}`, 'DELETE')).status, 200);

    // Dependency graph is directional and cycle guarded; inaccessible private projects are not readable.
    equal((await request(owner, `/projects/${project.id}/dependencies`, 'POST', { dependsOnProjectId: second.id })).status, 201);
    equal((await request(owner, `/projects/${second.id}/dependencies`, 'POST', { dependsOnProjectId: third.id })).status, 201);
    equal((await request(owner, `/projects/${third.id}/dependencies`, 'POST', { dependsOnProjectId: project.id })).status, 400);
    const dependencies = await (await request(member, `/projects/${project.id}/dependencies`)).json();
    equal(dependencies.dependsOn[0].id, second.id);
    equal((await request(member, `/projects/${project.id}/dependencies`, 'POST', { dependsOnProjectId: second.id })).status, 403);
    equal((await request(member, `/projects/${project.id}/dependencies`, 'POST', { dependsOnProjectId: privateProject.id })).status, 403);

    // Updates are authored, scoped, and notify only currently readable subscribers.
    equal((await (await request(owner, `/projects/${project.id}/update-subscription`)).json()).subscribed, true);
    equal((await request(owner, `/projects/${project.id}/update-subscription`, 'DELETE')).status, 200);
    const updateResponse = await request(member, `/projects/${project.id}/updates`, 'POST', { health: 'at_risk', body: 'A measurable risk and mitigation plan.' });
    equal(updateResponse.status, 201, await updateResponse.clone().text());
    const update = await updateResponse.json();
    equal(update.authorId, member.id); equal(update.health, 'at_risk');
    equal((await postgres.db.select().from(projects).where(eq(projects.id, project.id)))[0].health, 'at_risk');
    equal((await postgres.db.select().from(notifications).where(sql`${notifications.metadata}->>'projectId' = ${project.id}`)).length, 0);
    equal((await request(owner, `/projects/${project.id}/update-subscription`, 'POST')).status, 201);
    const secondUpdate = await request(member, `/projects/${project.id}/updates`, 'POST', { health: 'off_track', body: 'The risk now blocks delivery.' });
    equal(secondUpdate.status, 201);
    const secondUpdateData = await secondUpdate.json();
    const updateNotice = await postgres.db.select().from(notifications).where(sql`${notifications.metadata}->>'updateId' = ${secondUpdateData.id}`);
    equal(updateNotice.length, 1); equal(updateNotice[0].userId, owner.id);
    equal((await request(owner, `/projects/${project.id}/updates/${update.id}`, 'PATCH', { body: 'Edited earlier risk note' })).status, 200);
    equal((await postgres.db.select().from(projects).where(eq(projects.id, project.id)))[0].health, 'off_track', 'editing an older update preserves the latest health');
    equal((await request(outsider, `/projects/${privateProject.id}/updates`)).status, 403);

    // Workspace/team/project docs share a scoped, searchable model. Archived docs disappear from search/favorites.
    equal((await request(member, '/documents', 'POST', { title: 'Workspace doc', content: 'forbidden' })).status, 403);
    const workspaceDoc = await request(owner, '/documents', 'POST', { title: `Workspace handbook ${suffix}`, content: `workspace-content-${suffix}` });
    equal(workspaceDoc.status, 201, await workspaceDoc.clone().text());
    const projectDoc = await request(member, '/documents', 'POST', { title: `Project notes ${suffix}`, content: `searchable-project-content-${suffix}`, projectId: project.id });
    equal(projectDoc.status, 201, await projectDoc.clone().text());
    const teamDoc = await request(member, '/documents', 'POST', { title: `Team notes ${suffix}`, content: `searchable-team-content-${suffix}`, teamId: publicTeam.id });
    equal(teamDoc.status, 201, await teamDoc.clone().text());
    const teamDocument = await teamDoc.json();
    const privateDoc = await request(owner, '/documents', 'POST', { title: `SECRET_PRIVATE_DOC_${suffix}`, content: `secret-doc-body-${suffix}`, teamId: privateTeam.id });
    equal(privateDoc.status, 201);
    const privateDocData = await privateDoc.json();
    equal((await request(member, `/documents/${privateDocData.id}`)).status, 404);
    equal((await request(member, `/projects/${privateProject.id}/update-subscription`, 'POST')).status, 404);
    equal((await request(member, `/documents?teamId=${privateTeam.id}`)).status, 404);

    const projectDocument = await projectDoc.json();
    equal((await request(member, `/documents/${projectDocument.id}`, 'PATCH', { title: 'Changed notes', content: `updated-document-${suffix}` })).status, 200);
    equal((await request(member, '/favorites', 'POST', { resourceType: 'document', resourceId: projectDocument.id })).status, 201);
    equal((await request(member, '/favorites', 'POST', { resourceType: 'document', resourceId: privateDocData.id })).status, 404);
    const search = await (await request(member, `/search?q=${suffix}`)).json();
    ok(search.documents.some(document => document.id === projectDocument.id));
    ok(search.documents.some(document => document.id === teamDocument.id));
    ok(!JSON.stringify(search).includes('SECRET_PRIVATE'));
    const archived = await request(member, `/documents/${projectDocument.id}/archive`, 'POST');
    equal(archived.status, 201);
    const archivedSearch = await (await request(member, `/search?q=${suffix}`)).json();
    ok(!archivedSearch.documents.some(document => document.id === projectDocument.id));
    ok(!(await (await request(member, '/favorites')).json()).some(item => item.resourceId === projectDocument.id));
    equal((await request(member, `/documents/${projectDocument.id}/restore`, 'POST')).status, 201);
    const restoredSearch = await (await request(member, `/search?q=${suffix}`)).json();
    ok(restoredSearch.documents.some(document => document.id === projectDocument.id));

    // Project date range and lead/member changes persist; non-managers cannot reassign the lead.
    equal((await request(member, `/projects/${project.id}`, 'PATCH', { ownerId: member.id })).status, 403);
    equal((await request(owner, `/projects/${project.id}`, 'PATCH', { startDate: '2026-11-02', targetDate: '2026-11-01' })).status, 400);
    const dates = await request(owner, `/projects/${project.id}`, 'PATCH', { startDate: '2026-10-01', targetDate: '2026-11-01' });
    equal(dates.status, 200);
    const savedDates = await dates.json();
    equal(new Date(savedDates.startDate).toISOString().slice(0, 10), '2026-10-01');
    equal(new Date(savedDates.targetDate).toISOString().slice(0, 10), '2026-11-01');
    const leadTransfer = await request(owner, `/projects/${project.id}`, 'PATCH', { ownerId: member.id });
    equal(leadTransfer.status, 200);
    equal((await leadTransfer.json()).ownerId, member.id);
    equal((await postgres.db.select().from(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, member.id))))[0].role, 'owner');
    equal((await request(member, `/projects/${project.id}/members/${owner.id}`, 'DELETE')).status, 200);
    equal((await request(member, `/projects/${project.id}/members/${member.id}`, 'DELETE')).status, 400, 'current project lead cannot be removed before handoff');

    // Real restart verifies new records persist through the migration/schema contract.
    await api.close(); api = null;
    await postgres.reopen();
    api = await createIsolatedApi(postgres, [ProjectsModule, DocumentsModule, SearchModule, ViewsModule]);
    equal((await (await request(owner, `/projects/${project.id}/milestones`)).json()).length, 2);
    equal((await (await request(member, `/documents?projectId=${project.id}`)).json()).length, 1);
    equal((await postgres.db.select().from(projectUpdates).where(eq(projectUpdates.projectId, project.id))).length, 2);
    equal((await postgres.db.select().from(projectDependencies).where(eq(projectDependencies.projectId, project.id))).length, 1);
    equal((await postgres.db.select().from(projectUpdateSubscriptions).where(and(eq(projectUpdateSubscriptions.projectId, project.id), eq(projectUpdateSubscriptions.userId, member.id)))).length, 1);
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});

test('project workflow migration adds scoped records and order without replacing existing milestones/issues', { timeout: 90000 }, async () => {
  const sourceJournal = JSON.parse(fs.readFileSync(path.join(migrationSource, 'meta/_journal.json'), 'utf8'));
  const beforeProjectWorkflows = sourceJournal.entries.slice(0, 19);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'reka-project-migrations-'));
  const meta = path.join(folder, 'meta'); fs.mkdirSync(meta);
  const stagedJournal = { ...sourceJournal, entries: beforeProjectWorkflows };
  fs.writeFileSync(path.join(meta, '_journal.json'), JSON.stringify(stagedJournal, null, 2));
  for (const entry of beforeProjectWorkflows) fs.copyFileSync(path.join(migrationSource, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
  const postgres = await createPersistentPostgres({ migrationsFolder: folder });
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Legacy projects', slug: `legacy-projects-${suffix}` }).returning();
    const [owner] = await postgres.db.insert(users).values({ name: 'Legacy lead', email: `legacy-lead-${suffix}@example.test`, role: 'owner' }).returning();
    const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Legacy team', key: `L${suffix.slice(0, 4).toUpperCase()}` }).returning();
    const [project] = await postgres.db.insert(projects).values({ organizationId: org.id, teamId: team.id, name: 'Existing project', slug: `old-${suffix}`, ownerId: owner.id }).returning();
    await postgres.db.insert(projectMembers).values({ projectId: project.id, userId: owner.id, role: 'owner' });
    const milestoneId = randomUUID();
    await postgres.db.execute(sql`INSERT INTO milestones (id, project_id, name, is_completed) VALUES (${milestoneId}, ${project.id}, 'Existing milestone', true)`);
    const milestone = { id: milestoneId };
    const [issue] = await postgres.db.insert(issues).values({ identifier: `${team.key}-1`, number: 1, title: 'Existing milestone issue', teamId: team.id, projectId: project.id, milestoneId: milestone.id, reporterId: owner.id }).returning();
    const migratedJournal = { ...sourceJournal, entries: sourceJournal.entries.slice(0, 21) };
    fs.copyFileSync(path.join(migrationSource, '0019_overconfident_thunderbolts.sql'), path.join(folder, '0019_overconfident_thunderbolts.sql'));
    fs.copyFileSync(path.join(migrationSource, '0020_aberrant_kulan_gath.sql'), path.join(folder, '0020_aberrant_kulan_gath.sql'));
    fs.writeFileSync(path.join(meta, '_journal.json'), JSON.stringify(migratedJournal, null, 2));
    await postgres.migrate(folder);
    const [afterMilestone] = await postgres.db.select().from(milestones).where(eq(milestones.id, milestone.id));
    const [afterIssue] = await postgres.db.select().from(issues).where(eq(issues.id, issue.id));
    equal(afterMilestone.name, 'Existing milestone'); equal(afterMilestone.isCompleted, true); equal(afterMilestone.position, 0);
    equal(afterIssue.title, 'Existing milestone issue'); equal(afterIssue.milestoneId, milestone.id);
    equal((await postgres.db.select().from(documents)).length, 0);
    equal((await postgres.db.select().from(projectUpdates)).length, 0);
    equal((await postgres.db.select().from(projectUpdateSubscriptions).where(eq(projectUpdateSubscriptions.projectId, project.id))).length, 1);
  } finally {
    await postgres.close(); fs.rmSync(folder, { recursive: true, force: true });
  }
});
