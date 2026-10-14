const { equal, deepEqual, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq, and } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, projects, issues, cycles, labels, comments, activities, sessions, notifications } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const modules = ['issues', 'teams', 'projects', 'cycles', 'comments', 'activities', 'search', 'labels', 'notifications', 'users'].map(name => Object.values(require(`../dist/${name}/${name}.module`))[0]);

async function fixture() {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const db = postgres.db;
    const [org, foreignOrg] = await db.insert(organizations).values([{ name: 'Company', slug: 'company' }, { name: 'Unrelated', slug: 'unrelated' }]).returning();
    const people = {};
    const tokens = {};
    for (const [name, role, active, company] of [
      ['owner', 'owner', true, org], ['admin', 'admin', true, org], ['member', 'member', true, org],
      ['lead', 'member', true, org], ['viewer', 'member', true, org], ['deactivated', 'member', false, org],
      ['outsider', null, false, org], ['foreign', 'owner', true, foreignOrg],
      ['legacyGuest', 'guest', true, org], ['legacyClient', 'client', true, org],
    ]) {
      const [user] = await db.insert(users).values({ email: `${name}@example.test`, name, role: role || 'member' }).returning();
      people[name] = user;
      if (role) await db.insert(organizationMembers).values({ organizationId: company.id, userId: user.id, role, isActive: active });
      tokens[name] = randomUUID();
      await db.insert(sessions).values({ id: tokens[name], userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
    }
    const [publicTeam, privateTeam, foreignTeam] = await db.insert(teams).values([
      { organizationId: org.id, name: 'Public Engineering', key: 'PUB' },
      { organizationId: org.id, name: 'SECRET_WORK_PRIVATE', key: 'SEC', isPrivate: true },
      { organizationId: foreignOrg.id, name: 'FOREIGN_WORK', key: 'FOR' },
    ]).returning();
    await db.insert(teamMembers).values([
      { teamId: publicTeam.id, userId: people.owner.id, role: 'lead' },
      { teamId: privateTeam.id, userId: people.lead.id, role: 'lead' },
      { teamId: privateTeam.id, userId: people.viewer.id, role: 'viewer' },
      { teamId: privateTeam.id, userId: people.legacyGuest.id, role: 'lead' },
    ]);
    const [publicProject, privateProject, foreignProject] = await db.insert(projects).values([
      { organizationId: org.id, teamId: publicTeam.id, ownerId: people.owner.id, name: 'Public project', slug: 'public' },
      { organizationId: org.id, teamId: privateTeam.id, ownerId: people.lead.id, name: 'SECRET_WORK_PRIVATE', slug: 'private' },
      { organizationId: foreignOrg.id, teamId: foreignTeam.id, ownerId: people.foreign.id, name: 'FOREIGN_WORK', slug: 'foreign' },
    ]).returning();
    const dates = { startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31') };
    const [publicCycle, privateCycle] = await db.insert(cycles).values([
      { teamId: publicTeam.id, name: 'Public cycle', number: 1, ...dates },
      { teamId: privateTeam.id, name: 'SECRET_WORK_PRIVATE', number: 1, ...dates },
    ]).returning();
    const [publicIssue, privateIssue, foreignIssue] = await db.insert(issues).values([
      { teamId: publicTeam.id, projectId: publicProject.id, cycleId: publicCycle.id, reporterId: people.owner.id, title: 'Public issue', identifier: 'PUB-1', number: 1 },
      { teamId: privateTeam.id, projectId: privateProject.id, cycleId: privateCycle.id, reporterId: people.lead.id, title: 'SECRET_WORK_PRIVATE', identifier: 'SEC-1', number: 1 },
      { teamId: foreignTeam.id, projectId: foreignProject.id, reporterId: people.foreign.id, title: 'FOREIGN_WORK', identifier: 'FOR-1', number: 1 },
    ]).returning();
    await db.insert(labels).values([
      { organizationId: org.id, name: 'Public label', color: '#000000' },
      { organizationId: org.id, teamId: privateTeam.id, name: 'SECRET_WORK_PRIVATE', color: '#000000' },
      { organizationId: org.id, projectId: privateProject.id, name: 'SECRET_WORK_PRIVATE_PROJECT_LABEL', color: '#000000' },
      { organizationId: foreignOrg.id, name: 'FOREIGN_WORK', color: '#000000' },
    ]);
    await db.insert(comments).values({ issueId: privateIssue.id, authorId: people.lead.id, body: 'SECRET_WORK_PRIVATE' });
    await db.insert(activities).values([
      { actorId: people.owner.id, issueId: publicIssue.id, type: 'issue.created', metadata: { title: 'Public issue' } },
      { actorId: people.lead.id, issueId: privateIssue.id, projectId: privateProject.id, type: 'issue.created', metadata: { title: 'SECRET_WORK_PRIVATE' } },
      { actorId: people.foreign.id, issueId: foreignIssue.id, type: 'issue.created', metadata: { title: 'FOREIGN_WORK' } },
    ]);
    api = await createIsolatedApi(postgres, modules);
    const request = async (who, path, method = 'GET', body) => {
      const response = await fetch(`${api.url}/api${path}`, {
        method, headers: { Authorization: `Bearer ${tokens[who]}`, 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    return { postgres, api, request, people, tokens, org, foreignOrg, publicTeam, privateTeam, publicProject, privateProject, privateCycle, publicIssue, privateIssue,
      close: async () => { await api.close(); await postgres.close(); } };
  } catch (error) {
    if (api) await api.close();
    await postgres.close();
    throw error;
  }
}

test('valid sessions still require active single-workspace membership', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    for (const person of ['outsider', 'deactivated']) equal((await f.request(person, '/issues')).status, 403);
    await f.postgres.db.insert(organizationMembers).values({ organizationId: f.foreignOrg.id, userId: f.people.member.id, role: 'member' });
    equal((await f.request('member', '/issues')).status, 403, 'ambiguous workspace membership cannot choose first organization');
    await f.postgres.db.update(sessions).set({ expiresAt: new Date(0) }).where(eq(sessions.id, f.tokens.admin));
    equal((await f.request('admin', '/issues')).status, 401);
  } finally { await f.close(); }
});

test('owner/admin/member non-members cannot enumerate/read/mutate private core resources', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    for (const person of ['owner', 'admin', 'member']) {
      for (const path of ['/teams', '/projects', '/issues', '/cycles', '/labels', '/activities', '/search?q=SECRET_WORK']) {
        const response = await f.request(person, path);
        equal(response.status, 200, `${person} ${path}`);
        const serialized = JSON.stringify(response.body);
        equal(serialized.includes('SECRET_WORK'), false, `${person} ${path} must not leak private names/metadata`);
        equal(serialized.includes('FOREIGN_WORK'), false, `${person} ${path} must not leak another company`);
      }
      for (const path of [
        `/teams/${f.privateTeam.id}`, `/teams/${f.privateTeam.id}/workflow-states`, `/projects/${f.privateProject.id}`, `/projects/${f.privateProject.id}/members`,
        `/projects/${f.privateProject.id}/repositories`, `/issues/${f.privateIssue.id}`, '/issues/by-identifier/SEC-1',
        `/issues/${f.privateIssue.id}/subtasks`, `/cycles/${f.privateCycle.id}`, `/cycles/by-team/${f.privateTeam.id}`,
        `/comments/by-issue/${f.privateIssue.id}`, `/activities/by-issue/${f.privateIssue.id}`,
      ]) equal((await f.request(person, path)).status, 404, `${person} ${path}`);
      equal((await f.request(person, '/issues', 'POST', { title: 'Forbidden', teamId: f.privateTeam.id })).status, 404);
      equal((await f.request(person, `/issues/${f.privateIssue.id}`, 'PATCH', { status: 'done' })).status, 404);
      equal((await f.request(person, `/comments/by-issue/${f.privateIssue.id}`, 'POST', { body: 'Forbidden' })).status, 404);
      equal((await f.request(person, '/cycles', 'POST', { teamId: f.privateTeam.id, startDate: '2026-11-01', endDate: '2026-11-14' })).status, 404);
      equal((await f.request(person, `/teams/${f.privateTeam.id}/join`, 'POST')).status, 404, 'no implicit owner/admin self-join bypass');
    }
    equal((await f.request('lead', `/teams/${f.privateTeam.id}/members`, 'POST', { userId: f.people.admin.id, role: 'viewer' })).status, 201);
    equal((await f.request('admin', `/issues/${f.privateIssue.id}`, 'PATCH', { title: 'Viewer cannot mutate even as admin' })).status, 403, 'team viewer is read-only independent of workspace role');
    equal((await f.request('admin', `/teams/${f.privateTeam.id}`)).status, 200, 'workspace administrators can see private teams only after explicit team admission');
    equal((await f.request('admin', `/teams/${f.privateTeam.id}/members`, 'POST', { userId: f.people.member.id, role: 'member' })).status, 201, 'admitted workspace administrators may manage private membership');
    equal((await f.request('lead', `/issues/${f.privateIssue.id}`)).status, 200);
    equal((await f.request('viewer', `/issues/${f.privateIssue.id}`)).status, 200);
    equal((await f.request('viewer', `/issues/${f.privateIssue.id}`, 'PATCH', { status: 'done' })).status, 403);
    equal((await f.request('viewer', `/comments/by-issue/${f.privateIssue.id}`, 'POST', { body: 'Read only' })).status, 403);
    const memberTeam = await f.request('member', '/teams', 'POST', { name: 'Member-created team', key: 'NEW' });
    equal(memberTeam.status, 201);
    equal((await f.request('member', `/teams/${memberTeam.body.id}`)).status, 200);
    equal((await f.request('member', `/teams/${f.publicTeam.id}`, 'PATCH', { name: 'Admin only' })).status, 403);
    equal((await f.request('member', `/teams/${f.publicTeam.id}/join`, 'POST')).status, 201);
    equal((await f.request('member', '/issues', 'POST', { title: 'Allowed public issue', teamId: f.publicTeam.id, estimate: 0 })).status, 201);
    const created = await f.request('owner', '/teams', 'POST', { name: 'New private', key: 'NP', isPrivate: true });
    equal(created.status, 201);
    equal((await f.request('owner', `/teams/${created.body.id}`)).status, 200, 'creator explicitly enrolled');
    equal((await f.request('admin', `/teams/${created.body.id}`)).status, 404);
  } finally { await f.close(); }
});

test('confirmed legacy guest/client roles stay internal read-only and cannot escalate via team lead', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    for (const person of ['legacyGuest', 'legacyClient']) {
      equal((await f.request(person, `/issues/${f.publicIssue.id}`)).status, 200);
      equal((await f.request(person, '/teams', 'POST', { name: 'Forbidden', key: 'LEG' })).status, 403);
      equal((await f.request(person, `/teams/${f.publicTeam.id}/join`, 'POST')).status, 403);
      equal((await f.request(person, `/issues/${f.publicIssue.id}`, 'PATCH', { title: 'Forbidden' })).status, 403);
      equal((await f.request(person, `/users/${f.people.owner.id}`, 'DELETE')).status, 403, 'global read-only guard also protects remaining write surfaces');
    }
    equal((await f.request('legacyClient', `/issues/${f.privateIssue.id}`)).status, 404);
    equal((await f.request('legacyGuest', `/issues/${f.privateIssue.id}`)).status, 200, 'explicit private membership still permits read');
    equal((await f.request('legacyGuest', `/teams/${f.privateTeam.id}`, 'PATCH', { name: 'Forbidden' })).status, 403);
    equal((await f.request('legacyGuest', `/projects/${f.privateProject.id}`, 'PATCH', { name: 'Forbidden' })).status, 403);
    equal((await f.request('lead', `/teams/${f.privateTeam.id}/members/${f.people.lead.id}`, 'DELETE')).status, 400, 'read-only legacy lead cannot replace the last writable lead');
    const inbox = new NotificationsService({ get db() { return f.postgres.db; } });
    const sent = await inbox.createForEvent(f.people.legacyGuest.id, { type: 'mention', title: 'SECRET_WORK_PRIVATE', body: 'Read-only notification', metadata: { issueId: f.privateIssue.id } });
    ok(sent);
    equal((await f.request('legacyGuest', `/notifications/${sent.id}/read`, 'PATCH', { read: true })).status, 200, 'personal Inbox read state remains usable');
    await f.postgres.reopen();
    equal((await f.request('legacyGuest', `/issues/${f.privateIssue.id}`)).status, 200);
    const rows = await f.postgres.db.select().from(organizationMembers).where(eq(organizationMembers.userId, f.people.legacyGuest.id));
    equal(rows[0].role, 'guest', 'legacy labels are not silently promoted/mapped to member');
  } finally { await f.close(); }
});

