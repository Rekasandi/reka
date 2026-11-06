// Better Auth through real Nest HTTP + isolated Postgres: email/password with verification, magic links,
// GitHub (provider contract fixture, never live), bearer sessions, and Linear-style multi-workspace onboarding.
const { equal, ok, deepEqual, match } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { users, accounts, organizations, organizationMembers, sessions, workspaceInvitations } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { MailModule } = require('../dist/mail/mail.module');
const { MailService } = require('../dist/mail/mail.service');
const { TeamsModule } = require('../dist/teams/teams.module');
const { WorkspaceModule } = require('../dist/workspace/workspace.module');
const nativeFetch = global.fetch;

const WEB = 'http://localhost:5173';
async function fixture() {
  const postgres = await createPersistentPostgres();
  const mail = { sent: [], isConfigured: () => true, async send(to, content) { mail.sent.push({ to, content }); return { sent: true }; } };
  const api = await createIsolatedApi(postgres, [MailModule, TeamsModule, WorkspaceModule], [[MailService, mail]]);
  const jar = new Map(); // one cookie jar per "browser"
  const call = async (path, { method = 'GET', body, bearer, browser = 'default', headers = {} } = {}) => {
    const cookie = [...(jar.get(browser) ?? new Map()).entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await nativeFetch(`${api.url}/api${path}`, { method, redirect: 'manual', headers: {
      'Content-Type': 'application/json', Origin: WEB, ...(cookie ? { Cookie: cookie } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...headers,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const store = jar.get(browser) ?? new Map(); jar.set(browser, store);
    for (const raw of response.headers.getSetCookie()) { const [pair, ...attrs] = raw.split(';'); const [name, value] = pair.split('='); if (attrs.some((a) => /max-age=0/i.test(a)) || !value) store.delete(name); else store.set(name, value); }
    const text = await response.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: response.status, body: json, headers: response.headers };
  };
  const lastLink = () => { const text = mail.sent.at(-1).content.text; return text.match(/https?:\/\/\S+/g).find((u) => u.includes('token=') || u.includes('accept-invitation')); };
  const follow = async (url, browser) => { const target = new URL(url); return call(target.pathname.replace(/^\/api/, '') + target.search, { browser }); };
  return { postgres, api, mail, call, lastLink, follow, close: async () => { await api.close(); await postgres.close(); } };
}

test('email/password sign-up needs a verified email, then a first workspace, before the API opens up', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const email = `ada-${randomUUID().slice(0, 6)}@example.test`;
    const signUp = await f.call('/auth/sign-up/email', { method: 'POST', body: { email, password: 'correct-horse-battery', name: 'Ada' } });
    equal(signUp.status, 200, JSON.stringify(signUp.body));
    equal((await f.call('/auth/me')).status, 401, 'no session until the email is verified');
    const blocked = await f.call('/auth/sign-in/email', { method: 'POST', body: { email, password: 'correct-horse-battery' } });
    equal(blocked.status, 403, 'unverified accounts cannot sign in');
    match(f.mail.sent.at(-1).content.subject, /Verify your email/);
    const verified = await f.follow(f.lastLink());
    ok([200, 302].includes(verified.status), `verification link accepted (${verified.status})`);
    const me = await f.call('/auth/me');
    equal(me.body.email, email); equal(me.body.workspace, null, 'fresh accounts have no workspace yet');
    equal((await f.call('/teams')).status, 403, 'workspace routes wait for a workspace');

    const created = await f.call('/auth/organization/create', { method: 'POST', body: { name: 'Ada Labs', slug: 'ada-labs' } });
    equal(created.status, 200, JSON.stringify(created.body));
    const after = await f.call('/auth/me');
    equal(after.body.workspace.slug, 'ada-labs'); equal(after.body.role, 'owner');
    equal((await f.call('/teams')).status, 200, 'the new workspace is active');
    const [membership] = await f.postgres.db.select().from(organizationMembers);
    deepEqual([membership.role, membership.isActive], ['owner', true]);
    equal((await f.call('/auth/sign-out', { method: 'POST', body: {} })).status, 200);
    equal((await f.call('/auth/me')).status, 401, 'signed out');
    const signIn = await f.call('/auth/sign-in/email', { method: 'POST', body: { email, password: 'correct-horse-battery' } });
    equal(signIn.status, 200); equal((await f.call('/auth/me')).body.workspace.slug, 'ada-labs', 'signing in lands in the workspace');
  } finally { await f.close(); }
});

test('magic link signs up and signs in without a password; invitations join the inviter workspace', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const owner = `owner-${randomUUID().slice(0, 6)}@example.test`;
    const ipv6Res = await f.call('/auth/sign-in/magic-link', { method: 'POST', body: { email: owner, name: 'Owner' }, headers: { Origin: 'http://[::1]:5173' } });
    equal(ipv6Res.status, 200, 'magic link sign-in accepts IPv6 loopback origin');
    match(f.lastLink(), /^http:\/\/\[::1\]:5173\//, 'magic link retains IPv6 loopback origin');
    match(f.mail.sent.at(-1).content.subject, /sign-in link/);
    await f.follow(f.lastLink());
    equal((await f.call('/auth/me')).body.email, owner, 'magic link created and signed in the account');
    equal((await f.call('/auth/organization/create', { method: 'POST', body: { name: 'Owner Co', slug: 'owner-co' } })).status, 200);

    const invitee = `new-${randomUUID().slice(0, 6)}@example.test`;
    const invited = await f.call('/auth/organization/invite-member', { method: 'POST', body: { email: invitee, role: 'member' } });
    equal(invited.status, 200, JSON.stringify(invited.body));
    const inviteLink = f.lastLink();
    match(inviteLink, /\/accept-invitation\//);
    const [row] = await f.postgres.db.select().from(workspaceInvitations);
    deepEqual([row.email, row.role, row.status], [invitee, 'member', 'pending']);

    // The invitee signs in on another browser (magic link), then accepts.
    equal((await f.call('/auth/sign-in/magic-link', { method: 'POST', body: { email: invitee, name: 'Newbie' }, browser: 'invitee' })).status, 200);
    await f.follow(f.lastLink(), 'invitee');
    equal((await f.call('/auth/me', { browser: 'invitee' })).body.workspace, null);
    const accepted = await f.call('/auth/organization/accept-invitation', { method: 'POST', body: { invitationId: row.id }, browser: 'invitee' });
    equal(accepted.status, 200, JSON.stringify(accepted.body));
    const me = await f.call('/auth/me', { browser: 'invitee' });
    deepEqual([me.body.workspace.slug, me.body.role], ['owner-co', 'member']);
    equal((await f.call('/teams', { browser: 'invitee' })).status, 200);
    equal((await f.postgres.db.select().from(workspaceInvitations))[0].status, 'accepted');

    // Someone else cannot accept an invitation addressed to another email.
    const other = `other-${randomUUID().slice(0, 6)}@example.test`;
    equal((await f.call('/auth/sign-in/magic-link', { method: 'POST', body: { email: other, name: 'Other' }, browser: 'other' })).status, 200);
    await f.follow(f.lastLink(), 'other');
    equal((await f.call('/auth/organization/invite-member', { method: 'POST', body: { email: other, role: 'member' } })).status, 200);
    const [, second] = await f.postgres.db.select().from(workspaceInvitations);
    const wrong = await f.call('/auth/organization/accept-invitation', { method: 'POST', body: { invitationId: second.id }, browser: 'invitee' });
    ok(wrong.status >= 400, 'invitation is bound to its email');
  } finally { await f.close(); }
});

test('one account, several workspaces: list, switch, and data stays scoped to the active one', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const email = `multi-${randomUUID().slice(0, 6)}@example.test`;
    equal((await f.call('/auth/sign-in/magic-link', { method: 'POST', body: { email, name: 'Multi' } })).status, 200);
    await f.follow(f.lastLink());
    for (const slug of ['alpha', 'beta']) equal((await f.call('/auth/organization/create', { method: 'POST', body: { name: slug.toUpperCase(), slug } })).status, 200);
    const list = await f.call('/auth/organization/list');
    deepEqual(list.body.map((o) => o.slug).sort(), ['alpha', 'beta']);
    equal((await f.call('/auth/me')).body.workspace.slug, 'beta', 'the latest created workspace is active');
    equal((await f.call('/teams', { method: 'POST', body: { name: 'Beta team', key: 'BT' } })).status, 201);
    const [alpha] = list.body.filter((o) => o.slug === 'alpha');
    equal((await f.call('/auth/organization/set-active', { method: 'POST', body: { organizationId: alpha.id } })).status, 200);
    equal((await f.call('/auth/me')).body.workspace.slug, 'alpha');
    equal((await f.call('/teams')).body.length, 0, 'alpha sees no beta teams');
    equal((await f.call('/auth/organization/set-active', { method: 'POST', body: { organizationId: list.body.find((o) => o.slug === 'beta').id } })).status, 200);
    equal((await f.call('/teams')).body.length, 1);
    // Sessions from the database (test fixtures, API clients) work as bearer tokens and adopt a sole workspace.
    const [user] = await f.postgres.db.select().from(users).where(eq(users.email, email));
    const token = randomUUID();
    await f.postgres.db.insert(sessions).values({ token, userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
    equal((await f.call('/teams', { bearer: token, browser: 'api' })).status, 403, 'two workspaces: a session must pick one');
    await f.postgres.db.update(sessions).set({ activeOrganizationId: alpha.id }).where(eq(sessions.token, token));
    equal((await f.call('/auth/me', { bearer: token, browser: 'api' })).body.workspace.slug, 'alpha');
  } finally { await f.close(); }
});

test('GitHub sign-in links by verified email, stores the OAuth token, and keeps the GitHub identity', { timeout: 90000 }, async (t) => {
  const f = await fixture();
  const previous = { GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET };
  process.env.GITHUB_CLIENT_ID = 'isolated-client'; process.env.GITHUB_CLIENT_SECRET = 'isolated-secret';
  t.after(() => { global.fetch = nativeFetch; for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  // Provider contract fixture: token exchange + profile + emails. Nothing reaches github.com.
  global.fetch = async (input, options = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith('https://github.com/login/oauth/access_token')) return Response.json({ access_token: 'gho_isolated_token', token_type: 'bearer', scope: 'read:user,user:email,repo' });
    if (url.startsWith('https://api.github.com/user/emails')) return Response.json([{ email: 'ghost@example.test', primary: true, verified: true }]);
    if (url.startsWith('https://api.github.com/user')) return Response.json({ id: 424242, login: 'ghost-dev', name: 'Ghost Dev', email: null, avatar_url: 'https://avatars.githubusercontent.com/u/424242' });
    return nativeFetch(input, options);
  };
  try {
    // A separate fixture so the API boots with GitHub configured.
    await f.close();
    const g = await fixture();
    try {
      const [existing] = await g.postgres.db.insert(users).values({ email: 'ghost@example.test', name: 'Existing Ghost', emailVerified: true }).returning();
      const start = await g.call('/auth/sign-in/social', { method: 'POST', body: { provider: 'github', callbackURL: `${WEB}/dashboard` } });
      equal(start.status, 200, JSON.stringify(start.body));
      const authorize = new URL(start.body.url);
      equal(authorize.origin + authorize.pathname, 'https://github.com/login/oauth/authorize');
      ok(authorize.searchParams.get('scope').includes('repo'));
      const callback = await g.call(`/auth/callback/github?code=isolated-code&state=${authorize.searchParams.get('state')}`);
      equal(callback.status, 302, JSON.stringify(callback.body));
      const me = await g.call('/auth/me');
      deepEqual([me.body.id, me.body.githubUsername, me.body.githubId], [existing.id, 'ghost-dev', '424242'], 'linked to the existing account by verified email');
      const [account] = await g.postgres.db.select().from(accounts).where(eq(accounts.userId, existing.id));
      deepEqual([account.providerId, account.accountId, account.accessToken], ['github', '424242', 'gho_isolated_token']);
      equal((await g.postgres.db.select().from(users)).length, 1, 'no duplicate user');
    } finally { await g.close(); }
  } finally { /* closed above */ }
});

test('account self-service: change password and email, edit the workspace, then delete workspace and account', { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const id = randomUUID().slice(0, 6);
    const email = `zed-${id}@example.test`;
    equal((await f.call('/auth/sign-up/email', { method: 'POST', body: { email, password: 'correct-horse-battery', name: 'Zed' } })).status, 200);
    await f.follow(f.lastLink());
    equal((await f.call('/auth/organization/create', { method: 'POST', body: { name: 'Zed Co', slug: 'zed-co' } })).status, 200);

    const changed = await f.call('/auth/change-password', { method: 'POST', body: { currentPassword: 'correct-horse-battery', newPassword: 'another-strong-pass', revokeOtherSessions: false } });
    equal(changed.status, 200, JSON.stringify(changed.body));

    const newEmail = `zed-new-${id}@example.test`;
    const changeEmail = await f.call('/auth/change-email', { method: 'POST', body: { newEmail, callbackURL: `${WEB}/settings/profile` } });
    equal(changeEmail.status, 200, JSON.stringify(changeEmail.body));
    equal(f.mail.sent.at(-1).to, email, 'the current address confirms the change');
    match(f.mail.sent.at(-1).content.subject, /Confirm your new email/);
    const confirmed = await f.follow(f.lastLink());
    ok([200, 302].includes(confirmed.status), `confirmation link accepted (${confirmed.status})`);
    if (f.mail.sent.at(-1)?.to === newEmail) {
      const verified = await f.follow(f.lastLink());
      ok([200, 302].includes(verified.status), `new email verification accepted (${verified.status})`);
    }
    equal((await f.call('/auth/me')).body.email, newEmail);

    const updated = await f.call('/auth/organization/update', { method: 'POST', body: { data: { name: 'Zed Labs', slug: 'zed-labs', logo: 'https://example.test/logo.png' } } });
    equal(updated.status, 200, JSON.stringify(updated.body));
    const me = await f.call('/auth/me');
    deepEqual([me.body.workspace.name, me.body.workspace.slug, me.body.workspace.logoUrl], ['Zed Labs', 'zed-labs', 'https://example.test/logo.png']);

    const orgId = me.body.workspace.id;
    equal((await f.call('/auth/organization/leave', { method: 'POST', body: { organizationId: orgId } })).status, 400, 'the last owner cannot leave');
    const blocked = await f.call('/auth/account', { method: 'DELETE' });
    equal(blocked.status, 400); match(blocked.body.message, /Transfer ownership/);

    equal((await f.call('/auth/organization/delete', { method: 'POST', body: { organizationId: orgId } })).status, 200);
    equal((await f.call('/auth/me')).body.workspace, null);
    equal((await f.postgres.db.select().from(organizations)).length, 0);
    equal((await f.call('/auth/account', { method: 'DELETE' })).status, 200);
    equal((await f.call('/auth/me')).status, 401, 'every session is gone');
    const [row] = await f.postgres.db.select().from(users);
    equal(row.name, 'Deleted user'); ok(!row.email.includes('zed'), 'email anonymised'); equal(row.githubId, null);
    equal((await f.postgres.db.select().from(accounts)).length, 0, 'no sign-in method left');
    equal((await f.call('/auth/sign-in/email', { method: 'POST', body: { email: newEmail, password: 'another-strong-pass' } })).status, 401);
  } finally { await f.close(); }
});
