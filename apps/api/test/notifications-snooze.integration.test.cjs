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
