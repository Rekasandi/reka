const { deepEqual, equal, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { BadRequestException, NotFoundException } = require('@nestjs/common');
const { notifications, organizations, organizationMembers, users } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { NotificationsService } = require('../dist/notifications/notifications.service');

test('snoozed notifications hide from the inbox and unread count until unsnoozed, scoped to the owner', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  const marker = randomUUID().replaceAll('-', '').slice(0, 10);
  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: `Snooze ${marker}`, slug: `snooze-${marker}` }).returning();
    const [owner] = await db.insert(users).values({ email: `owner-${marker}@example.test`, name: 'Owner' }).returning();
    const [other] = await db.insert(users).values({ email: `other-${marker}@example.test`, name: 'Other' }).returning();
    await db.insert(organizationMembers).values([{ organizationId: org.id, userId: owner.id, role: 'owner' }, { organizationId: org.id, userId: other.id, role: 'member' }]);
    const [row] = await db.insert(notifications).values({ userId: owner.id, type: 'mention', title: 'Ping', body: 'Body' }).returning();
    const inbox = new NotificationsService({ db });
    const ids = (rows) => rows.map((r) => r.id);

    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const snoozed = await inbox.snooze(row.id, owner.id, until);
    equal(snoozed.read, false);
    equal(new Date(snoozed.snoozedUntil).toISOString(), until);
    deepEqual(ids(await inbox.findAll(owner.id)), []);
    deepEqual(ids(await inbox.findAll(owner.id, { snoozed: true })), [row.id]);
    equal((await inbox.getUnreadCount(owner.id)).count, 0);

    await rejects(inbox.snooze(row.id, other.id, null), NotFoundException);
    await rejects(inbox.snooze(row.id, owner.id, new Date(Date.now() - 1000).toISOString()), BadRequestException);
    await rejects(inbox.snooze(row.id, owner.id, new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString()), BadRequestException);

    // An elapsed snooze reappears automatically.
    await db.update(notifications).set({ snoozedUntil: new Date(Date.now() - 1000) });
    deepEqual(ids(await inbox.findAll(owner.id)), [row.id]);
    equal((await inbox.getUnreadCount(owner.id)).count, 1);

    await inbox.snooze(row.id, owner.id, until);
    equal((await inbox.snooze(row.id, owner.id, null)).snoozedUntil, null);
    deepEqual(ids(await inbox.findAll(owner.id)), [row.id]);
    deepEqual(ids(await inbox.findAll(owner.id, { snoozed: true })), []);
  } finally {
    await postgres.close();
  }
});

test('bulk read/clear leave snoozed notifications alone', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  const marker = randomUUID().replaceAll('-', '').slice(0, 10);
  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: `Bulk ${marker}`, slug: `bulk-${marker}` }).returning();
    const [owner] = await db.insert(users).values({ email: `bulk-${marker}@example.test`, name: 'Owner' }).returning();
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
    const [visible, snoozed, readSnoozed] = await db.insert(notifications).values([
      { userId: owner.id, type: 'mention', title: 'Visible', body: 'b' },
      { userId: owner.id, type: 'mention', title: 'Snoozed', body: 'b', snoozedUntil: new Date(Date.now() + 3_600_000) },
      { userId: owner.id, type: 'mention', title: 'Read snoozed', body: 'b', read: true, snoozedUntil: new Date(Date.now() + 3_600_000) },
    ]).returning();
    const inbox = new NotificationsService({ db });
    equal((await inbox.markAllAsRead(owner.id)).count, 1, 'only the visible notification is marked read');
    const rows = await db.select().from(notifications);
    equal(rows.find((r) => r.id === snoozed.id).read, false, 'snoozed stays unread for when it returns');
    equal((await inbox.clearRead(owner.id)).count, 1, 'clear read removes only the visible read row');
    deepEqual((await db.select().from(notifications)).map((r) => r.id).sort(), [snoozed.id, readSnoozed.id].sort());
    equal(visible.read, false);
  } finally {
    await postgres.close();
  }
});
