const { equal } = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { migrate } = require('drizzle-orm/pglite/migrator');
const { eq, sql } = require('drizzle-orm');
const { issueHistory, issues, organizations, teams, teamWorkflowStates, users } = require('@reka/database');

test('insight history migration preserves preexisting rows as unknown and captures future status categories', { timeout: 90_000 }, async () => {
  const source = resolve(__dirname, '../../../packages/database/drizzle');
  const staged = mkdtempSync(join(tmpdir(), 'reka-insight-migrations-'));
  mkdirSync(join(staged, 'meta'));
  const journal = JSON.parse(readFileSync(join(source, 'meta/_journal.json'), 'utf8'));
  const earlierEntries = journal.entries.filter(entry => entry.tag < '0027_insight_status_category_history');
  for (const entry of earlierEntries) copyFileSync(join(source, `${entry.tag}.sql`), join(staged, `${entry.tag}.sql`));
  writeFileSync(join(staged, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: earlierEntries }));
  let pg;
  try {
    pg = new PGlite(); await pg.waitReady;
    const db = drizzle(pg, { schema: require('@reka/database') });
    await migrate(db, { migrationsFolder: staged });
    const marker = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const [org] = await db.insert(organizations).values({ name: 'Insight history', slug: `insight-history-${marker.toLowerCase()}` }).returning();
    const [owner] = await db.insert(users).values({ name: 'History owner', email: `history-${marker}@example.test` }).returning();
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'History team', key: `H${marker.slice(0, 5)}` }).returning();
    await db.insert(teamWorkflowStates).values([
      { teamId: team.id, key: 'queued', name: 'Queued', category: 'unstarted', color: '#888888', position: 0 },
      { teamId: team.id, key: 'reviewing', name: 'Reviewing', category: 'started', color: '#4488ff', position: 1 },
      { teamId: team.id, key: 'shipped', name: 'Shipped', category: 'completed', color: '#44aa77', position: 2 },
    ]);
    const [legacyIssue] = await db.insert(issues).values({ identifier: `${team.key}-1`, number: 1, title: 'Legacy row', status: 'shipped', teamId: team.id, reporterId: owner.id }).returning();
    await db.execute(sql`INSERT INTO issue_history (issue_id, team_id, event, before_state, after_state) VALUES (${legacyIssue.id}::uuid, ${team.id}::uuid, 'created', NULL, ${JSON.stringify({ status: 'shipped' })}::jsonb)`);

    await migrate(db, { migrationsFolder: source });
    const [legacy] = await db.select().from(issueHistory).where(eq(issueHistory.issueId, legacyIssue.id)).orderBy(issueHistory.id);
    equal(legacy.beforeStatusCategory, null); equal(legacy.afterStatusCategory, null, 'migration does not infer a false past category');

    const [freshIssue] = await db.insert(issues).values({ identifier: `${team.key}-2`, number: 2, title: 'Measured issue', status: 'queued', teamId: team.id, reporterId: owner.id }).returning();
    await db.update(issues).set({ status: 'reviewing' }).where(eq(issues.id, freshIssue.id));
    const createdAndStarted = await db.select().from(issueHistory).where(eq(issueHistory.issueId, freshIssue.id)).orderBy(issueHistory.id);
    equal(createdAndStarted[0].event, 'created'); equal(createdAndStarted[0].afterStatusCategory, 'unstarted');
    equal(createdAndStarted[1].beforeStatusCategory, 'unstarted'); equal(createdAndStarted[1].afterStatusCategory, 'started');

    // A category reclassification affects only future events, not the already recorded transition.
    await db.update(teamWorkflowStates).set({ category: 'completed' }).where(eq(teamWorkflowStates.teamId, team.id));
    await db.update(issues).set({ title: 'Reclassified after observation' }).where(eq(issues.id, freshIssue.id));
    const allHistory = await db.select().from(issueHistory).where(eq(issueHistory.issueId, freshIssue.id)).orderBy(issueHistory.id);
    equal(allHistory[1].afterStatusCategory, 'started');
    equal(allHistory[2].beforeStatusCategory, 'completed'); equal(allHistory[2].afterStatusCategory, 'completed');
    await pg.close(); pg = undefined;
  } finally { if (pg) await pg.close(); rmSync(staged, { recursive: true, force: true }); }
});
