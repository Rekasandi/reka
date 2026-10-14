// Real Nest HTTP -> authorization/validation -> isolated Postgres intake and triage contract.
const { equal, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, issues, activities, issueRelations, issueTemplates, teamWorkflowStates } = require('@reka/database');
const { TriageModule } = require('../dist/triage/triage.module');
const { TeamsModule } = require('../dist/teams/teams.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

test('internal intake templates validate and persist; triage routes, declines and duplicate decisions are scoped and replay-safe', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Intake company', slug: `intake-${suffix}` }).returning();
    const [owner, lead, member, guest, outsider] = await postgres.db.insert(users).values([
      { name: 'Owner', email: `owner-${suffix}@example.test`, role: 'owner' },
      { name: 'Lead', email: `lead-${suffix}@example.test`, role: 'member' },
      { name: 'Member', email: `member-${suffix}@example.test`, role: 'member' },
      { name: 'Guest', email: `guest-${suffix}@example.test`, role: 'guest' },
      { name: 'Other company', email: `outside-${suffix}@example.test`, role: 'owner' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: lead.id, role: 'member' },
      { organizationId: org.id, userId: member.id, role: 'member' },
      { organizationId: org.id, userId: guest.id, role: 'guest' },
    ]);
    const [team, destination, privateTeam] = await postgres.db.insert(teams).values([
      { organizationId: org.id, name: 'Intake', key: `T${suffix.slice(0, 4).toUpperCase()}` },
      { organizationId: org.id, name: 'Engineering', key: `E${suffix.slice(0, 4).toUpperCase()}` },
      { organizationId: org.id, name: 'Private', key: `P${suffix.slice(0, 4).toUpperCase()}`, isPrivate: true },
    ]).returning();
    await postgres.db.insert(teamMembers).values([
      { teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: team.id, userId: lead.id, role: 'lead' },
      { teamId: team.id, userId: member.id, role: 'member' },
      { teamId: destination.id, userId: owner.id, role: 'lead' },
      { teamId: privateTeam.id, userId: owner.id, role: 'lead' },
    ]);
    await postgres.db.insert(teamWorkflowStates).values([team, destination, privateTeam].flatMap((item) => [
      { teamId: item.id, key: 'triage', name: 'Triage', category: 'triage', color: '#ec9a3c', position: 0, isActive: true },
      { teamId: item.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#b0b0b0', position: 1, isActive: true },
    ]));
    const tokens = {};
    for (const user of [owner, lead, member, guest, outsider]) {
      tokens[user.id] = randomUUID();
      await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    }
    api = await createIsolatedApi(postgres, [TriageModule, TeamsModule]);
    const request = (user, path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const form = {
      name: 'Bug report', teamId: team.id, titlePrefix: '[Bug] ', description: 'Internal bug intake',
      defaultType: 'bug', defaultPriority: 'high', fields: [
        { key: 'impact', label: 'Impact', type: 'select', required: true, options: ['Low', 'High'] },
        { key: 'steps', label: 'Steps to reproduce', type: 'textarea', required: false },
      ],
    };
    equal((await request(member, '/issue-templates', 'POST', form)).status, 403, 'ordinary member cannot manage team forms');
    const createTemplate = await request(lead, '/issue-templates', 'POST', form);
    equal(createTemplate.status, 201, await createTemplate.clone().text());
    const template = await createTemplate.json();
    equal((await request(member, `/issue-templates?teamId=${team.id}`)).status, 200, 'team members can read intake forms');
    equal((await request(lead, '/issue-templates', 'POST', { name: 'Unauthorized global' })).status, 403, 'team leads cannot manage workspace-wide forms');
    const globalResponse = await request(owner, '/issue-templates', 'POST', { name: 'Workspace request', fields: [] });
    equal(globalResponse.status, 201, await globalResponse.clone().text());
    const globalTemplate = await globalResponse.json();
    equal((await request(member, `/issue-templates/${globalTemplate.id}/submit`, 'POST', { title: 'Workspace intake', teamId: team.id })).status, 201, 'internal users can route workspace-wide forms into a writable team');
    const configuredWorkflow = await (await request(owner, `/teams/${team.id}/workflow-states`)).json();
    const stateDrafts = configuredWorkflow.map(({ teamId: _teamId, ...state }) => state);
    const withoutTriage = stateDrafts.map((state) => state.key === 'triage' ? { ...state, isActive: false } : state);
    const reclassifiedTriage = stateDrafts.map((state) => state.key === 'triage' ? { ...state, category: 'started' } : state);
    equal((await request(owner, `/teams/${team.id}/workflow-states`, 'PATCH', { states: withoutTriage })).status, 400, 'active forms prevent disabling their intake state');
    equal((await request(owner, `/teams/${team.id}/workflow-states`, 'PATCH', { states: reclassifiedTriage })).status, 400, 'active forms prevent changing their state out of triage');
    equal((await request(guest, '/issue-templates', 'POST', { name: 'Forbidden', teamId: team.id })).status, 403, 'read-only legacy accounts cannot create forms');
    equal((await request(member, `/issue-templates?teamId=${privateTeam.id}`)).status, 404, 'private team membership is required to enumerate its forms');
    const privateFormResponse = await request(owner, '/issue-templates', 'POST', { name: 'Private report', teamId: privateTeam.id, fields: [] });
    equal(privateFormResponse.status, 201);
    const privateForm = await privateFormResponse.json();
    const privateSubmission = await request(owner, `/issue-templates/${privateForm.id}/submit`, 'POST', { title: 'Private incoming', answers: {} });
    equal(privateSubmission.status, 201);
    const privateIssue = await privateSubmission.json();
    const memberQueue = await (await request(member, '/triage')).json();
    ok(!memberQueue.some((issue) => issue.id === privateIssue.id), 'private incoming content stays hidden from non-members');
    equal((await request(member, `/triage?teamId=${privateTeam.id}`)).status, 404);
    equal((await request(outsider, '/issue-templates')).status, 403, 'other workspaces cannot read forms');

    const submit = (title, answers, submitter = member) => request(submitter, `/issue-templates/${template.id}/submit`, 'POST', { title, answers });
    equal((await submit('Blank required', { steps: 'x' })).status, 400);
    equal((await submit('Invalid option', { impact: 'Critical' })).status, 400);
    equal((await submit('Unknown field', { impact: 'High', injected: 'no' })).status, 400);
    equal((await submit('Read-only submit', { impact: 'High' }, guest)).status, 403);
    const firstResponse = await submit('Crash on save', { impact: 'High', steps: 'Press Save' });
    equal(firstResponse.status, 201, await firstResponse.clone().text());
    const first = await firstResponse.json();
    equal(first.title, '[Bug] Crash on save');
    equal(first.status, 'triage');
    equal(first.priority, 'high');
    equal(first.type, 'bug');
    ok(first.description.includes('Impact:\nHigh') && first.description.includes('Press Save'));
    equal((await postgres.db.select().from(issueTemplates).where(eq(issueTemplates.id, template.id))).length, 1);

    const queue = await request(owner, '/triage');
    equal(queue.status, 200);
    ok((await queue.json()).some((issue) => issue.id === first.id), 'triage queue contains only persisted incoming issues');
    equal((await request(outsider, '/triage')).status, 403);
    const accept = await request(owner, `/triage/${first.id}/accept`, 'POST', { teamId: destination.id, status: 'todo', assigneeId: member.id });
    equal(accept.status, 201, await accept.clone().text());
    const accepted = await accept.json();
    equal(accepted.teamId, destination.id);
    equal(accepted.status, 'todo');
    equal(accepted.assigneeId, member.id);
    equal((await postgres.db.select().from(activities).where(eq(activities.type, 'issue.triage_accepted'))).length, 1);
    equal((await (await request(owner, '/triage')).json()).some((issue) => issue.id === first.id), false);

    const declined = await (await submit('Declined request', { impact: 'Low' })).json();
    const declineResponse = await request(lead, `/triage/${declined.id}/decline`, 'POST', { reason: 'Not an actionable issue' });
    equal(declineResponse.status, 201);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, declined.id)))[0].archivedAt instanceof Date, true);
    const declineActivity = (await postgres.db.select().from(activities).where(eq(activities.type, 'issue.triage_declined')))[0];
    equal(declineActivity.metadata.reason, 'Not an actionable issue');
    equal((await request(lead, `/triage/${declined.id}/decline`, 'POST', {})).status, 404, 'a declined issue cannot be resolved a second time');

    const duplicateSource = await (await submit('Duplicate report', { impact: 'High' })).json();
    const [duplicateTarget] = await postgres.db.insert(issues).values({
      identifier: `${team.key}-999`, number: 999, title: 'Existing issue', teamId: team.id, reporterId: lead.id,
    }).returning();
    const duplicateResponse = await request(lead, `/triage/${duplicateSource.id}/duplicate`, 'POST', { relatedIssueId: duplicateTarget.id, reason: 'Same failure' });
    equal(duplicateResponse.status, 201, await duplicateResponse.clone().text());
    const [relation] = await postgres.db.select().from(issueRelations).where(eq(issueRelations.type, 'duplicate'));
    equal(relation.duplicateSourceIssueId, duplicateSource.id);
    equal((await postgres.db.select().from(activities).where(eq(activities.type, 'issue.triage_duplicate')))[0].metadata.relatedIssueId, duplicateTarget.id);
    equal((await request(lead, `/triage/${duplicateSource.id}/duplicate`, 'POST', { relatedIssueId: duplicateTarget.id })).status, 404);
  } finally {
    if (api) await api.close();
    await postgres.close();
  }
});

