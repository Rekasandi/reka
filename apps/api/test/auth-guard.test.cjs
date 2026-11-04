const { equal, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { AuthGuard } = require('../dist/auth/auth.guard');

function context(path, request = {}) {
  return { switchToHttp: () => ({ getRequest: () => ({ path, cookies: {}, headers: {}, ...request }) }) };
}

test('auth/me requires a valid session while GitHub OAuth entry points stay public', async () => {
  const guard = new AuthGuard({});
  await rejects(guard.canActivate(context('/api/auth/me')), (error) => error.getStatus() === 401);
  equal(await guard.canActivate(context('/api/auth/github')), true);
  equal(await guard.canActivate(context('/api/auth/github/callback')), true);
});

// Session/actor caching in Redis must never outlive a logout or a deactivation, and must be optional.
test('auth cache: reuse while valid, deactivation is immediate, logout clears, and works without Redis', async () => {
  const { randomUUID } = require('node:crypto');
  const { eq } = require('drizzle-orm');
  const { organizations, organizationMembers, users, sessions } = require('@reka/database');
  const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
  const { AuthService } = require('../dist/auth/auth.service');
  const { WorkspaceService } = require('../dist/workspace/workspace.service');
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db; const marker = randomUUID().slice(0, 8);
    const [org] = await db.insert(organizations).values({ name: 'Cache', slug: `cache-${marker}` }).returning();
    const [owner, member] = await db.insert(users).values([{ name: 'Owner', email: `o-${marker}@example.test` }, { name: 'Member', email: `m-${marker}@example.test` }]).returning();
    await db.insert(organizationMembers).values([{ organizationId: org.id, userId: owner.id, role: 'owner' }, { organizationId: org.id, userId: member.id, role: 'member' }]);
    const token = randomUUID();
    await db.insert(sessions).values({ id: token, userId: member.id, expiresAt: new Date(Date.now() + 3_600_000) });
    const store = new Map();
    const redis = { getSafe: async (k) => store.get(k) ?? null, setSafe: async (k, v) => { store.set(k, v); }, delSafe: async (k) => { store.delete(k); } };
    const database = { db };
    const guard = new AuthGuard(database, redis);
    const request = () => context('/api/teams', { method: 'GET', headers: { authorization: `Bearer ${token}` } });

    equal(await guard.canActivate(request()), true);
    equal(store.has(`session:${token}`) && store.has(`workspace_actor:${member.id}`), true, 'session and actor are cached');
    await db.delete(sessions).where(eq(sessions.id, token)); // cached session still answers within its TTL
    equal(await guard.canActivate(request()), true);
    await db.insert(sessions).values({ id: token, userId: member.id, expiresAt: new Date(Date.now() + 3_600_000) });

    await new WorkspaceService(database, undefined, redis).updateMember(owner.id, member.id, { isActive: false });
    await rejects(guard.canActivate(request()), (error) => error.getStatus() === 403, 'deactivation applies at once despite the cached session');

    await new AuthService(database, new WorkspaceService(database), redis).logout(token);
    equal(store.has(`session:${token}`), false, 'logout drops the cached session');
    await rejects(guard.canActivate(request()), (error) => error.getStatus() === 401);

    const ownerToken = randomUUID();
    await db.insert(sessions).values({ id: ownerToken, userId: owner.id, expiresAt: new Date(Date.now() + 3_600_000) });
    equal(await new AuthGuard(database).canActivate(context('/api/teams', { method: 'GET', headers: { authorization: `Bearer ${ownerToken}` } })), true, 'works without Redis');
  } finally { await postgres.close(); }
});
