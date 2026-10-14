const { test } = require('node:test');
const { equal, ok } = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { sessions, teamMembers, users, organizationMembers } = require('@reka/database');
const { createServiceFixture } = require('./support/service-fixture.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { TeamsModule } = require('../dist/teams/teams.module');
const { WorkspaceModule } = require('../dist/workspace/workspace.module');

test('real private creation/settings, role handoff, public join and last-lead membership/workspace guards', { timeout: 90000 }, async () => {
  const f = await createServiceFixture(); let api;
  try {
    api = await createIsolatedApi(f.postgres, [TeamsModule, WorkspaceModule]);
    const people = { owner: f.actor, lead: f.assignee, viewer: f.reporter, peer: f.mentioned };
    const tokens = {};
    for (const [key, person] of Object.entries(people)) {
      tokens[key] = randomUUID();
      await f.db.insert(sessions).values({ id: tokens[key], userId: person.id, expiresAt: new Date(Date.now() + 86400000) });
    }
    async function request(who, path, method = 'GET', data) {
      const response = await fetch(`${api.url}/api${path}`, { method, headers: { Authorization: `Bearer ${tokens[who]}`, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
      return { status: response.status, body: await response.json() };
    }
    const created = await request('lead', '/teams', 'POST', { name: 'Private delivery', key: 'PRI', isPrivate: true });
    equal(created.status, 201); equal(created.body.isPrivate, true); equal(created.body.currentMemberRole, 'lead'); equal(created.body.canManage, true); equal(created.body.canDelete, false);
    const id = created.body.id;
    equal((await f.db.select().from(teamMembers).where(eq(teamMembers.teamId, id))).length, 1);
    equal((await request('owner', `/teams/${id}`)).status, 404);
    equal((await request('owner', `/teams/${id}/join`, 'POST')).status, 404);
    equal((await request('owner', `/teams/${id}/members`, 'POST', { userId: f.actor.id, role: 'lead' })).status, 404);
    equal((await request('lead', `/teams/${id}/members/${f.assignee.id}`, 'DELETE')).status, 400);
    equal((await request('lead', `/teams/${id}/members/${f.assignee.id}`, 'PATCH', { role: 'viewer' })).status, 400);
    const deactivate = await request('owner', `/workspace/members/${f.assignee.id}`, 'PATCH', { isActive: false });
    equal(deactivate.status, 400); equal(JSON.stringify(deactivate.body).includes('Private delivery'), false);
    equal((await request('owner', `/workspace/members/${f.assignee.id}`, 'PATCH', { role: 'guest' })).status, 400);
    equal((await request('lead', `/teams/${id}/members`, 'POST', { userId: f.reporter.id, role: 'viewer' })).status, 201);
    const view = await request('viewer', `/teams/${id}`);
    equal(view.status, 200); equal(view.body.canManage, false); equal(view.body.currentMemberRole, 'viewer');
    equal((await request('viewer', `/teams/${id}`, 'PATCH', { name: 'Denied' })).status, 403);
    equal((await request('viewer', `/teams/${id}/members/${f.assignee.id}`, 'PATCH', { role: 'viewer' })).status, 403);
    equal((await request('lead', `/teams/${id}/members/${f.reporter.id}`, 'PATCH', { role: 'lead' })).status, 200);
    equal((await request('owner', `/workspace/members/${f.assignee.id}`, 'PATCH', { isActive: false })).status, 200);
    equal((await request('lead', `/teams/${id}`)).status, 403);
    equal((await request('viewer', `/teams/${id}/members/${f.assignee.id}`, 'DELETE')).status, 200);
    equal((await request('viewer', `/teams/${id}/members/${f.reporter.id}`, 'PATCH', { role: 'member' })).status, 400);
    const [readonly] = await f.db.insert(users).values({ name: 'Internal reader', email: 'reader@example.test', role: 'client' }).returning();
    await f.db.insert(organizationMembers).values({ organizationId: f.org.id, userId: readonly.id, role: 'client' });
    equal((await request('viewer', `/teams/${id}/members`, 'POST', { userId: readonly.id, role: 'lead' })).status, 400);
    equal((await request('viewer', `/teams/${id}/members`, 'POST', { userId: readonly.id, role: 'viewer' })).status, 201);
    const publicCreated = await request('peer', '/teams', 'POST', { name: 'Public delivery', key: 'PUB' });
    equal(publicCreated.status, 201);
    const publicId = publicCreated.body.id;
    equal((await request('owner', `/teams/${publicId}/join`, 'POST')).status, 201);
    const madePrivate = await request('owner', `/teams/${publicId}`, 'PATCH', { isPrivate: true, description: 'Persisted private settings' });
    equal(madePrivate.status, 200); equal(madePrivate.body.currentMemberRole, 'lead'); equal(madePrivate.body.isPrivate, true);
    equal((await request('viewer', `/teams/${publicId}`)).status, 404);
    await f.postgres.reopen();
    const persisted = await request('owner', `/teams/${publicId}`);
    equal(persisted.body.description, 'Persisted private settings'); equal(persisted.body.isPrivate, true);
    equal((await request('owner', `/teams/${publicId}`, 'DELETE')).status, 200, 'Team cascade must not falsely protect a deleted team lead');
    ok((await request('owner', '/teams')).body.every(team => team.id !== id));
  } finally { if (api) await api.close(); await f.close(); }
});
