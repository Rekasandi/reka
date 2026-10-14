// Actual HTTP -> Nest controller/guard/DTO -> Postgres. No live OAuth or .env.
const { equal, deepEqual, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq, asc } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, issueHistory } = require('@reka/database');
const { IssuesModule } = require('../dist/issues/issues.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

test('real issue HTTP requests validate input and persist state/history across database restarts', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const [org] = await postgres.db.insert(organizations).values({ name: 'Internal company', slug: 'company' }).returning();
    const [owner] = await postgres.db.insert(users).values({ name: 'Owner', email: 'owner@example.test', role: 'owner' }).returning();
    await postgres.db.insert(organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
    const [team] = await postgres.db.insert(teams).values({ name: 'Engineering', key: 'ENG', organizationId: org.id }).returning();
    await postgres.db.insert(teamMembers).values({ teamId: team.id, userId: owner.id, role: 'lead' });
    const token = randomUUID();
    await postgres.db.insert(sessions).values({ id: token, userId: owner.id, expiresAt: new Date(Date.now() + 86400000) });
    api = await createIsolatedApi(postgres, [IssuesModule]);
    const request = (path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    equal((await fetch(`${api.url}/api/issues`)).status, 401);
    equal((await request('/issues', 'POST', { title: 'Invalid', teamId: team.id, notAllowed: true })).status, 400);
    const createdResponse = await request('/issues', 'POST', { title: 'Real HTTP issue', teamId: team.id, status: 'todo', estimate: 3 });
    equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    equal(created.reporterId, owner.id);
    equal(created.identifier, 'ENG-1');
    const updatedResponse = await request(`/issues/${created.id}`, 'PATCH', { status: 'in_progress' });
    equal(updatedResponse.status, 200);
    equal((await updatedResponse.json()).status, 'in_progress');
    await postgres.reopen();
    const reloadedResponse = await request(`/issues/${created.id}`);
    equal(reloadedResponse.status, 200);
    equal((await reloadedResponse.json()).status, 'in_progress');
    const rows = await postgres.db.select().from(issueHistory).where(eq(issueHistory.issueId, created.id)).orderBy(asc(issueHistory.id));
    deepEqual(rows.map(row => row.event), ['created', 'updated']);
    equal(rows[0].afterState.status, 'todo');
    equal(rows[1].beforeState.status, 'todo');
    equal(rows[1].afterState.status, 'in_progress');
    ok(rows[1].recordedAt >= rows[0].recordedAt);
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});
