const { equal } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { issueLabels, issues, organizationMembers, organizations, sessions, teamMembers, teams, users } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');
const { LabelsModule } = require('../dist/labels/labels.module');

test('label rename/delete APIs enforce team-manager access and preserve issue records', { timeout: 60_000 }, async () => {
  const postgres = await createPersistentPostgres(); let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Labels company', slug: `labels-${suffix}` }).returning();
    const [owner, member, admin] = await postgres.db.insert(users).values([
      { name: 'Label lead', email: `label-lead-${suffix}@example.test`, role: 'owner' },
      { name: 'Label member', email: `label-member-${suffix}@example.test`, role: 'member' },
      { name: 'Label admin', email: `label-admin-${suffix}@example.test`, role: 'admin' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: member.id, role: 'member' },
      { organizationId: org.id, userId: admin.id, role: 'admin' },
    ]);
    const [team, privateTeam] = await postgres.db.insert(teams).values([
      { organizationId: org.id, name: 'Public labels', key: `LBL${suffix.slice(0, 4).toUpperCase()}` },
      { organizationId: org.id, name: 'Private labels', key: `PVL${suffix.slice(0, 4).toUpperCase()}`, isPrivate: true },
    ]).returning();
    await postgres.db.insert(teamMembers).values([
      { teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: team.id, userId: member.id, role: 'member' },
      { teamId: privateTeam.id, userId: owner.id, role: 'lead' },
    ]);
    const tokens = new Map();
    for (const user of [owner, member, admin]) {
      const token = randomUUID(); tokens.set(user.id, token);
      await postgres.db.insert(sessions).values({ id: token, userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) });
    }
    api = await createIsolatedApi(postgres, [LabelsModule]);
    const request = (user, path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { authorization: `Bearer ${tokens.get(user.id)}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const createdResponse = await request(owner, '/labels', 'POST', { name: 'Needs followup', teamId: team.id, color: '#336699' });
    equal(createdResponse.status, 201); const label = await createdResponse.json();
    equal((await request(owner, '/labels', 'POST', { name: '  ', teamId: team.id })).status, 400);
    equal((await request(member, `/labels/${label.id}`, 'PATCH', { name: 'Member rename' })).status, 403);
    equal((await request(member, `/labels/${label.id}`, 'DELETE')).status, 403);
    equal((await request(admin, `/labels/${label.id}`, 'PATCH', { color: 'red' })).status, 400);
    const [issue] = await postgres.db.insert(issues).values({
      identifier: `${team.key}-1`, number: 1, title: 'Label lifecycle must not delete the issue', teamId: team.id, reporterId: owner.id,
    }).returning();
    await postgres.db.insert(issueLabels).values({ issueId: issue.id, labelId: label.id });
    const updatedResponse = await request(owner, `/labels/${label.id}`, 'PATCH', { name: 'Ready for followup', color: '#aa22cc' });
    equal(updatedResponse.status, 200); const updated = await updatedResponse.json();
    equal(updated.name, 'Ready for followup'); equal(updated.color, '#aa22cc');
    const listed = await (await request(member, '/labels')).json(); equal(listed.some(item => item.id === label.id && item.name === 'Ready for followup'), true);
    const privateLabelResponse = await request(owner, '/labels', 'POST', { name: 'Secret', teamId: privateTeam.id });
    equal(privateLabelResponse.status, 201); const privateLabel = await privateLabelResponse.json();
    equal((await request(member, `/labels/${privateLabel.id}`, 'PATCH', { name: 'Leaked' })).status, 404);
    equal((await request(admin, `/labels/${privateLabel.id}`, 'DELETE')).status, 404, 'workspace admin is not a private-team visibility bypass');
    const memberLabels = await (await request(member, '/labels')).json();
    equal(memberLabels.some(item => item.id === privateLabel.id), false);
    const deletedResponse = await request(owner, `/labels/${label.id}`, 'DELETE'); equal(deletedResponse.status, 200);
    equal((await postgres.db.select().from(issueLabels).where(eq(issueLabels.labelId, label.id))).length, 0, 'label deletion cascades only its issue-label assignments');
    equal((await postgres.db.select().from(issues).where(eq(issues.id, issue.id))).length, 1, 'label deletion preserves issues');
    equal((await request(owner, `/labels/${label.id}`, 'DELETE')).status, 404);
  } finally { if (api) await api.close(); await postgres.close(); }
});
