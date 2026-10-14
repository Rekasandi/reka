// Real Nest HTTP -> saved view/favorite/search authorization -> isolated Postgres.
const { equal, ok, deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { and, eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, issues, projects, savedViews, userFavorites } = require('@reka/database');
const { ViewsModule } = require('../dist/views/views.module');
const { SearchModule } = require('../dist/search/search.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

const config = (overrides = {}) => ({
  filterTab: 'all', viewMode: 'list', groupBy: 'none', sortBy: 'updated', showSubtasks: true,
  filters: { assigneeIds: [], labelIds: [], priorities: [], projectIds: [], ...(overrides.filters || {}) },
  ...overrides,
});

test('saved views, favorites, and global search are persistent, bounded, and private-team scoped', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Views company', slug: `views-${suffix.toLowerCase()}` }).returning();
    const [owner, admin, member, teammate, outsider] = await postgres.db.insert(users).values([
      { name: 'View owner', email: `view-owner-${suffix}@example.test`, role: 'owner' },
      { name: 'View admin', email: `view-admin-${suffix}@example.test`, role: 'admin' },
      { name: 'View member', email: `view-member-${suffix}@example.test`, role: 'member' },
      { name: 'Team member', email: `view-teammate-${suffix}@example.test`, role: 'member' },
      { name: 'Other company', email: `view-outsider-${suffix}@example.test`, role: 'owner' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: admin.id, role: 'admin' },
      { organizationId: org.id, userId: member.id, role: 'member' },
      { organizationId: org.id, userId: teammate.id, role: 'member' },
    ]);
    const [publicTeam, privateTeam, otherOrg] = await postgres.db.insert(teams).values([
      { organizationId: org.id, name: 'Public team', key: `PUB${suffix}` },
      { organizationId: org.id, name: 'Private team', key: `PRI${suffix}`, isPrivate: true },
      { organizationId: org.id, name: 'Outside team', key: `OUT${suffix}` },
    ]).returning();
    const [org2] = await postgres.db.insert(organizations).values({ name: 'Other company', slug: `outside-${suffix.toLowerCase()}` }).returning();
    await postgres.db.update(teams).set({ organizationId: org2.id }).where(eq(teams.id, otherOrg.id));
    await postgres.db.insert(organizationMembers).values({ organizationId: org2.id, userId: outsider.id, role: 'owner' });
    await postgres.db.insert(teamMembers).values([
      { teamId: publicTeam.id, userId: owner.id, role: 'lead' },
      { teamId: publicTeam.id, userId: member.id, role: 'member' },
      { teamId: publicTeam.id, userId: teammate.id, role: 'member' },
      { teamId: privateTeam.id, userId: owner.id, role: 'lead' },
      { teamId: privateTeam.id, userId: member.id, role: 'member' },
    ]);
    const [publicProject] = await postgres.db.insert(projects).values({
      organizationId: org.id, teamId: publicTeam.id, name: `Public project ${suffix}`, slug: `public-${suffix.toLowerCase()}`, ownerId: owner.id,
    }).returning();
    const [privateProject] = await postgres.db.insert(projects).values({
      organizationId: org.id, teamId: privateTeam.id, name: `SECRET_PRIVATE_PROJECT_${suffix}`, slug: `private-${suffix.toLowerCase()}`, ownerId: owner.id,
    }).returning();
    const [publicIssue, privateIssue, secondPublicIssue] = await postgres.db.insert(issues).values([
      { identifier: `${publicTeam.key}-1`, number: 1, title: `Public defect ${suffix}`, teamId: publicTeam.id, reporterId: owner.id, projectId: publicProject.id },
      { identifier: `${privateTeam.key}-1`, number: 1, title: `SECRET_PRIVATE_ISSUE_${suffix}`, teamId: privateTeam.id, reporterId: owner.id, projectId: privateProject.id },
      { identifier: `${publicTeam.key}-2`, number: 2, title: `Public followup ${suffix}`, teamId: publicTeam.id, reporterId: owner.id, projectId: publicProject.id },
    ]).returning();
    const tokens = {};
    for (const user of [owner, admin, member, teammate, outsider]) {
      tokens[user.id] = randomUUID();
      await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    }
    api = await createIsolatedApi(postgres, [ViewsModule, SearchModule]);
    const request = (user, path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const query = await (await request(teammate, `/search?q=${suffix}`)).json();
    ok(query.issues.some(issue => issue.id === publicIssue.id));
    ok(!query.issues.some(issue => issue.id === privateIssue.id));
    ok(query.projects.some(project => project.id === publicProject.id));
    ok(query.issues.some(issue => issue.id === secondPublicIssue.id));
    ok(!JSON.stringify(query).includes('SECRET_PRIVATE'));
    const firstPage = await (await request(teammate, `/search?q=${suffix}&limit=1&offset=0`)).json();
    const secondPage = await (await request(teammate, `/search?q=${suffix}&limit=1&offset=1`)).json();
    equal(firstPage.issues.length, 1); ok(firstPage.hasMore);
    equal(secondPage.issues.length, 1); ok(!firstPage.issues.some(issue => issue.id === secondPage.issues[0].id));
    equal((await request(member, `/search?q=${suffix}&limit=0`)).status, 400);
    equal((await request(member, `/search?q=${suffix}&offset=1001`)).status, 400);
    const outsideSearch = await (await request(outsider, `/search?q=${suffix}`)).json();
    equal(outsideSearch.issues.length, 0); equal(outsideSearch.projects.length, 0);

    equal((await request(member, '/views', 'POST', { name: 'Invalid board', visibility: 'private', config: config({ viewMode: 'board', groupBy: 'none' }) })).status, 400);
    const privateOwned = await request(member, '/views', 'POST', { name: 'My private view', visibility: 'private', config: config() });
    equal(privateOwned.status, 201, await privateOwned.clone().text());
    const privateView = await privateOwned.json();
    const ownerViews = await (await request(owner, '/views')).json();
    equal(ownerViews.some(view => view.id === privateView.id), false);
    const workspaceShared = await request(admin, '/views', 'POST', { name: 'Admin shared view', visibility: 'shared', config: config() });
    equal(workspaceShared.status, 201, await workspaceShared.clone().text());
    equal((await request(admin, `/views?teamId=${privateTeam.id}`)).status, 404, 'workspace admin has no implicit private-team read access');
    const shared = await request(owner, '/views', 'POST', {
      name: 'Shared public queue', teamId: publicTeam.id, visibility: 'shared',
      config: config({ filters: { projectIds: [publicProject.id] } }),
    });
    equal(shared.status, 201, await shared.clone().text());
    const sharedView = await shared.json();
    equal((await request(member, `/views?teamId=${publicTeam.id}`)).status, 200);
    const memberViews = await (await request(member, `/views?teamId=${publicTeam.id}`)).json();
    ok(memberViews.some(view => view.id === sharedView.id));
    ok(memberViews.some(view => view.name === 'Admin shared view'));
    const teammateViews = await (await request(teammate, `/views?teamId=${publicTeam.id}`)).json();
    ok(!teammateViews.some(view => view.id === privateView.id));
    equal((await request(teammate, `/views/${sharedView.id}`, 'PATCH', { name: 'Hijack' })).status, 403);
    equal((await request(member, `/views?teamId=${privateTeam.id}`)).status, 200);
    const memberTeamViewResponse = await request(member, '/views', 'POST', { name: 'Member private team view', teamId: privateTeam.id, visibility: 'private', config: config() });
    equal(memberTeamViewResponse.status, 201);
    const memberTeamView = await memberTeamViewResponse.json();
    await postgres.db.update(teamMembers).set({ role: 'viewer' }).where(and(eq(teamMembers.teamId, privateTeam.id), eq(teamMembers.userId, member.id)));
    equal((await request(member, `/views/${memberTeamView.id}`, 'PATCH', { name: 'Viewer cannot edit' })).status, 403);
    await postgres.db.update(teamMembers).set({ role: 'member' }).where(and(eq(teamMembers.teamId, privateTeam.id), eq(teamMembers.userId, member.id)));
    const privateShared = await request(owner, '/views', 'POST', {
      name: 'Private shared queue', teamId: privateTeam.id, visibility: 'shared', config: config({ filters: { projectIds: [privateProject.id] } }),
    });
    equal(privateShared.status, 201);
    equal((await request(teammate, `/views?teamId=${privateTeam.id}`)).status, 404);
    const privateSharedView = await privateShared.json();
    equal((await request(teammate, `/views/${privateSharedView.id}`)).status, 404);
    equal((await request(teammate, `/favorites`, 'POST', { resourceType: 'issue', resourceId: privateIssue.id })).status, 404);

    const globalPrivateProjectView = await request(owner, '/views', 'POST', {
      name: 'Private project filter', visibility: 'shared', config: config({ filters: { projectIds: [privateProject.id] } }),
    });
    equal(globalPrivateProjectView.status, 201);
    const hiddenConfigView = await globalPrivateProjectView.json();
    const visibleToMember = await (await request(teammate, '/views')).json();
    const sanitized = visibleToMember.find(view => view.id === hiddenConfigView.id);
    ok(sanitized);
    deepEqual(sanitized.config.filters.projectIds, [], 'shared view does not reveal inaccessible private project IDs');

    equal((await request(member, '/favorites', 'POST', { resourceType: 'issue', resourceId: publicIssue.id })).status, 201);
    equal((await request(member, '/favorites', 'POST', { resourceType: 'project', resourceId: publicProject.id })).status, 201);
    equal((await request(member, '/favorites', 'POST', { resourceType: 'view', resourceId: sharedView.id })).status, 201);
    await request(member, '/favorites', 'POST', { resourceType: 'issue', resourceId: publicIssue.id });
    equal((await request(member, '/favorites', 'POST', { resourceType: 'issue', resourceId: privateIssue.id })).status, 201);
    const favorites = await (await request(member, '/favorites')).json();
    equal(favorites.length, 4);
    ok(favorites.some(item => item.resourceType === 'issue' && item.href.includes(publicIssue.id)));
    const teammateFavorites = await (await request(teammate, '/favorites')).json();
    equal(teammateFavorites.length, 0);
    await request(member, `/favorites/issue/${publicIssue.id}`, 'DELETE');
    equal((await postgres.db.select().from(userFavorites).where(eq(userFavorites.userId, member.id))).length, 3);

    const configSave = await request(member, `/views/${privateView.id}`, 'PATCH', { config: { surprise: true } });
    equal(configSave.status, 400, 'view configuration is strictly validated');
    await postgres.db.delete(teamMembers).where(eq(teamMembers.userId, member.id));
    const revokedFavorites = await (await request(member, '/favorites')).json();
    ok(!JSON.stringify(revokedFavorites).includes('SECRET_PRIVATE'));
    ok(!revokedFavorites.some(item => item.resourceId === privateIssue.id));
    await postgres.db.update(organizationMembers).set({ isActive: false }).where(eq(organizationMembers.userId, member.id));
    equal((await request(member, '/views')).status, 403);

    await api.close(); api = null;
    await postgres.reopen();
    api = await createIsolatedApi(postgres, [ViewsModule, SearchModule]);
    const persisted = await (await request(owner, '/views')).json();
    ok(persisted.some(view => view.id === sharedView.id));
    equal((await postgres.db.select().from(savedViews)).length, 6);
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});

test('saved-view migration adds only new tables and preserves existing workspace issues', { timeout: 90000 }, async () => {
  const source = path.resolve(__dirname, '../../../packages/database/drizzle');
  const sourceJournal = JSON.parse(fs.readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  const beforeViews = sourceJournal.entries.slice(0, 18);
  const migrationsFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'reka-view-migrations-'));
  const meta = path.join(migrationsFolder, 'meta'); fs.mkdirSync(meta);
  fs.writeFileSync(path.join(meta, '_journal.json'), JSON.stringify({ ...sourceJournal, entries: beforeViews }, null, 2));
  for (const entry of beforeViews) fs.copyFileSync(path.join(source, `${entry.tag}.sql`), path.join(migrationsFolder, `${entry.tag}.sql`));
  const postgres = await createPersistentPostgres({ migrationsFolder });
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Existing workspace', slug: `existing-${suffix}` }).returning();
    const [owner] = await postgres.db.insert(users).values({ name: 'Existing owner', email: `existing-${suffix}@example.test`, role: 'owner' }).returning();
    const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Existing team', key: `X${suffix.slice(0, 4).toUpperCase()}` }).returning();
    const [existingIssue] = await postgres.db.insert(issues).values({ identifier: `${team.key}-1`, number: 1, title: 'Preserve through view migration', teamId: team.id, reporterId: owner.id }).returning();
    fs.copyFileSync(path.join(source, '0018_saved_views_favorites.sql'), path.join(migrationsFolder, '0018_saved_views_favorites.sql'));
    fs.writeFileSync(path.join(meta, '_journal.json'), JSON.stringify({ ...sourceJournal, entries: sourceJournal.entries.slice(0, 19) }, null, 2));
    await postgres.migrate(migrationsFolder);
    const [after] = await postgres.db.select().from(issues).where(eq(issues.id, existingIssue.id));
    equal(after.title, 'Preserve through view migration');
    equal((await postgres.db.select().from(savedViews)).length, 0);
    equal((await postgres.db.select().from(userFavorites)).length, 0);
  } finally {
    await postgres.close(); fs.rmSync(migrationsFolder, { recursive: true, force: true });
  }
});
