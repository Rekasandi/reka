const { deepEqual, equal } = require('node:assert/strict');
const { test } = require('node:test');
const { eq } = require('drizzle-orm');
const { issues } = require('@reka/database');
const { createServiceFixture } = require('./support/service-fixture.cjs');

test('issue assignment and status flows persist notifications for the target user', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    await f.db.update(issues).set({ reporterId: f.actor.id }).where(eq(issues.id, f.issue.id));
    await f.issues.update(f.issue.id, { assigneeId: f.mentioned.id, status: 'in_progress' }, f.actor.id);
    deepEqual((await f.inbox.findAll(f.mentioned.id)).map(row => row.type).sort(), ['assignment', 'status_change']);
    deepEqual(await f.inbox.findAll(f.actor.id), []);
    await f.postgres.reopen();
    equal((await f.inbox.findAll(f.mentioned.id)).length, 2, 'notifications survive an actual database restart');
  } finally { await f.close(); }
});

test('comment mentions create persistent notifications for mentioned user only', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    await f.comments.create(f.issue.id, 'Please review, @pat-dev', f.actor.id);
    equal((await f.inbox.findAll(f.mentioned.id))[0].type, 'mention');
    deepEqual(await f.inbox.findAll(f.assignee.id), []);
  } finally { await f.close(); }
});

test('team and project member adds persist invite notifications for invitee only', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    await f.teams.addMember(f.team.id, { userId: f.assignee.id }, f.actor.id);
    equal((await f.inbox.findAll(f.assignee.id))[0].type, 'team_invite');
    deepEqual(await f.inbox.findAll(f.actor.id), []);
    await f.projects.addMember(f.project.id, f.mentioned.id, f.actor.id);
    equal((await f.inbox.findAll(f.mentioned.id))[0].type, 'project_invite');
    deepEqual(await f.inbox.findAll(f.actor.id), []);
  } finally { await f.close(); }
});
