const { equal, ok, notEqual } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, teamWorkflowStates, sessions, issues, comments, activities, notifications, attachments, issueSubscriptions, notificationPreferences } = require('@reka/database');
const { CommentsModule } = require('../dist/comments/comments.module');
const { AttachmentsModule } = require('../dist/attachments/attachments.module');
const { IssuesModule } = require('../dist/issues/issues.module');
const { NotificationsModule } = require('../dist/notifications/notifications.module');
const { ActivitiesModule } = require('../dist/activities/activities.module');
const { IssueSubscriptionsModule } = require('../dist/issue-subscriptions/issue-subscriptions.module');
const { UsersModule } = require('../dist/users/users.module');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

const DISABLED_PREFERENCES = { comments: false, mentions: false, assignments: false, issueUpdates: false, projectUpdates: false, github: false, teamInvites: false };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

test('collaboration HTTP enforces scoped comments, mentions, subscriptions, preferences and stored attachments', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  try {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
    const [org, foreignOrg] = await postgres.db.insert(organizations).values([
      { name: 'Collaboration company', slug: `collab-${suffix}` },
      { name: 'Foreign company', slug: `foreign-${suffix}` },
    ]).returning();
    const [owner, member, intraworkspace, legacyClient, foreignUser] = await postgres.db.insert(users).values([
      { name: 'Collaboration Owner', email: `collab-owner-${suffix}@example.test`, role: 'owner', githubUsername: 'collab-owner' },
      { name: 'Pat Person', email: `pat-${suffix}@example.test`, role: 'member', githubUsername: 'pat-dev' },
      { name: 'Private Outsider', email: `private-outsider-${suffix}@example.test`, role: 'member', githubUsername: 'private-outsider' },
      { name: 'Legacy Client', email: `legacy-client-${suffix}@example.test`, role: 'client' },
      { name: 'Foreign User', email: `foreign-${suffix}@example.test`, role: 'owner' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' }, { organizationId: org.id, userId: member.id, role: 'member' },
      { organizationId: org.id, userId: intraworkspace.id, role: 'member' }, { organizationId: org.id, userId: legacyClient.id, role: 'client' },
      { organizationId: foreignOrg.id, userId: foreignUser.id, role: 'owner' },
    ]);
    const [team, privateTeam] = await postgres.db.insert(teams).values([
      { organizationId: org.id, name: 'Public collaboration', key: `COL${suffix.slice(0, 4)}` },
      { organizationId: org.id, name: 'Private collaboration', key: `PRV${suffix.slice(0, 4)}`, isPrivate: true },
    ]).returning();
    await postgres.db.insert(teamMembers).values([
      { teamId: team.id, userId: owner.id, role: 'lead' }, { teamId: team.id, userId: member.id, role: 'member' },
      { teamId: privateTeam.id, userId: owner.id, role: 'lead' },
    ]);
    await postgres.db.insert(teamWorkflowStates).values([
      { teamId: team.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#777777', position: 0 },
      { teamId: team.id, key: 'doing', name: 'In progress', category: 'started', color: '#777777', position: 1 },
      { teamId: team.id, key: 'done', name: 'Done', category: 'completed', color: '#777777', position: 2 },
      { teamId: team.id, key: 'backlog', name: 'Backlog', category: 'backlog', color: '#777777', position: 3 },
      { teamId: privateTeam.id, key: 'todo', name: 'Todo', category: 'unstarted', color: '#777777', position: 0 },
    ]);
    const [issue, privateIssue] = await postgres.db.insert(issues).values([
      { identifier: `${team.key}-1`, number: 1, title: 'Public collaboration issue', teamId: team.id, reporterId: owner.id, assigneeId: member.id, status: 'todo' },
      { identifier: `${privateTeam.key}-1`, number: 1, title: 'Secret private issue', teamId: privateTeam.id, reporterId: owner.id, status: 'todo' },
    ]).returning();
    const legacyAttachmentId = randomUUID();
    await postgres.db.insert(attachments).values({ id: legacyAttachmentId, issueId: issue.id, uploaderId: legacyClient.id, fileName: 'legacy-client-file.txt', fileSize: 1, mimeType: 'text/plain', url: `/api/attachments/${legacyAttachmentId}/download`, content: Buffer.from('x') });
    const tokens = new Map();
    for (const user of [owner, member, intraworkspace, legacyClient, foreignUser]) {
      const token = randomUUID(); tokens.set(user.id, token);
      await postgres.db.insert(sessions).values({ id: token, userId: user.id, expiresAt: new Date(Date.now() + 86400000) });
    }
    api = await createIsolatedApi(postgres, [CommentsModule, AttachmentsModule, IssuesModule, NotificationsModule, ActivitiesModule, IssueSubscriptionsModule, UsersModule]);
    const request = (user, path, method = 'GET', body, headers = {}) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${tokens.get(user.id)}`, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });

    const mention = await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'Please review with @pat-dev' });
    equal(mention.status, 201, await mention.clone().text());
    const firstComment = await mention.json();
    equal(firstComment.authorId, owner.id);
    const initialNotifications = await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id));
    equal(initialNotifications.length, 1); equal(initialNotifications[0].type, 'mention');
    equal((await request(member, `/comments/by-issue/${issue.id}`)).status, 200);
    equal((await request(member, `/comments/by-issue/${privateIssue.id}`)).status, 404, 'private issue comments require team membership');
    await postgres.db.insert(notifications).values({ userId: intraworkspace.id, type: 'comment', title: 'Stale private content', body: 'Must be hidden after access checks', metadata: { issueId: privateIssue.id } });
    equal((await (await request(intraworkspace, '/notifications')).json()).length, 0, 'notification reads re-check current private-team access');
    equal((await request(intraworkspace, `/issues/${privateIssue.id}/subscription`, 'POST')).status, 404);
    equal((await request(intraworkspace, `/attachments/by-issue/${privateIssue.id}`)).status, 404);
    equal((await request(foreignUser, `/comments/by-issue/${issue.id}`)).status, 404, 'company data is isolated without a cross-company existence leak');
    equal((await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: '   ' })).status, 400);
    equal((await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'x'.repeat(50001) })).status, 400);
    equal((await request(intraworkspace, `/comments/by-issue/${issue.id}`, 'POST', { body: 'Not a team member' })).status, 403, 'public read access does not grant write permission to non-team members');
    equal((await request(legacyClient, `/comments/by-issue/${issue.id}`)).status, 200, 'legacy client can read accessible team comments');
    equal((await request(legacyClient, `/comments/by-issue/${issue.id}`, 'POST', { body: 'Read only' })).status, 403);
    equal((await request(legacyClient, `/attachments/${legacyAttachmentId}/download`)).status, 200, 'legacy client can download files on readable public issues');
    equal((await request(legacyClient, `/attachments/${legacyAttachmentId}`, 'DELETE')).status, 403, 'legacy read-only uploader cannot delete a shared file');

    const updateDenied = await request(member, `/comments/${firstComment.id}`, 'PATCH', { body: 'Changed by another member' });
    equal(updateDenied.status, 403, 'only the author or an accessible workspace administrator edits a comment');
    const edited = await request(owner, `/comments/${firstComment.id}`, 'PATCH', { body: 'Please review with @pat-dev — edited' });
    equal(edited.status, 200); equal((await edited.json()).body, 'Please review with @pat-dev — edited');
    ok((await postgres.db.select().from(activities).where(eq(activities.issueId, issue.id))).some(row => row.type === 'issue.comment_updated'));

    const subscribe = await request(member, `/issues/${issue.id}/subscription`, 'POST');
    equal(subscribe.status, 201); equal((await subscribe.json()).subscribed, true);
    equal((await request(member, `/issues/${issue.id}/subscription`, 'POST')).status, 201, 'duplicate follow is idempotent');
    equal((await postgres.db.select().from(issueSubscriptions).where(and(eq(issueSubscriptions.issueId, issue.id), eq(issueSubscriptions.userId, member.id)))).length, 1);
    const subscriberComment = await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'A new note for followers' });
    equal(subscriberComment.status, 201);
    let memberNotifications = await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id));
    equal(memberNotifications.length, 2); equal(memberNotifications.filter(row => row.type === 'comment').length, 1);
    equal((await (await request(member, '/notifications?type=mention&read=false')).json()).length, 1);
    equal((await (await request(member, '/notifications?type=comment')).json()).length, 1);
    const statusChange = await request(owner, `/issues/${issue.id}`, 'PATCH', { status: 'doing' });
    equal(statusChange.status, 200);
    memberNotifications = await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id));
    equal(memberNotifications.filter(row => row.type === 'status_change').length, 1, 'subscribers receive issue status transitions');

    const preferenceGet = await request(member, '/notifications/preferences');
    equal(preferenceGet.status, 200); equal((await preferenceGet.json()).comments, true, 'default categories are enabled');
    const preferencesSaved = await request(member, '/notifications/preferences', 'PUT', DISABLED_PREFERENCES);
    equal(preferencesSaved.status, 200); equal((await preferencesSaved.json()).comments, false);
    equal((await postgres.db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, member.id))).length, 1);
    equal((await request(member, '/notifications/preferences', 'PUT', { ...DISABLED_PREFERENCES, surprise: true })).status, 400, 'unknown preference fields are rejected');
    await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'A second note for followers' });
    await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'Mention ignored by preference @pat-dev' });
    await request(owner, `/issues/${issue.id}`, 'PATCH', { status: 'done' });
    memberNotifications = await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id));
    equal(memberNotifications.length, 3, 'comment, mention and issue-update preferences are honored');
    await request(member, '/notifications/mark-all-read', 'POST');
    memberNotifications = await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id));
    ok(memberNotifications.every(row => row.read), 'read state persists');
    equal((await request(member, '/notifications/unread-count')).status, 200);
    await request(member, '/notifications/preferences', 'PUT', { ...DISABLED_PREFERENCES, comments: true });
    await postgres.db.update(issues).set({ assigneeId: null }).where(eq(issues.id, issue.id));
    equal((await request(member, `/issues/${issue.id}/subscription`, 'DELETE')).status, 200);
    const subscriptionAfterLeave = await (await request(member, `/issues/${issue.id}/subscription`)).json();
    equal(subscriptionAfterLeave.subscribed, false);
    equal((await postgres.db.select().from(issueSubscriptions).where(eq(issueSubscriptions.issueId, issue.id))).length, 0);
    await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'No longer followed' });
    equal((await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id))).length, 3, 'unfollowed, unassigned members no longer receive subscriber comments');

    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), '../../private image.png');
    const uploaded = await request(owner, `/attachments/by-issue/${issue.id}`, 'POST', form);
    equal(uploaded.status, 201, await uploaded.clone().text());
    const attachment = await uploaded.json();
    equal(attachment.fileName, 'private image.png'); equal(attachment.fileSize, png.length);
    equal(attachment.url, `/api/attachments/${attachment.id}/download`, 'no public/object URL is exposed');
    const listing = await request(member, `/attachments/by-issue/${issue.id}`);
    equal(listing.status, 200); const listedFiles = await listing.json(); equal(listedFiles.length, 2); equal(listedFiles.find(file => file.id === attachment.id).canDelete, false);
    const download = await request(member, attachment.url.replace('/api', ''));
    equal(download.status, 200); equal(download.headers.get('x-content-type-options'), 'nosniff'); equal(download.headers.get('cache-control'), 'private, no-store');
    equal(Buffer.compare(Buffer.from(await download.arrayBuffer()), png), 0, 'download returns the authenticated stored bytes');
    equal((await request(intraworkspace, attachment.url.replace('/api', ''))).status, 200, 'public team attachments are visible to active workspace members');
    equal((await request(member, `/attachments/${attachment.id}`, 'DELETE')).status, 403, 'another member cannot delete an upload');
    const badForm = new FormData(); badForm.append('file', new Blob(['not a png'], { type: 'image/png' }), 'spoof.png');
    equal((await request(owner, `/attachments/by-issue/${issue.id}`, 'POST', badForm)).status, 400, 'declared MIME must match file signature');
    const privateForm = new FormData(); privateForm.append('file', new Blob([png], { type: 'image/png' }), 'private.png');
    const privateUpload = await request(owner, `/attachments/by-issue/${privateIssue.id}`, 'POST', privateForm);
    equal(privateUpload.status, 201);
    const privateAttachment = await privateUpload.json();
    equal((await request(intraworkspace, `/attachments/by-issue/${privateIssue.id}`)).status, 404);
    equal((await request(intraworkspace, privateAttachment.url.replace('/api', ''))).status, 404);
    equal((await request(owner, `/attachments/${attachment.id}`, 'DELETE')).status, 200);
    equal((await postgres.db.select().from(attachments).where(eq(attachments.id, attachment.id))).length, 0);
    const oversizedForm = new FormData(); oversizedForm.append('file', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'too-large.png');
    equal((await request(owner, `/attachments/by-issue/${issue.id}`, 'POST', oversizedForm)).status, 413, 'multipart parser rejects uploads larger than 5 MiB');
    ok((await postgres.db.select().from(activities).where(eq(activities.issueId, issue.id))).some(row => row.type === 'issue.attachment_uploaded'));

    // Unsubscribed users stop receiving subscriber events. Existing notifications remain private and durable.
    const lastComment = await request(owner, `/comments/by-issue/${issue.id}`, 'POST', { body: 'No longer followed' });
    equal(lastComment.status, 201);
    equal((await request(member, `/comments/${firstComment.id}`, 'DELETE')).status, 403);
    const deleteComment = await request(owner, `/comments/${firstComment.id}`, 'DELETE');
    equal(deleteComment.status, 200);
    equal((await request(owner, `/comments/by-issue/${issue.id}`)).status, 200);
    await postgres.reopen();
    equal((await postgres.db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, member.id)))[0].preferences.comments, true);
    equal((await postgres.db.select().from(issues).where(eq(issues.id, issue.id))).length, 1);
    const [persistedPrivateAttachment] = await postgres.db.select().from(attachments).where(eq(attachments.id, privateAttachment.id));
    equal(Buffer.compare(Buffer.from(persistedPrivateAttachment.content), png), 0, 'private attachment bytes persist across database reopen');
    notEqual((await postgres.db.select().from(notifications).where(eq(notifications.userId, member.id))).length, 0);
  } finally { await api?.close(); await postgres.close(); }
});
