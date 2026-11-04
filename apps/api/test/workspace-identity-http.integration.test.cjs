const { equal, ok, deepEqual, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq, sql } = require('drizzle-orm');
const { organizations, organizationMembers, users, sessions, teams, teamMembers, issues, projects, clients, clientContacts } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { WorkspaceModule } = require('../dist/workspace/workspace.module');
const { AuthModule } = require('../dist/auth/auth.module');
const { UsersModule } = require('../dist/users/users.module');
const { ClientsModule } = require('../dist/clients/clients.module');
const { OrganizationsModule } = require('../dist/organizations/organizations.module');
const nativeFetch = global.fetch;

async function fixture() {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const [org] = await postgres.db.insert(organizations).values({ name: 'Company', slug: 'company' }).returning();
    const people = {}, tokens = {};
    for (const [name, role] of [['owner', 'owner'], ['admin', 'admin'], ['member', 'member'], ['guest', 'guest']]) {
      const [user] = await postgres.db.insert(users).values({ name, email: `${name}@example.test`, role: 'member' }).returning();
      people[name] = user;
      await postgres.db.insert(organizationMembers).values({ organizationId: org.id, userId: user.id, role });
      tokens[name] = randomUUID();
      await postgres.db.insert(sessions).values({ token: tokens[name], userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
    }
    api = await createIsolatedApi(postgres, [WorkspaceModule, AuthModule, UsersModule, ClientsModule, OrganizationsModule]);
    const request = async (who, path, method = 'GET', body) => {
      const response = await nativeFetch(`${api.url}/api${path}`, { method,
        headers: { Authorization: `Bearer ${tokens[who]}`, 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    return { postgres, api, org, people, tokens, request, close: async () => { await api.close(); await postgres.close(); } };
  } catch (error) { if (api) await api.close(); await postgres.close(); throw error; }
}

test('canonical roles/settings, self-escalation and last-owner protection persist through real HTTP', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    equal((await f.postgres.db.select().from(sessions)).length, 4);
    equal((await f.request('member', '/auth/organization/invite-member', 'POST', { email: 'new@example.test', role: 'member' })).status, 403, 'members cannot invite');
    equal((await f.request('member', `/workspace/members/${f.people.member.id}`, 'PATCH', { role: 'owner' })).status, 403);
    equal((await f.request('admin', `/workspace/members/${f.people.owner.id}`, 'PATCH', { role: 'member' })).status, 403);
    equal((await f.request('owner', `/workspace/members/${f.people.owner.id}`, 'PATCH', { isActive: false })).status, 400);
    equal((await f.request('owner', `/workspace/members/${f.people.owner.id}`, 'PATCH', { role: 'member' })).status, 400);
    equal((await f.request('owner', `/workspace/members/${f.people.member.id}`, 'PATCH', { role: 'admin' })).status, 200);
    equal((await f.request('member', '/auth/me')).body.role, 'admin', 'global users.role label is not the authorization source');
    equal((await f.request('owner', '/workspace', 'PATCH', { name: 'Updated company' })).status, 200);
    await f.postgres.reopen();
    equal((await f.request('admin', '/workspace')).body.name, 'Updated company');
    equal((await f.request('member', '/auth/me')).body.role, 'admin');
    equal((await f.request('owner', `/workspace/members/${f.people.member.id}`, 'PATCH', { isActive: false })).status, 200);
    equal((await f.request('member', '/workspace')).status, 403, 'pre-existing sessions cannot bypass deactivation');
    await rejects(f.postgres.db.delete(organizationMembers).where(eq(organizationMembers.userId, f.people.owner.id)));
    equal((await f.request('owner', `/workspace/members/${f.people.admin.id}`, 'PATCH', { role: 'owner' })).status, 200);
    const raced = await Promise.all([
      f.request('owner', `/workspace/members/${f.people.owner.id}`, 'PATCH', { isActive: false }),
      f.request('admin', `/workspace/members/${f.people.admin.id}`, 'PATCH', { isActive: false }),
    ]);
    equal(raced.filter(response => response.status === 200).length, 1);
    const owners = await f.postgres.db.select().from(organizationMembers).where(and(eq(organizationMembers.role, 'owner'), eq(organizationMembers.isActive, true)));
    equal(owners.length, 1);
  } finally { await f.close(); }
});

test('manual profiles stay inactive until the person joins; role/removal routes are canonical and preserve authored data', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    equal((await f.request('member', '/users', 'POST', { name: 'Denied', email: 'denied@example.test' })).status, 403);
    const created = await f.request('admin', '/users', 'POST', { name: 'Pending person', email: 'pending@example.test', role: 'member' });
    equal(created.status, 201); equal(created.body.isActive, false); equal(created.body.admission, 'pending');
    const id = created.body.id;
    equal((await f.request('admin', `/workspace/members/${id}`, 'PATCH', { isActive: true })).status, 400);
    equal((await f.request('owner', `/workspace/members/${id}`, 'PATCH', { role: 'owner' })).status, 400);
    await rejects(f.postgres.db.update(organizationMembers).set({ isActive: true }).where(eq(organizationMembers.userId, id)));
    equal((await f.request('member', '/users')).body.some(user => user.id === id), false);
    equal((await f.request('member', '/users?includeInactive=true')).status, 403);
    equal((await f.request('admin', '/users?includeInactive=true')).body.some(user => user.id === id), true);
    // Activation happens through Better Auth invitation acceptance (covered in auth-flows); simulate the result.
    await f.postgres.db.execute(sql`UPDATE organization_members SET is_active = true, admission = 'invited' WHERE user_id = ${id}::uuid`);
    equal((await f.request('member', `/users/${id}`, 'PATCH', { role: 'owner' })).status, 403);
    equal((await f.request('owner', `/users/${id}`, 'PATCH', { role: 'admin' })).status, 200);
    const [team] = await f.postgres.db.insert(teams).values({ organizationId: f.org.id, name: 'Public', key: 'PUB' }).returning();
    const [issue] = await f.postgres.db.insert(issues).values({ teamId: team.id, number: 1, identifier: 'PUB-1', title: 'Authored work', assigneeId: id, reporterId: id }).returning();
    equal((await f.request('owner', `/users/${id}`, 'DELETE')).status, 200);
    equal((await f.postgres.db.select().from(users).where(eq(users.id, id))).length, 1);
    equal((await f.postgres.db.select().from(issues).where(eq(issues.id, issue.id)))[0].assigneeId, id);
    await f.postgres.reopen();
    equal((await f.request('admin', `/users/${id}`)).body.isActive, false);
  } finally { await f.close(); }
});

test('directory counts, client projects/contacts and organization reads exclude private/other-company records', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const [otherOrg] = await f.postgres.db.insert(organizations).values({ name: 'Other company', slug: 'other-company' }).returning();
    const [otherUser] = await f.postgres.db.insert(users).values({ name: 'Other employee', email: 'other-employee@example.test' }).returning();
    await f.postgres.db.insert(organizationMembers).values({ organizationId: otherOrg.id, userId: otherUser.id });
    const [publicTeam, privateTeam] = await f.postgres.db.insert(teams).values([
      { organizationId: f.org.id, name: 'Public team', key: 'PUB' },
      { organizationId: f.org.id, name: 'Private team', key: 'PRI', isPrivate: true },
    ]).returning();
    await f.postgres.db.insert(teamMembers).values([{ teamId: publicTeam.id, userId: f.people.member.id }, { teamId: privateTeam.id, userId: f.people.member.id, role: 'lead' }]);
    await f.postgres.db.insert(issues).values([
      { teamId: publicTeam.id, title: 'Public issue', identifier: 'PUB-1', number: 1, assigneeId: f.people.member.id, reporterId: f.people.member.id },
      { teamId: privateTeam.id, title: 'Private issue', identifier: 'PRI-1', number: 1, assigneeId: f.people.member.id, reporterId: f.people.member.id },
    ]);
    const [client, otherClient] = await f.postgres.db.insert(clients).values([
      { organizationId: f.org.id, name: 'Company client' }, { organizationId: otherOrg.id, name: 'Other client' },
    ]).returning();
    const [otherContact] = await f.postgres.db.insert(clientContacts).values({ clientId: otherClient.id, name: 'Other contact', email: 'contact@example.test' }).returning();
    await f.postgres.db.insert(projects).values([
      { organizationId: f.org.id, teamId: publicTeam.id, name: 'Public project', slug: 'public-project', ownerId: f.people.member.id, clientId: client.id },
      { organizationId: f.org.id, teamId: privateTeam.id, name: 'Private project', slug: 'private-project', ownerId: f.people.member.id, clientId: client.id },
    ]);
    const ownerDirectory = (await f.request('owner', '/users')).body;
    equal(ownerDirectory.some(user => user.id === otherUser.id), false);
    const publicStats = ownerDirectory.find(user => user.id === f.people.member.id);
    equal(publicStats.assignedIssuesCount, 1); equal(publicStats.teamsCount, 1);
    const privateStats = (await f.request('member', `/users/${f.people.member.id}`)).body;
    equal(privateStats.assignedIssuesCount, 2); equal(privateStats.teamsCount, 2);
    equal((await f.request('admin', `/users/${otherUser.id}`)).status, 404);
    equal((await f.request('owner', `/users/${otherUser.id}`, 'DELETE')).status, 404);
    const visibleClients = (await f.request('owner', '/clients')).body;
    equal(visibleClients.length, 1); equal(visibleClients[0].projectCount, 1);
    equal(JSON.stringify(visibleClients).includes('Private project'), false);
    equal((await f.request('member', `/clients/${client.id}`)).body.projectCount, 2);
    equal((await f.request('owner', `/clients/${otherClient.id}`)).status, 404);
    equal((await f.request('owner', `/clients/contacts/${otherContact.id}`, 'DELETE')).status, 404);
    equal((await f.request('owner', `/clients/${otherClient.id}/contacts`, 'POST', { name: 'Denied', email: 'denied@example.test' })).status, 404);
    equal((await f.request('guest', '/clients', 'POST', { name: 'Denied' })).status, 403);
    equal((await f.request('member', '/clients', 'POST', { name: 'Denied company', organizationId: otherOrg.id })).status, 400);
    equal((await f.request('owner', '/clients', 'POST', { name: 'Invalid contact', contact: { name: 'Person', email: 'not-an-email' } })).status, 400);
    equal((await f.request('owner', '/clients')).body.length, 1);
    const created = await f.request('member', '/clients', 'POST', { name: 'Created client', contact: { name: 'Person', email: 'person@example.test' } });
    equal(created.status, 201); equal(created.body.contactCount, 1);
    equal((await f.request('owner', '/organizations')).body.length, 1);
    equal((await f.request('owner', `/organizations/${otherOrg.id}`)).status, 404);
    await f.postgres.reopen();
    equal((await f.request('owner', `/clients/${created.body.id}`)).body.contacts[0].email, 'person@example.test');
  } finally { await f.close(); }
});
