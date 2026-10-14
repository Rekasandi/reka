const { equal, ok, deepEqual, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, sessions, workspaceInvitations, oauthLoginAttempts, teams, teamMembers, issues, projects, clients, clientContacts } = require('@reka/database');
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
      await postgres.db.insert(sessions).values({ id: tokens[name], userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
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

// Provider contract fixture only; all local HTTP/Nest/database behavior is real.
// No actual GitHub call is allowed. This is not evidence of live OAuth.
function provider(t, accounts) {
  const env = { GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET };
  process.env.GITHUB_CLIENT_ID = 'isolated-oauth-client';
  process.env.GITHUB_CLIENT_SECRET = 'isolated-oauth-secret';
  const calls = [];
  global.fetch = async (input, options = {}) => {
    const url = String(input); calls.push(url);
    if (url === 'https://github.com/login/oauth/access_token') {
      const { code } = JSON.parse(options.body);
      if (!accounts[code]) return new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 400 });
      return new Response(JSON.stringify({ access_token: `isolated:${code}` }), { status: 200 });
    }
    const code = options.headers.Authorization.replace('Bearer isolated:', '');
    const account = accounts[code];
    if (url === 'https://api.github.com/user') return Response.json({ id: account.id, login: account.login, name: account.login, email: account.publicEmail || null, avatar_url: 'https://avatars.githubusercontent.com/u/1' });
    if (url === 'https://api.github.com/user/emails') return Response.json(account.emails);
    throw new Error('Unexpected external provider request');
  };
  t.after(() => {
    global.fetch = nativeFetch;
    for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  });
  return calls;
}
async function start(f, invite) {
  const response = await nativeFetch(`${f.api.url}/api/auth/github${invite ? `?invite=${invite}` : ''}`, { redirect: 'manual' });
  equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  return { state: location.searchParams.get('state'), cookie: response.headers.getSetCookie().find(value => value.startsWith('reka_oauth_state=')).split(';')[0] };
}
async function callback(f, attempt, code, state = attempt.state) {
  return nativeFetch(`${f.api.url}/api/auth/github/callback?code=${code}&state=${state}`, {
    redirect: 'manual', headers: { Cookie: attempt.cookie },
  });
}

