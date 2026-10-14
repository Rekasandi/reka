const { equal, match, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { migrate } = require('drizzle-orm/pglite/migrator');
const { eq, sql } = require('drizzle-orm');
const { activities, githubBranches, githubInstallations, githubRepositories, issues, organizations, teams, users } = require('@reka/database');

test('GitHub idempotency migrations fail safely on ambiguous legacy rows and preserve reconciled data', { timeout: 90_000 }, async () => {
  const source = resolve(__dirname, '../../../packages/database/drizzle');
  const staged = mkdtempSync(join(tmpdir(), 'reka-github-migrations-'));
  mkdirSync(join(staged, 'meta'));
  const journal = JSON.parse(readFileSync(join(source, 'meta/_journal.json'), 'utf8'));
  const earlierEntries = journal.entries.filter(entry => entry.tag < '0024_github_branch_links');
  for (const entry of earlierEntries) copyFileSync(join(source, `${entry.tag}.sql`), join(staged, `${entry.tag}.sql`));
  writeFileSync(join(staged, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: earlierEntries }));
  let pg;
  try {
    pg = new PGlite(); await pg.waitReady;
    const db = drizzle(pg, { schema: require('@reka/database') });
    await migrate(db, { migrationsFolder: staged });
    const marker = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const [org] = await db.insert(organizations).values({ name: 'Legacy GitHub', slug: `legacy-github-${marker.toLowerCase()}` }).returning();
    const [owner] = await db.insert(users).values({ name: 'Legacy owner', email: `legacy-github-${marker}@example.test` }).returning();
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Legacy team', key: `G${marker.slice(0, 5)}` }).returning();
    const [issue] = await db.insert(issues).values({ identifier: `${team.key}-1`, number: 1, title: 'Legacy issue', status: 'todo', teamId: team.id, reporterId: owner.id }).returning();
    const [installation] = await db.insert(githubInstallations).values({ organizationId: org.id, installationId: Date.now() + 100, accountLogin: 'legacy' }).returning();
    const [repository] = await db.insert(githubRepositories).values({ installationId: installation.id, repoId: Date.now() + 101, owner: 'legacy', name: 'repo', fullName: 'legacy/repo' }).returning();
    const [branchA, branchB] = await db.insert(githubBranches).values([
      { repositoryId: repository.id, issueId: issue.id, name: 'feature/legacy', sha: 'a'.repeat(40) },
      { repositoryId: repository.id, issueId: issue.id, name: 'feature/legacy', sha: 'b'.repeat(40) },
    ]).returning();
    const eventMetadata = { webhookEventId: 'old-delivery-1' };
    const [activityA, activityB] = await db.insert(activities).values([
      { issueId: issue.id, actorId: owner.id, type: 'github.pr_closed', metadata: eventMetadata },
      { issueId: issue.id, actorId: owner.id, type: 'github.pr_closed', metadata: eventMetadata },
    ]).returning();

    await rejects(migrate(db, { migrationsFolder: source }), /Duplicate linked GitHub branches exist/);
    equal((await db.select().from(githubBranches).where(eq(githubBranches.issueId, issue.id))).length, 2, 'failed migration must preserve both branch records');
    await db.delete(githubBranches).where(eq(githubBranches.id, branchB.id));

    await rejects(migrate(db, { migrationsFolder: source }), /Duplicate GitHub webhook activity exists/);
    equal((await db.select().from(githubBranches).where(eq(githubBranches.issueId, issue.id))).length, 1, '0024 creates its index without rewriting legacy branches');
    equal((await db.select().from(activities).where(sql`${activities.metadata}->>'webhookEventId' = 'old-delivery-1'`)).length, 2, 'failed activity migration preserves both events');
    await db.delete(activities).where(eq(activities.id, activityB.id));
    await migrate(db, { migrationsFolder: source });
    equal((await db.select().from(githubBranches).where(eq(githubBranches.id, branchA.id))).length, 1);
    equal((await db.select().from(activities).where(eq(activities.id, activityA.id))).length, 1);
    await pg.close(); pg = undefined;
  } finally { if (pg) await pg.close(); rmSync(staged, { recursive: true, force: true }); }
});
