// Initiatives and roadmap through authenticated Nest HTTP + isolated Postgres.
const { equal, ok, deepEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, sessions, projects, projectDependencies, issues, initiatives, initiativeProjects, milestones } = require('@reka/database');
const { InitiativesModule } = require('../dist/initiatives/initiatives.module');
const { ProjectsModule } = require('../dist/projects/projects.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

const testDatabase = async () => {
  const postgres = await createPersistentPostgres();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
  const [org, outsiderOrg] = await postgres.db.insert(organizations).values([
    { name: `Roadmap company ${suffix}`, slug: `roadmap-${suffix.toLowerCase()}` },
    { name: `Other company ${suffix}`, slug: `roadmap-other-${suffix.toLowerCase()}` },
  ]).returning();
  const [owner, member, outsider] = await postgres.db.insert(users).values([
    { name: 'Roadmap owner', email: `roadmap-owner-${suffix}@example.test`, role: 'owner' },
    { name: 'Roadmap member', email: `roadmap-member-${suffix}@example.test`, role: 'member' },
    { name: 'Unrelated user', email: `roadmap-outsider-${suffix}@example.test`, role: 'owner' },
  ]).returning();
  await postgres.db.insert(organizationMembers).values([
    { organizationId: org.id, userId: owner.id, role: 'owner' },
    { organizationId: org.id, userId: member.id, role: 'member' },
    { organizationId: outsiderOrg.id, userId: outsider.id, role: 'owner' },
  ]);
  const [publicTeam, privateTeam] = await postgres.db.insert(teams).values([
    { organizationId: org.id, name: 'Roadmap public', key: `RMP${suffix}` },
    { organizationId: org.id, name: 'Roadmap private', key: `RMS${suffix}`, isPrivate: true },
  ]).returning();
  await postgres.db.insert(teamMembers).values([
    { teamId: publicTeam.id, userId: owner.id, role: 'lead' },
    { teamId: publicTeam.id, userId: member.id, role: 'member' },
    { teamId: privateTeam.id, userId: owner.id, role: 'lead' },
  ]);
  const [alpha, beta, secret] = await postgres.db.insert(projects).values([
    { organizationId: org.id, teamId: publicTeam.id, name: `Alpha ${suffix}`, slug: `alpha-${suffix.toLowerCase()}`, ownerId: owner.id, startDate: new Date('2026-10-01T00:00:00Z'), targetDate: new Date('2026-12-31T00:00:00Z') },
    { organizationId: org.id, teamId: publicTeam.id, name: `Beta ${suffix}`, slug: `beta-${suffix.toLowerCase()}`, ownerId: owner.id, targetDate: new Date('2026-11-30T00:00:00Z') },
    { organizationId: org.id, teamId: privateTeam.id, name: `SECRET_ROADMAP_${suffix}`, slug: `secret-${suffix.toLowerCase()}`, ownerId: owner.id, startDate: new Date('2026-11-01T00:00:00Z'), targetDate: new Date('2027-01-01T00:00:00Z') },
  ]).returning();
  const [alphaMilestone] = await postgres.db.insert(milestones).values({ projectId: alpha.id, name: `Alpha milestone ${suffix}`, targetDate: new Date('2026-12-15T00:00:00Z') }).returning();
  const [done1, open1, done2, canceled2, secretIssue] = await postgres.db.insert(issues).values([
    { identifier: `${publicTeam.key}-1`, number: 1, title: 'Alpha complete', teamId: publicTeam.id, projectId: alpha.id, reporterId: owner.id, status: 'done' },
    { identifier: `${publicTeam.key}-2`, number: 2, title: 'Alpha remaining', teamId: publicTeam.id, projectId: alpha.id, reporterId: owner.id, status: 'backlog' },
    { identifier: `${publicTeam.key}-3`, number: 3, title: 'Beta complete', teamId: publicTeam.id, projectId: beta.id, reporterId: owner.id, status: 'done' },
    { identifier: `${publicTeam.key}-4`, number: 4, title: 'Beta canceled', teamId: publicTeam.id, projectId: beta.id, reporterId: owner.id, status: 'canceled' },
    { identifier: `${privateTeam.key}-1`, number: 1, title: `SECRET_ISSUE_${suffix}`, teamId: privateTeam.id, projectId: secret.id, reporterId: owner.id, status: 'done' },
  ]).returning();
  const tokens = {};
  for (const user of [owner, member, outsider]) {
    tokens[user.id] = randomUUID();
    await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
  }
  const api = await createIsolatedApi(postgres, [InitiativesModule, ProjectsModule]);
  const request = (user, url, method = 'GET', body) => fetch(`${api.url}/api${url}`, {
    method, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { postgres, api, request, suffix, org, owner, member, outsider, publicTeam, privateTeam, alpha, beta, secret, done1, open1, done2, canceled2, secretIssue, alphaMilestone };
};

test('initiatives roll up visible project data and roadmap omits inaccessible private names/counts', { timeout: 90000 }, async () => {
  const ctx = await testDatabase();
  const { postgres, api, request, suffix, owner, member, outsider, alpha, beta, secret, alphaMilestone } = ctx;
  try {
    const create = await request(owner, '/initiatives', 'POST', {
      name: `Launch ${suffix}`, description: 'A real multi-team roadmap objective', startDate: '2026-10-01', targetDate: '2027-02-28', status: 'in_progress',
    });
    equal(create.status, 201, await create.clone().text());
    const initiative = await create.json();
    equal(initiative.progress, null); equal(initiative.projectCount, 0);
    equal((await request(owner, `/initiatives/${initiative.id}/projects`, 'POST', { projectId: alpha.id })).status, 201);
    equal((await request(owner, `/initiatives/${initiative.id}/projects`, 'POST', { projectId: beta.id })).status, 201);
    equal((await request(owner, `/initiatives/${initiative.id}/projects`, 'POST', { projectId: secret.id })).status, 201);
    equal((await request(owner, '/initiatives', 'POST', { name: 'Invalid dates', startDate: '2027-03-01', targetDate: '2027-02-01' })).status, 400);

    const asMember = await (await request(member, `/initiatives/${initiative.id}`)).json();
    equal(asMember.projectCount, 2, 'private project membership must not affect counts');
    equal(asMember.totalIssues, 3); equal(asMember.completedIssues, 2); equal(asMember.progress, 67);
    ok(!JSON.stringify(asMember).includes('SECRET_ROADMAP_'));
    equal((await request(member, `/initiatives/${initiative.id}`, 'PATCH', { status: 'completed' })).status, 403, 'non-owner cannot edit initiative metadata');
    equal((await request(member, `/initiatives/${initiative.id}/projects`, 'POST', { projectId: alpha.id })).status, 403, 'ordinary team member cannot add projects');
    equal((await request(outsider, `/initiatives/${initiative.id}`)).status, 404);

    // A dependency to an inaccessible project is omitted, including its name and edge.
    equal((await request(owner, `/projects/${alpha.id}/dependencies`, 'POST', { dependsOnProjectId: secret.id })).status, 201);
    const roadmap = await (await request(member, '/initiatives/roadmap')).json();
    equal(roadmap.projects.some(project => project.id === secret.id), false);
    equal(roadmap.initiatives.find(row => row.id === initiative.id).projectCount, 2);
    ok(!JSON.stringify(roadmap).includes('SECRET_ROADMAP_'));
    equal(roadmap.dependencies.length, 0);
    equal(roadmap.milestones.find(item => item.id === alphaMilestone.id).projectName, alpha.name);
    equal(new Date(roadmap.milestones.find(item => item.id === alphaMilestone.id).targetDate).toISOString().slice(0, 10), '2026-12-15');
    equal(roadmap.projects.find(project => project.id === alpha.id).scheduled, true);
    equal(roadmap.projects.find(project => project.id === beta.id).scheduled, false, 'missing start date is explicitly unscheduled');

    const update = await request(owner, `/initiatives/${initiative.id}`, 'PATCH', { name: `Launch updated ${suffix}`, targetDate: '2027-03-31', health: 'at_risk' });
    equal(update.status, 200);
    equal((await update.json()).health, 'at_risk');
    equal((await request(owner, `/initiatives/${initiative.id}/projects/${beta.id}`, 'DELETE')).status, 200);
    equal((await (await request(owner, `/initiatives/${initiative.id}`)).json()).projectCount, 2, 'owner still sees linked private project and alpha after beta is removed');
    equal((await request(owner, `/initiatives/${initiative.id}`, 'DELETE')).status, 200);
    equal((await postgres.db.select().from(initiativeProjects).where(eq(initiativeProjects.initiativeId, initiative.id))).length, 0);
    equal((await postgres.db.select().from(initiatives).where(eq(initiatives.id, initiative.id))).length, 0);
    // Seeded projects/issues are not modified by initiative CRUD.
    equal((await postgres.db.select().from(projects).where(eq(projects.id, alpha.id))).length, 1);
  } finally {
    await api.close(); await postgres.close();
  }
});

// The migration is additive; verify applying it over populated 0020 state does not alter project/issue rows.
test('initiative migration is additive over an existing project database', { timeout: 90000 }, async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
  const source = path.resolve(__dirname, '../../../packages/database/drizzle');
  const sourceJournal = JSON.parse(fs.readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'reka-initiative-migration-'));
  fs.cpSync(source, folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify({ ...sourceJournal, entries: sourceJournal.entries.slice(0, 21) }));
  const postgres = await createPersistentPostgres({ migrationsFolder: folder });
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 6).toLowerCase();
    const [org] = await postgres.db.insert(organizations).values({ name: 'Before initiative migration', slug: `pre-init-${suffix}` }).returning();
    const [user] = await postgres.db.insert(users).values({ name: 'Migration owner', email: `migration-${suffix}@example.test` }).returning();
    await postgres.db.insert(organizationMembers).values({ organizationId: org.id, userId: user.id, role: 'owner' });
    const [team] = await postgres.db.insert(teams).values({ organizationId: org.id, name: 'Legacy project team', key: `LEG${suffix.toUpperCase()}` }).returning();
    const [project] = await postgres.db.insert(projects).values({ organizationId: org.id, teamId: team.id, name: 'Legacy project', slug: `legacy-${suffix}`, ownerId: user.id }).returning();
    await postgres.db.insert(issues).values({ identifier: `${team.key}-1`, number: 1, title: 'Legacy issue', teamId: team.id, projectId: project.id, reporterId: user.id });
    fs.copyFileSync(path.join(source, '0021_messy_starjammers.sql'), path.join(folder, '0021_messy_starjammers.sql'));
    fs.writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify({ ...sourceJournal, entries: sourceJournal.entries.slice(0, 22) }));
    await postgres.migrate(folder);
    equal((await postgres.db.select().from(projects).where(eq(projects.id, project.id))).length, 1);
    equal((await postgres.db.select().from(issues).where(eq(issues.projectId, project.id))).length, 1);
    equal((await postgres.db.select().from(initiatives)).length, 0);
    equal((await postgres.db.select().from(initiativeProjects)).length, 0);
  } finally {
    await postgres.close(); fs.rmSync(folder, { recursive: true, force: true });
  }
});