test('canonical roles/settings, self-escalation and last-owner protection persist through real HTTP', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    equal((await f.request('owner', '/auth/demo-login', 'POST', { email: 'owner@example.test' })).status, 403);
    equal((await f.request('owner', '/auth/passkey/login-options')).status, 501);
    equal((await f.request('owner', '/auth/passkey/register-options', 'POST', { email: 'owner@example.test' })).status, 501);
    equal((await f.postgres.db.select().from(sessions)).length, 4);
    equal((await f.request('member', '/workspace/invitations', 'POST', { email: 'new@example.test' })).status, 403);
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

test('verified-email invite creates one persistent account/session; cookie/nonce and token replays fail', { timeout: 90000 }, async t => {
  const f = await fixture();
  const calls = provider(t, {
    wrong: { id: 100, login: 'wrong-person', emails: [{ email: 'wrong@example.test', verified: true }] },
    right: { id: 101, login: 'right-person', emails: [{ email: 'new@example.test', verified: true, primary: false }] },
  });
  try {
    const created = await f.request('owner', '/workspace/invitations', 'POST', { email: 'New@example.test', role: 'member' });
    equal(created.status, 201);
    const token = new URL(created.body.url).searchParams.get('invite');
    const rows = await f.postgres.db.select().from(workspaceInvitations);
    equal(rows[0].email, 'new@example.test');
    equal(JSON.stringify(rows).includes(token), false);
    const listing = await f.request('owner', '/workspace/invitations');
    equal(JSON.stringify(listing.body).includes('tokenHash'), false);
    equal(JSON.stringify(listing.body).includes(token), false);
    const wrong = await start(f, token);
    const wrongResponse = await callback(f, wrong, 'wrong');
    ok(wrongResponse.headers.get('location').includes('/login?error='));
    equal((await f.postgres.db.select().from(workspaceInvitations))[0].acceptedAt, null);
    const correct = await start(f, token);
    const beforeBadState = calls.length;
    const mismatch = await callback(f, correct, 'right', 'a'.repeat(64));
    ok(mismatch.headers.get('location').includes('/login?error='));
    equal(calls.length, beforeBadState, 'state mismatch must not contact the provider');
    const accepted = await callback(f, correct, 'right');
    ok(accepted.headers.get('location').includes('/dashboard?auth=success'));
    const sessionCookie = accepted.headers.getSetCookie().find(value => value.startsWith('reka_session=')).split(';')[0];
    const usersAfter = await f.postgres.db.select().from(users).where(eq(users.githubId, '101'));
    equal(usersAfter.length, 1);
    equal(usersAfter[0].email, 'new@example.test');
    await f.postgres.reopen();
    const me = await nativeFetch(`${f.api.url}/api/auth/me`, { headers: { Cookie: sessionCookie } });
    equal(me.status, 200);
    equal((await me.json()).githubId, '101');
    const beforeReplay = calls.length;
    const replay = await callback(f, correct, 'right');
    ok(replay.headers.get('location').includes('/login?error='));
    equal(calls.length, beforeReplay);
    equal((await nativeFetch(`${f.api.url}/api/auth/github?invite=${token}`, { redirect: 'manual' })).status, 401);
    const consumed = await f.postgres.db.select().from(workspaceInvitations);
    ok(consumed[0].acceptedAt);
    equal(consumed[0].acceptedById, usersAfter[0].id);
    equal((await f.postgres.db.select().from(oauthLoginAttempts)).length, 0);
    const csrf = await nativeFetch(`${f.api.url}/api/workspace`, { method: 'PATCH', headers: { Cookie: `reka_session=${f.tokens.owner}`, Origin: 'https://evil.example.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Forged' }) });
    equal(csrf.status, 403);
    const trusted = await nativeFetch(`${f.api.url}/api/workspace`, { method: 'PATCH', headers: { Cookie: `reka_session=${f.tokens.owner}`, Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Trusted company edit' }) });
    equal(trusted.status, 200);
  } finally { await f.close(); }
});

test('expired/revoked invites and unverified/uninvited identities cannot enroll or become initial owner', { timeout: 90000 }, async t => {
  const f = await fixture();
  provider(t, {
    unverified: { id: 200, login: 'unverified', publicEmail: 'owner@example.test', emails: [{ email: 'owner@example.test', verified: false }] },
    uninvited: { id: 201, login: 'uninvited', emails: [{ email: 'uninvited@example.test', verified: true }] },
  });
  try {
    const expired = await f.request('owner', '/workspace/invitations', 'POST', { email: 'expired@example.test' });
    await f.postgres.db.update(workspaceInvitations).set({ expiresAt: new Date(0) }).where(eq(workspaceInvitations.id, expired.body.id));
    equal((await nativeFetch(`${f.api.url}/api/auth/github?invite=${new URL(expired.body.url).searchParams.get('invite')}`, { redirect: 'manual' })).status, 401);
    const revoked = await f.request('admin', '/workspace/invitations', 'POST', { email: 'revoked@example.test' });
    equal((await f.request('admin', `/workspace/invitations/${revoked.body.id}/revoke`, 'POST')).status, 201);
    equal((await nativeFetch(`${f.api.url}/api/auth/github?invite=${new URL(revoked.body.url).searchParams.get('invite')}`, { redirect: 'manual' })).status, 401);
    for (const code of ['unverified', 'uninvited']) {
      const attempt = await start(f);
      const response = await callback(f, attempt, code);
      ok(response.headers.get('location').includes('/login?error='));
    }
    equal((await f.postgres.db.select().from(users)).length, 4);
    equal((await f.postgres.db.select().from(sessions)).length, 4);
    equal((await f.postgres.db.select().from(organizationMembers).where(eq(organizationMembers.role, 'owner'))).length, 1);
  } finally { await f.close(); }
});

test('existing verified legacy identity binds a stable GitHub ID, retaining role across username/email changes', { timeout: 90000 }, async t => {
  const f = await fixture();
  provider(t, {
    first: { id: 300, login: 'old-handle', emails: [{ email: 'guest@example.test', verified: true }] },
    renamed: { id: 300, login: 'new-handle', emails: [{ email: 'new-contact@example.test', verified: true }] },
    impostor: { id: 301, login: 'impostor', emails: [{ email: 'guest@example.test', verified: true }] },
  });
  try {
    const first = await callback(f, await start(f), 'first');
    ok(first.headers.get('location').includes('/dashboard?auth=success'));
    const renamed = await callback(f, await start(f), 'renamed');
    ok(renamed.headers.get('location').includes('/dashboard?auth=success'));
    const impostor = await callback(f, await start(f), 'impostor');
    ok(impostor.headers.get('location').includes('/login?error='));
    const [user] = await f.postgres.db.select().from(users).where(eq(users.id, f.people.guest.id));
    equal(user.githubId, '300'); equal(user.githubUsername, 'new-handle'); equal(user.email, 'guest@example.test');
    const [membership] = await f.postgres.db.select().from(organizationMembers).where(eq(organizationMembers.userId, user.id));
    equal(membership.role, 'guest');
    await rejects(f.postgres.db.update(users).set({ email: 'takeover@example.test' }).where(eq(users.id, user.id)));
    await rejects(f.postgres.db.update(users).set({ githubId: '999' }).where(eq(users.id, user.id)));
  } finally { await f.close(); }
});

test('manual profiles remain inactive until invitation acceptance; role/removal routes are canonical and preserve authored data', { timeout: 90000 }, async t => {
  const f = await fixture();
  provider(t, { pending: { id: 400, login: 'pending-person', emails: [{ email: 'pending@example.test', verified: true }] } });
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
    const uninvited = await callback(f, await start(f), 'pending');
    ok(uninvited.headers.get('location').includes('/login?error='));
    const invite = await f.request('admin', '/workspace/invitations', 'POST', { email: 'pending@example.test' });
    equal(invite.status, 201);
    const accepted = await callback(f, await start(f, new URL(invite.body.url).searchParams.get('invite')), 'pending');
    ok(accepted.headers.get('location').includes('/dashboard?auth=success'));
    const [membership] = await f.postgres.db.select().from(organizationMembers).where(eq(organizationMembers.userId, id));
    equal(membership.admission, 'invited'); equal(membership.isActive, true);
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
