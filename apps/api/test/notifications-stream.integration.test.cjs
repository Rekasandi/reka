// Live unread count over SSE: initial value, local changes, worker signals over Redis, snooze wake-up and cleanup.
const { deepEqual, equal } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { notifications, organizations, organizationMembers, users } = require('@reka/database');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { NotificationsService, NOTIFICATIONS_CHANNEL, ISSUES_CHANNEL } = require('../dist/notifications/notifications.service');

const waitFor = async (check, ms = 5000) => { const end = Date.now() + ms; while (!check()) { if (Date.now() > end) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 25)); } };

test('unread count stream pushes on changes, worker signals and snooze expiry, and cleans up on close', { timeout: 90_000 }, async () => {
  const postgres = await createPersistentPostgres();
  const marker = randomUUID().replaceAll('-', '').slice(0, 10);
  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: `Stream ${marker}`, slug: `stream-${marker}` }).returning();
    const [owner] = await db.insert(users).values({ email: `owner-${marker}@example.test`, name: 'Owner' }).returning();
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: owner.id, role: 'owner' });
    const [a, b] = await db.insert(notifications).values([
      { userId: owner.id, type: 'mention', title: 'A', body: 'A' }, { userId: owner.id, type: 'mention', title: 'B', body: 'B' },
    ]).returning();

    const subscriber = Object.assign(new EventEmitter(), { subscribe: async (channel) => { equal(channel, NOTIFICATIONS_CHANNEL); }, disconnect: () => {} });
    const inbox = new NotificationsService({ db }, undefined, { getClient: () => ({ duplicate: () => subscriber }) });
    inbox.onModuleInit();
    const counts = [];
    const subscription = inbox.unreadCountStream(owner.id).subscribe((event) => { if (event.type !== 'ping') counts.push(event.data.count); });

    await waitFor(() => counts.length === 1); equal(counts[0], 2, 'initial count on connect');
    await inbox.markAsRead(a.id, owner.id);
    await waitFor(() => counts.length === 2); equal(counts[1], 1, 'own change pushes');

    await db.insert(notifications).values({ userId: owner.id, type: 'pr_merged', title: 'C', body: 'C' });
    subscriber.emit('message', NOTIFICATIONS_CHANNEL, JSON.stringify([randomUUID()]));
    await new Promise((r) => setTimeout(r, 200)); equal(counts.length, 2, "another user's signal is ignored");
    subscriber.emit('message', NOTIFICATIONS_CHANNEL, JSON.stringify([owner.id]));
    await waitFor(() => counts.length === 3); equal(counts[2], 2, 'worker signal pushes');

    await inbox.snooze(b.id, owner.id, new Date(Date.now() + 1500).toISOString());
    await waitFor(() => counts.length === 4); equal(counts[3], 1, 'snoozed row leaves the count');
    await waitFor(() => counts.length === 5, 6000); equal(counts[4], 2, 'it comes back when the snooze ends, without polling');

    subscription.unsubscribe();
    equal(inbox.unreadChanged.listenerCount('changed'), 0, 'closing the stream removes its listener');
    await inbox.markAsRead(b.id, owner.id);
    deepEqual(counts, [2, 1, 2, 1, 2], 'nothing is pushed after close');
    inbox.onModuleDestroy();
  } finally {
    await postgres.close();
  }
});

test('live issue events reach other viewers of the team only, coalesced, never the actor', { timeout: 90_000 }, async () => {
  const { teams, teamMembers } = require('@reka/database');
  const postgres = await createPersistentPostgres();
  const marker = randomUUID().replaceAll('-', '').slice(0, 8);
  try {
    const db = postgres.db;
    const [org, otherOrg] = await db.insert(organizations).values([{ name: `Live ${marker}`, slug: `live-${marker}` }, { name: `Other ${marker}`, slug: `other-${marker}` }]).returning();
    const [actor, viewer, outsider] = await db.insert(users).values([
      { email: `a-${marker}@example.test`, name: 'Actor' }, { email: `v-${marker}@example.test`, name: 'Viewer' }, { email: `x-${marker}@example.test`, name: 'Outsider' },
    ]).returning();
    await db.insert(organizationMembers).values([
      { organizationId: org.id, userId: actor.id, role: 'member' }, { organizationId: org.id, userId: viewer.id, role: 'member' }, { organizationId: otherOrg.id, userId: outsider.id, role: 'member' },
    ]);
    const [open, secret] = await db.insert(teams).values([
      { organizationId: org.id, name: 'Open', key: `O${marker.slice(0, 4).toUpperCase()}` },
      { organizationId: org.id, name: 'Secret', key: `S${marker.slice(0, 4).toUpperCase()}`, isPrivate: true },
    ]).returning();
    await db.insert(teamMembers).values([{ teamId: open.id, userId: actor.id, role: 'lead' }, { teamId: secret.id, userId: actor.id, role: 'lead' }]);
    const inbox = new NotificationsService({ db });
    const events = { actor: [], viewer: [], outsider: [] };
    const subs = Object.entries({ actor, viewer, outsider }).map(([name, user]) => inbox.unreadCountStream(user.id).subscribe((event) => { if (event.type === 'issues') events[name].push(event.data.teamId); }));
    await new Promise((r) => setTimeout(r, 300));

    for (let i = 0; i < 5; i += 1) inbox.issuesChanged(org.id, open.id, actor.id); // a bulk edit
    await waitFor(() => events.viewer.length === 1);
    await new Promise((r) => setTimeout(r, 400));
    deepEqual(events.viewer, [open.id], 'one coalesced event for the burst');
    deepEqual(events.actor, [], 'the actor already has fresh data');
    deepEqual(events.outsider, [], 'other workspaces hear nothing');

    inbox.issuesChanged(org.id, secret.id, actor.id);
    await new Promise((r) => setTimeout(r, 500));
    deepEqual(events.viewer, [open.id], 'private team changes stay with its members');

    // Worker changes (GitHub events, auto-close/archive) arrive over Redis.
    const redisSub = Object.assign(new (require('node:events').EventEmitter)(), { subscribe: async () => {}, disconnect: () => {} });
    const relay = new NotificationsService({ db }, undefined, { getClient: () => ({ duplicate: () => redisSub }) });
    relay.onModuleInit();
    const relayed = { viewer: [], outsider: [] };
    const relaySubs = [['viewer', viewer], ['outsider', outsider]].map(([name, user]) => relay.unreadCountStream(user.id).subscribe((event) => { if (event.type === 'issues') relayed[name].push(1); }));
    await new Promise((r) => setTimeout(r, 300));
    redisSub.emit('message', ISSUES_CHANNEL, JSON.stringify({ organizationId: org.id }));
    await waitFor(() => relayed.viewer.length === 1); await new Promise((r) => setTimeout(r, 400));
    deepEqual([relayed.viewer.length, relayed.outsider.length], [1, 0], 'worker signal reaches only its workspace');
    redisSub.emit('message', ISSUES_CHANNEL, JSON.stringify({ organizationId: null }));
    await waitFor(() => relayed.outsider.length === 1);
    relaySubs.forEach((sub) => sub.unsubscribe()); relay.onModuleDestroy();

    subs.forEach((sub) => sub.unsubscribe());
    equal(inbox.unreadChanged.listenerCount('issues'), 0, 'closing streams removes issue listeners');
  } finally { await postgres.close(); }
});
