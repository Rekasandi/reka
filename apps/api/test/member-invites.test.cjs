const { deepEqual, equal } = require('node:assert/strict');
const { test } = require('node:test');
const { TeamsService } = require('../dist/teams/teams.service');
const { ProjectsService } = require('../dist/projects/projects.service');
const { createServiceFixture } = require('./support/service-fixture.cjs');

test('adding a team member notifies only the invited user', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    const events = [];
    const service = new TeamsService(f.database, { createForEvent: async (...args) => events.push(args) });
    await service.addMember(f.team.id, { userId: f.assignee.id, role: 'member' }, f.actor.id);
    deepEqual(events, [[f.assignee.id, {
      type: 'team_invite', title: 'Added to Engineering', body: 'You were added to team Engineering.',
      link: `/teams/${f.team.id}`, metadata: { teamId: f.team.id, teamName: 'Engineering', role: 'member' },
    }]]);
  } finally { await f.close(); }
});

test('adding a project member notifies only the invited user', { timeout: 90000 }, async () => {
  const f = await createServiceFixture();
  try {
    const events = [];
    const service = new ProjectsService(f.database, { createForEvent: async (...args) => events.push(args) });
    await service.addMember(f.project.id, f.assignee.id, f.actor.id);
    deepEqual(events, [[f.assignee.id, {
      type: 'project_invite', title: 'Added to Workspace', body: 'You were added to project Workspace.',
      link: `/projects/${f.project.id}`, metadata: { projectId: f.project.id, projectName: 'Workspace' },
    }]]);
    equal((await service.addMember(f.project.id, f.assignee.id, f.actor.id)).added, false);
    equal(events.length, 1, 'retry must not emit a duplicate invitation');
  } finally { await f.close(); }
});