test('private eligibility, mentions and stored notification text respect access revocation/restarts', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    equal((await f.request('lead', `/issues/${f.privateIssue.id}`, 'PATCH', { assigneeId: f.people.owner.id })).status, 400);
    equal((await f.request('lead', '/issues', 'POST', { teamId: f.privateTeam.id, title: 'Wrong parent', parentId: f.publicIssue.id })).status, 400);
    equal((await f.request('lead', `/issues/${f.privateIssue.id}`, 'PATCH', { parentId: f.privateIssue.id })).status, 400);
    equal((await f.request('lead', `/comments/by-issue/${f.privateIssue.id}`, 'POST', { body: 'SECRET_WORK_PRIVATE @owner' })).status, 201);
    const ownerInbox = await f.request('owner', '/notifications');
    equal(ownerInbox.status, 200);
    equal(JSON.stringify(ownerInbox.body).includes('SECRET_WORK'), false);

    const inbox = new NotificationsService({ get db() { return f.postgres.db; } });
    const sent = await inbox.createForEvent(f.people.viewer.id, { type: 'mention', title: 'SECRET_WORK_PRIVATE', body: 'SECRET_WORK_PRIVATE', metadata: { issueId: f.privateIssue.id, teamId: f.privateTeam.id } });
    ok(sent);
    equal(await inbox.createForEvent(f.people.admin.id, { type: 'mention', title: 'SECRET_WORK_PRIVATE', body: 'SECRET_WORK_PRIVATE', metadata: { issueId: f.privateIssue.id } }), null);
    equal((await f.request('viewer', '/notifications/unread-count')).body.count, 1);
    await f.postgres.db.delete(teamMembers).where(and(eq(teamMembers.teamId, f.privateTeam.id), eq(teamMembers.userId, f.people.viewer.id)));
    await f.postgres.reopen();
    equal((await f.request('viewer', `/issues/${f.privateIssue.id}`)).status, 404);
    deepEqual((await f.request('viewer', '/notifications')).body, []);
    equal((await f.request('viewer', '/notifications/unread-count')).body.count, 0);
    equal((await f.request('viewer', `/notifications/${sent.id}/read`, 'PATCH', { read: true })).status, 404);
    const stored = await f.postgres.db.select().from(notifications).where(eq(notifications.id, sent.id));
    equal(stored[0].body, 'SECRET_WORK_PRIVATE', 'delivery record remains intact but is not exposed after revoke');
  } finally { await f.close(); }
});
