const { equal } = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { migrate } = require('drizzle-orm/pglite/migrator');
const { sql, eq } = require('drizzle-orm');
const { organizations, users, teams, issues, comments, attachments, notifications, issueSubscriptions, notificationPreferences } = require('@reka/database');

test('collaboration migration preserves legacy comments, attachment locations and notification state', { timeout: 90000 }, async () => {
  const source = resolve(__dirname, '../../../packages/database/drizzle');
  const staged = mkdtempSync(join(tmpdir(), 'reka-collab-migrations-'));
  mkdirSync(join(staged, 'meta'));
  const journal = JSON.parse(readFileSync(join(source, 'meta/_journal.json'), 'utf8'));
  const earlierEntries = journal.entries.filter(entry => entry.tag < '0023_good_puck');
  for (const entry of earlierEntries) copyFileSync(join(source, `${entry.tag}.sql`), join(staged, `${entry.tag}.sql`));
  writeFileSync(join(staged, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: earlierEntries }));
  let pg;
  try {
    pg = new PGlite(); await pg.waitReady;
    const db = drizzle(pg, { schema: require('@reka/database') });
    await migrate(db, { migrationsFolder: staged });
    const [org] = await db.insert(organizations).values({ name: 'Legacy collaboration', slug: `legacy-collab-${randomUUID()}` }).returning();
    const [owner, member] = await db.insert(users).values([
      { name: 'Legacy owner', email: `legacy-owner-${randomUUID()}@example.test` },
      { name: 'Legacy member', email: `legacy-member-${randomUUID()}@example.test` },
    ]).returning();
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Legacy team', key: `L${randomUUID().replaceAll('-', '').slice(0, 6)}` }).returning();
    const issueId = randomUUID(); const commentId = randomUUID(); const attachmentId = randomUUID(); const notificationId = randomUUID();
    await db.execute(sql`INSERT INTO issues (id, identifier, number, title, team_id, reporter_id, status) VALUES (${issueId}::uuid, ${`${team.key}-1`}, 1, 'Legacy issue', ${team.id}::uuid, ${owner.id}::uuid, 'todo')`);
    await db.execute(sql`INSERT INTO comments (id, issue_id, author_id, body) VALUES (${commentId}::uuid, ${issueId}::uuid, ${owner.id}::uuid, 'Legacy comment')`);
    await db.execute(sql`INSERT INTO attachments (id, issue_id, uploader_id, file_name, file_size, mime_type, url) VALUES (${attachmentId}::uuid, ${issueId}::uuid, ${owner.id}::uuid, 'external.png', 17, 'image/png', 'https://legacy.invalid/file')`);
    await db.execute(sql`INSERT INTO notifications (id, user_id, type, title, body, read, metadata) VALUES (${notificationId}::uuid, ${member.id}::uuid, 'comment', 'Legacy notification', 'Existing record', true, ${JSON.stringify({ issueId })}::jsonb)`);
    await migrate(db, { migrationsFolder: source });
    equal((await db.select().from(comments).where(eq(comments.id, commentId)))[0].body, 'Legacy comment');
    const [legacyFile] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
    equal(legacyFile.url, 'https://legacy.invalid/file'); equal(legacyFile.content, null);
    const [legacyNotification] = await db.select().from(notifications).where(eq(notifications.id, notificationId));
    equal(legacyNotification.read, true); equal(legacyNotification.title, 'Legacy notification');
    equal((await db.select().from(issueSubscriptions)).length, 0);
    equal((await db.select().from(notificationPreferences)).length, 0, 'default notification settings do not rewrite existing accounts');
    await pg.close(); pg = undefined;
  } finally { if (pg) await pg.close(); rmSync(staged, { recursive: true, force: true }); }
});
