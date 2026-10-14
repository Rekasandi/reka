const { deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { labels, issueLabels } = require('@reka/database');
const { createServiceFixture } = require('./support/service-fixture.cjs');

test('issue list response includes persisted label associations for sidebar filtering', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    const rows = await f.db.insert(labels).values([
      { organizationId: f.org.id, name: 'Bug', color: '#dc2626' },
      { organizationId: f.org.id, name: 'Urgent', color: '#f59e0b' },
    ]).returning();
    await f.db.insert(issueLabels).values(rows.map(label => ({ issueId: f.issue.id, labelId: label.id })));
    const response = await f.issues.findAll(f.actor.id);
    deepEqual(response[0].labels.sort((a, b) => a.name.localeCompare(b.name)), rows.map(({ id, name, color }) => ({ id, name, color })).sort((a, b) => a.name.localeCompare(b.name)));
  } finally { await f.close(); }
});