test('triage migration preserves existing custom workflow states and issue rows while appending an ordered triage state', { timeout: 90000 }, async () => {
  const source = path.resolve(__dirname, '../../../packages/database/drizzle');
  const sourceJournal = JSON.parse(fs.readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  const legacyEntries = sourceJournal.entries.slice(0, 17);
  const migrationsFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'reka-triage-migrations-'));
  const metaFolder = path.join(migrationsFolder, 'meta');
  fs.mkdirSync(metaFolder);
  fs.writeFileSync(path.join(metaFolder, '_journal.json'), JSON.stringify({ ...sourceJournal, entries: legacyEntries }, null, 2));
  for (const entry of legacyEntries) fs.copyFileSync(path.join(source, `${entry.tag}.sql`), path.join(migrationsFolder, `${entry.tag}.sql`));
  const postgres = await createPersistentPostgres({ migrationsFolder });
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toLowerCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Legacy workflow', slug: `legacy-${suffix}` }).returning();
    const [owner] = await postgres.db.insert(users).values({ name: 'Legacy owner', email: `legacy-${suffix}@example.test`, role: 'owner' }).returning();
    const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Legacy team', key: `L${suffix.slice(0, 4).toUpperCase()}` }).returning();
    await postgres.db.insert(teamWorkflowStates).values([
      { teamId: team.id, key: 'qa', name: 'Quality assurance', category: 'started', color: '#123456', position: 8, isActive: true },
      { teamId: team.id, key: 'done', name: 'Finished', category: 'completed', color: '#654321', position: 9, isActive: true },
    ]);
    const [legacyIssue] = await postgres.db.insert(issues).values({
      identifier: `${team.key}-1`, number: 1, title: 'Existing issue', teamId: team.id, reporterId: owner.id, status: 'qa',
    }).returning();
    fs.copyFileSync(path.join(source, '0017_internal_issue_triage.sql'), path.join(migrationsFolder, '0017_internal_issue_triage.sql'));
    fs.writeFileSync(path.join(metaFolder, '_journal.json'), JSON.stringify({ ...sourceJournal, entries: sourceJournal.entries.slice(0, 18) }, null, 2));
    await postgres.migrate(migrationsFolder);
    const [savedIssue] = await postgres.db.select().from(issues).where(eq(issues.id, legacyIssue.id));
    const savedStates = await postgres.db.select().from(teamWorkflowStates).where(eq(teamWorkflowStates.teamId, team.id));
    equal(savedIssue.title, 'Existing issue');
    equal(savedIssue.status, 'qa');
    equal(savedStates.find((state) => state.key === 'qa').name, 'Quality assurance');
    equal(savedStates.find((state) => state.key === 'qa').position, 8);
    equal(savedStates.find((state) => state.key === 'triage').position, 10, 'new triage state appends after configured states');
    equal((await postgres.db.select().from(issueTemplates)).length, 0);
  } finally {
    await postgres.close();
    fs.rmSync(migrationsFolder, { recursive: true, force: true });
  }
});
