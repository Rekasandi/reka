// 0034: existing teams get a Duplicate state; the old default Blocked state is removed only when unused.
const { deepEqual, equal } = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { sql } = require('drizzle-orm');
const { organizations, users } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { insertLegacyTeam, insertLegacyIssue } = require('./support/legacy-team.cjs');

test('0034 adds Duplicate to existing workflows and drops only unused Blocked states', { timeout: 90000 }, async () => {
  const source = path.resolve(__dirname, '../../../packages/database/drizzle');
  const journal = JSON.parse(fs.readFileSync(path.join(source, 'meta/_journal.json'), 'utf8'));
  const index = journal.entries.findIndex((entry) => entry.tag === '0034_existing_teams_duplicate_state');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'reka-0034-'));
  fs.mkdirSync(path.join(folder, 'meta'));
  const stage = (count) => {
    fs.writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
    for (const entry of journal.entries.slice(0, count)) fs.copyFileSync(path.join(source, `${entry.tag}.sql`), path.join(folder, `${entry.tag}.sql`));
  };
  stage(index);
  const postgres = await createPersistentPostgres({ migrationsFolder: folder });
  try {
    const db = postgres.db; const marker = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    const [org] = await db.insert(organizations).values({ name: 'Legacy', slug: `legacy-${marker.toLowerCase()}` }).returning();
    const [owner] = await db.insert(users).values({ name: 'Owner', email: `o-${marker}@example.test`, role: 'owner' }).returning();
    const unused = await insertLegacyTeam(db, { organizationId: org.id, name: 'Unused', key: `U${marker}` });
    const used = await insertLegacyTeam(db, { organizationId: org.id, name: 'Used', key: `S${marker}` });
    for (const team of [unused, used]) await db.execute(sql`INSERT INTO team_workflow_states (team_id, key, name, category, position) VALUES
      (${team.id}::uuid, 'todo', 'Todo', 'unstarted', 0), (${team.id}::uuid, 'done', 'Done', 'completed', 1), (${team.id}::uuid, 'blocked', 'Blocked', 'started', 5)`);
    await insertLegacyIssue(db, { identifier: `S${marker}-1`, number: 1, title: 'Stuck', status: 'blocked', teamId: used.id, reporterId: owner.id });

    stage(index + 1);
    await postgres.migrate(folder);
    const keys = async (team) => (await db.execute(sql`SELECT key, position FROM team_workflow_states WHERE team_id = ${team.id}::uuid ORDER BY position`)).rows;
    deepEqual((await keys(unused)).map((r) => r.key), ['todo', 'done', 'duplicate'], 'unused Blocked removed, Duplicate appended');
    deepEqual((await keys(used)).map((r) => r.key), ['todo', 'done', 'blocked', 'duplicate'], 'Blocked kept while an issue uses it');
    equal((await keys(used)).find((r) => r.key === 'duplicate').position, 6, 'Duplicate goes after the last state');
  } finally {
    await postgres.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
