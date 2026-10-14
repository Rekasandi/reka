// Isolated embedded Postgres only: never reads .env or connects to DATABASE_URL.
const { equal, deepEqual, rejects, ok } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, createHash } = require('node:crypto');
const { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { eq, asc, sql } = require('drizzle-orm');
const { issueHistory, issues, organizationMembers, teams, workspaceInvitations } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');

const migrations = resolve(__dirname, '../../../packages/database/drizzle');
function legacyMigrations() {
  const directory = mkdtempSync(join(tmpdir(), 'reka-legacy-migrations-'));
  mkdirSync(join(directory, 'meta'));
  const journal = JSON.parse(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8'));
  journal.entries = journal.entries.filter(entry => entry.idx < 4);
  writeFileSync(join(directory, 'meta/_journal.json'), JSON.stringify(journal));
  for (const { tag } of journal.entries) copyFileSync(join(migrations, `${tag}.sql`), join(directory, `${tag}.sql`));
  return directory;
}

async function seedLegacy(db) {
  const ids = { org: randomUUID(), owner: randomUUID(), member: randomUUID(), team: randomUUID(), project: randomUUID(), milestone: randomUUID(), issue: randomUUID() };
  await db.execute(sql`INSERT INTO organizations (id, name, slug) VALUES (${ids.org}, 'Internal company', 'company')`);
  await db.execute(sql`INSERT INTO users (id, email, name, role) VALUES (${ids.owner}, 'owner@example.test', 'Owner', 'owner'), (${ids.member}, 'member@example.test', 'Member', 'member')`);
  await db.execute(sql`INSERT INTO organization_members (organization_id, user_id, role) VALUES (${ids.org}, ${ids.owner}, 'owner')`);
  await db.execute(sql`INSERT INTO teams (id, organization_id, name, key, icon) VALUES (${ids.team}, ${ids.org}, 'Engineering', 'ENG', 'Building2')`);
  await db.execute(sql`INSERT INTO projects (id, organization_id, team_id, name, slug, owner_id, icon) VALUES (${ids.project}, ${ids.org}, ${ids.team}, 'Existing project', 'existing', ${ids.owner}, 'Building2')`);
  await db.execute(sql`INSERT INTO milestones (id, project_id, name) VALUES (${ids.milestone}, ${ids.project}, 'Existing milestone')`);
  await db.execute(sql`INSERT INTO issues (id, team_id, project_id, milestone_id, reporter_id, identifier, number, title, status) VALUES (${ids.issue}, ${ids.team}, ${ids.project}, ${ids.milestone}, ${ids.owner}, 'ENG-1', 1, 'Existing issue', 'in_progress')`);
  return ids;
}

async function history(db, id) {
  return db.select().from(issueHistory).where(eq(issueHistory.issueId, id)).orderBy(asc(issueHistory.id));
}

test('foundation migration preserves legacy rows/roles/milestones and instruments truthful issue history', { timeout: 90000 }, async () => {
  const folder = legacyMigrations();
  let postgres;
  try {
    postgres = await createPersistentPostgres({ migrationsFolder: folder });
    const ids = await seedLegacy(postgres.db);
    await postgres.migrate();
    const members = await postgres.db.select().from(organizationMembers);
    equal(members.length, 2);
    equal(members.find(row => row.userId === ids.owner).role, 'owner');
    equal(members.find(row => row.userId === ids.member).role, 'member');
    ok(members.every(row => row.isActive));
    equal((await postgres.db.select().from(teams))[0].isPrivate, false);
    equal((await postgres.db.select().from(teams))[0].icon, 'Building2');
    const preserved = await postgres.db.execute(sql`SELECT i.title, i.milestone_id, m.name FROM issues i JOIN milestones m ON m.id = i.milestone_id WHERE i.id = ${ids.issue}`);
    deepEqual(preserved.rows, [{ title: 'Existing issue', milestone_id: ids.milestone, name: 'Existing milestone' }]);

    let rows = await history(postgres.db, ids.issue);
    equal(rows.length, 1);
    equal(rows[0].event, 'baseline');
    equal(rows[0].actorId, null, 'baseline must not invent a historical actor');
    equal(rows[0].afterState.status, 'in_progress');
    equal(rows[0].afterState.milestone_id, ids.milestone);
    equal(rows[0].beforeState, null);

    // Retried migrations must not add memberships or pretend to replay history.
    await postgres.migrate();
    equal((await history(postgres.db, ids.issue)).length, 1);
    equal((await postgres.db.select().from(organizationMembers)).length, 2);

    await postgres.db.update(issues).set({ status: 'done', estimate: 3, updatedAt: new Date() }).where(eq(issues.id, ids.issue));
    rows = await history(postgres.db, ids.issue);
    equal(rows.length, 2);
    equal(rows[1].event, 'updated');
    equal(rows[1].beforeState.status, 'in_progress');
    equal(rows[1].afterState.status, 'done');
    equal(rows[1].afterState.estimate, 3);
    equal(rows[1].actorId, null, 'unknown direct-write actor must not be guessed');

    await postgres.db.update(issues).set({ updatedAt: new Date() }).where(eq(issues.id, ids.issue));
    equal((await history(postgres.db, ids.issue)).length, 2, 'timestamp-only writes are not delivery events');
    await rejects(postgres.db.update(issues).set({ projectId: randomUUID(), status: 'todo' }).where(eq(issues.id, ids.issue)));
    equal((await history(postgres.db, ids.issue)).length, 2, 'failed updates cannot leave history behind');

    await postgres.reopen();
    equal((await history(postgres.db, ids.issue)).length, 2);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, ids.issue)))[0].status, 'done');
    await postgres.db.delete(issues).where(eq(issues.id, ids.issue));
    rows = await history(postgres.db, ids.issue);
    equal(rows.at(-1).event, 'deleted');
    equal(rows.at(-1).beforeState.status, 'done');
    equal(rows.at(-1).afterState, null);
    await postgres.reopen();
    equal((await history(postgres.db, ids.issue)).length, 3, 'issue deletion must not erase the event');

    const [newIssue] = await postgres.db.insert(issues).values({ teamId: ids.team, reporterId: ids.owner, identifier: 'ENG-2', number: 2, title: 'Post-cutoff issue' }).returning();
    const newRows = await history(postgres.db, newIssue.id);
    equal(newRows[0].event, 'created');
    equal(newRows[0].actorId, ids.owner);
    await postgres.db.delete(teams).where(eq(teams.id, ids.team));
    equal((await postgres.db.select().from(issueHistory)).length, 0, 'team cascade semantics remain valid');
  } finally {
    if (postgres) await postgres.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('foundation migration rejects ambiguous legacy organizations atomically', { timeout: 90000 }, async () => {
  const folder = legacyMigrations();
  let postgres;
  try {
    postgres = await createPersistentPostgres({ migrationsFolder: folder });
    const ids = await seedLegacy(postgres.db);
    await postgres.db.execute(sql`INSERT INTO organizations (name, slug) VALUES ('Other company', 'other')`);
    await rejects(postgres.migrate(), error => /multiple organizations found/.test(String(error.cause || error)));
    const columns = await postgres.db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'is_private'`);
    equal(columns.rows.length, 0, 'migration transaction must roll back its new columns');
    const memberRows = await postgres.db.execute(sql`SELECT user_id FROM organization_members`);
    deepEqual(memberRows.rows, [{ user_id: ids.owner }], 'no implicit cross-company membership grants');
    const issueRows = await postgres.db.execute(sql`SELECT title FROM issues WHERE id = ${ids.issue}`);
    equal(issueRows.rows[0].title, 'Existing issue');
  } finally {
    if (postgres) await postgres.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('invitation schema stores hashes, normalized email and bounded roles across restarts', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  try {
    const org = randomUUID();
    const owner = randomUUID();
    await postgres.db.execute(sql`INSERT INTO organizations (id, name, slug) VALUES (${org}, 'Company', 'company')`);
    await postgres.db.execute(sql`INSERT INTO users (id, email, name, role) VALUES (${owner}, 'owner@example.test', 'Owner', 'owner')`);
    const token = 'isolated-test-only-token';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [invite] = await postgres.db.insert(workspaceInvitations).values({ organizationId: org, invitedById: owner, email: 'member@example.test', tokenHash, expiresAt: new Date(Date.now() + 86400000) }).returning();
    await rejects(postgres.db.insert(workspaceInvitations).values({ organizationId: org, invitedById: owner, email: 'member@example.test', tokenHash: 'a'.repeat(64), expiresAt: new Date(), role: 'owner' }));
    await rejects(postgres.db.insert(workspaceInvitations).values({ organizationId: org, invitedById: owner, email: ' Member@example.test ', tokenHash: 'b'.repeat(64), expiresAt: new Date() }));
    await postgres.reopen();
    const rows = await postgres.db.select().from(workspaceInvitations);
    equal(rows.length, 1);
    equal(rows[0].id, invite.id);
    equal(rows[0].tokenHash, tokenHash);
    equal(JSON.stringify(rows).includes(token), false);
    equal(rows[0].acceptedAt, null);
  } finally {
    await postgres.close();
  }
});
