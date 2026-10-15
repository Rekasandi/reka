const { test } = require('node:test');
const { deepEqual, equal, rejects } = require('node:assert/strict');
const { eq } = require('drizzle-orm');
const { labels, issueLabels, teams, teamWorkflowStates } = require('@reka/database');
const { createServiceFixture } = require('./support/service-fixture.cjs');

test('direct issue detail has the same labels and workflow as the list without weakening private-team access', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    const [label] = await f.db.insert(labels).values({ organizationId: f.org.id, teamId: f.team.id, name: 'Review', color: '#6b7280' }).returning();
    await f.db.insert(issueLabels).values({ issueId: f.issue.id, labelId: label.id });
    await f.db.insert(teamWorkflowStates).values({ teamId: f.team.id, key: 'todo', name: 'Ready for work', category: 'unstarted', color: '#6b7280', position: 2 });
    const [listed] = await f.issues.findAll(f.actor.id);
    const direct = await f.issues.findById(f.issue.id, f.actor.id);
    deepEqual(direct, listed);
    deepEqual(await f.issues.findByIdentifier(f.issue.identifier, f.actor.id), direct);
    equal(direct.labels[0].id, label.id);
    equal(direct.statusLabel, 'Ready for work');
    equal(direct.statusCategory, 'unstarted');
    await f.db.update(teams).set({ isPrivate: true }).where(eq(teams.id, f.team.id));
    await rejects(() => f.issues.findById(f.issue.id, f.mentioned.id), /not found/i);
    await rejects(() => f.issues.findByIdentifier(f.issue.identifier, f.mentioned.id), /not found/i);
    equal((await f.issues.findById(f.issue.id, f.actor.id)).labels.length, 1);
  } finally { await f.close(); }
});
