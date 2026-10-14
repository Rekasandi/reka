const { deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { IssuesService } = require('../dist/issues/issues.service');
const { CommentsService } = require('../dist/comments/comments.service');
const { createServiceFixture } = require('./support/service-fixture.cjs');
const { teamMembers } = require('@reka/database');

test('real issue assignment and status updates notify the changed assignee and other reporter', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    const events = [];
    await f.db.insert(teamMembers).values([
      { teamId: f.team.id, userId: f.reporter.id, role: 'member' },
      { teamId: f.team.id, userId: f.mentioned.id, role: 'member' },
    ]);
    const service = new IssuesService(f.database, { createForEvent: async (...args) => events.push(args) });
    await service.update(f.issue.id, { assigneeId: f.mentioned.id, status: 'in_progress' }, f.reporter.id);
    deepEqual(events.map(([id, event]) => [id, event.type]), [
      [f.mentioned.id, 'status_change'], [f.mentioned.id, 'assignment'],
    ]);
  } finally { await f.close(); }
});

test('real comment mentions notify mentioned account, not uninvolved issue members', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    const events = [];
    const service = new CommentsService(f.database, { createForEvent: async (...args) => events.push(args) });
    await service.create(f.issue.id, 'Please review, @pat-dev', f.actor.id);
    deepEqual(events.map(([id, event]) => [id, event.type]), [[f.mentioned.id, 'mention']]);
  } finally { await f.close(); }
});
