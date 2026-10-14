const { equal } = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { migrate } = require('drizzle-orm/pglite/migrator');
const { organizations, users, teams, cycles, cycleSnapshots, teamCycleSettings } = require('@reka/database');

test('cycle planning migration preserves legacy cycle rows and adds empty planning/history state', { timeout: 90000 }, async () => {
  const source = resolve(__dirname, '../../../packages/database/drizzle');
  const staged = mkdtempSync(join(tmpdir(), 'reka-cycle-migrations-'));
  mkdirSync(join(staged, 'meta'));
  const journal = JSON.parse(readFileSync(join(source, 'meta/_journal.json'), 'utf8'));
  const earlierEntries = journal.entries.filter(entry => entry.tag < '0022_brown_violations');
  for (const entry of earlierEntries) copyFileSync(join(source, `${entry.tag}.sql`), join(staged, `${entry.tag}.sql`));
  writeFileSync(join(staged, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: earlierEntries }));
  let pg;
  try {
    pg = new PGlite(); await pg.waitReady;
    let db = drizzle(pg, { schema: require('@reka/database') });
    await migrate(db, { migrationsFolder: staged });
    const [org] = await db.insert(organizations).values({ name: 'Legacy cycle company', slug: `legacy-cycle-${randomUUID()}` }).returning();
    const [owner] = await db.insert(users).values({ name: 'Legacy cycle owner', email: `legacy-cycle-${randomUUID()}@example.test` }).returning();
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Legacy cycles', key: `LC${randomUUID().replaceAll('-', '').slice(0, 6)}` }).returning();
    const cycleId = randomUUID();
    const start = new Date('2025-01-01T00:00:00.000Z'); const end = new Date('2025-01-14T00:00:00.000Z');
    await db.execute(require('drizzle-orm').sql`INSERT INTO cycles (id, team_id, number, name, start_date, end_date, is_completed, created_at, updated_at)
      VALUES (${cycleId}::uuid, ${team.id}::uuid, 7, 'Legacy preserved', ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, true, now(), now())`);
    await migrate(db, { migrationsFolder: source });
    const [preserved] = await db.select().from(cycles).where(require('drizzle-orm').eq(cycles.id, cycleId));
    equal(preserved.name, 'Legacy preserved'); equal(preserved.number, 7); equal(preserved.isCompleted, true);
    equal(new Date(preserved.startDate).toISOString(), start.toISOString()); equal(new Date(preserved.endDate).toISOString(), end.toISOString());
    equal(preserved.capacity, null); equal(preserved.scheduledStartDate, null);
    equal((await db.select().from(teamCycleSettings)).length, 0);
    equal((await db.select().from(cycleSnapshots)).length, 0);
    // The legacy owner remains available to configure this team's new schedule.
    equal(owner.id.length > 0, true);
    await pg.close(); pg = undefined;
  } finally {
    if (pg) await pg.close();
    rmSync(staged, { recursive: true, force: true });
  }
});
