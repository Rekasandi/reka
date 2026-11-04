// Real Nest HTTP -> favorite/search authorization -> isolated Postgres.
const { equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, issues, projects, userFavorites } = require('@reka/database');
const { FavoritesModule } = require('../dist/favorites/favorites.module');
const { SearchModule } = require('../dist/search/search.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

test('favorites and global search are persistent, bounded, and private-team scoped', { timeout: 90000 }, async () => {
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
      await postgres.db.insert(sessions).values({ token: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    }
    api = await createIsolatedApi(postgres, [FavoritesModule, SearchModule]);
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

    equal((await request(teammate, `/favorites`, 'POST', { resourceType: 'issue', resourceId: privateIssue.id })).status, 404);

    equal((await request(member, '/favorites', 'POST', { resourceType: 'issue', resourceId: publicIssue.id })).status, 201);
    equal((await request(member, '/favorites', 'POST', { resourceType: 'project', resourceId: publicProject.id })).status, 201);
    equal((await request(member, '/favorites', 'POST', { resourceType: 'document', resourceId: randomUUID() })).status, 404);
    equal((await request(member, '/favorites', 'POST', { resourceType: 'view', resourceId: randomUUID() })).status, 400);
    await request(member, '/favorites', 'POST', { resourceType: 'issue', resourceId: publicIssue.id });
    equal((await request(member, '/favorites', 'POST', { resourceType: 'issue', resourceId: privateIssue.id })).status, 201);
    const favorites = await (await request(member, '/favorites')).json();
    equal(favorites.length, 3);
    ok(favorites.some(item => item.resourceType === 'issue' && item.href.includes(publicIssue.id)));
    const teammateFavorites = await (await request(teammate, '/favorites')).json();
    equal(teammateFavorites.length, 0);
    await request(member, `/favorites/issue/${publicIssue.id}`, 'DELETE');
    equal((await postgres.db.select().from(userFavorites).where(eq(userFavorites.userId, member.id))).length, 2);

    await postgres.db.delete(teamMembers).where(eq(teamMembers.userId, member.id));
    const revokedFavorites = await (await request(member, '/favorites')).json();
    ok(!JSON.stringify(revokedFavorites).includes('SECRET_PRIVATE'));
    ok(!revokedFavorites.some(item => item.resourceId === privateIssue.id));
    await postgres.db.update(organizationMembers).set({ isActive: false }).where(eq(organizationMembers.userId, member.id));
    equal((await request(member, '/favorites')).status, 403);

    await api.close(); api = null;
    await postgres.reopen();
    api = await createIsolatedApi(postgres, [FavoritesModule, SearchModule]);
    const persisted = await (await request(owner, '/favorites')).json();
    equal(persisted.length, 0);
    equal((await postgres.db.select().from(userFavorites).where(eq(userFavorites.userId, member.id))).length, 2);
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});
