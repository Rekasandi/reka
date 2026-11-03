// SMTP-backed features (workspace invitation emails, opt-in notification emails) through real Nest HTTP + isolated Postgres.
// The mail transport is replaced by an in-memory recorder: no network and no real email is sent.
const { equal, ok, match, doesNotMatch } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, sessions } = require('@reka/database');
const { WorkspaceModule } = require('../dist/workspace/workspace.module');
const { NotificationsModule } = require('../dist/notifications/notifications.module');
const { MailModule } = require('../dist/mail/mail.module');
const { MailService } = require('../dist/mail/mail.service');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { invitationEmail, notificationEmail } = require('../dist/mail/mail-templates');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');
const { createIsolatedApi } = require('./support/isolated-api.cjs');

const until = async (check) => { for (let i = 0; i < 50; i += 1) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); } };

test('invitation and notification emails are sent only when configured, requested and opted in', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  let api;
  const previousWebUrl = process.env.WEB_URL;
  process.env.WEB_URL = 'https://app.example.test';
  try {
    const mail = { configured: true, fail: false, sent: [], isConfigured() { return this.configured; },
      async send(to, content) { if (this.fail) return { sent: false, error: 'Email delivery failed' }; this.sent.push({ to, content }); return { sent: true }; } };
    const [org] = await postgres.db.insert(organizations).values({ name: 'Acme <script>alert(1)</script>', slug: `mail-${randomUUID().slice(0, 8)}` }).returning();
    const [admin, member] = await postgres.db.insert(users).values([
      { name: 'Ada "Admin" <b>', email: `admin-${randomUUID().slice(0, 6)}@example.test`, role: 'member' },
      { name: 'Mia Member', email: `member-${randomUUID().slice(0, 6)}@example.test`, role: 'member' },
    ]).returning();
    await postgres.db.insert(organizationMembers).values([
      { organizationId: org.id, userId: admin.id, role: 'admin' }, { organizationId: org.id, userId: member.id, role: 'member' },
    ]);
    const tokens = {};
    for (const user of [admin, member]) { tokens[user.id] = randomUUID(); await postgres.db.insert(sessions).values({ id: tokens[user.id], userId: user.id, expiresAt: new Date(Date.now() + 60_000) }); }
    api = await createIsolatedApi(postgres, [MailModule, WorkspaceModule, NotificationsModule], [[MailService, mail]]);
    const request = (user, path, method = 'GET', body) => fetch(`${api.url}/api${path}`, {
      method, headers: { Authorization: `Bearer ${tokens[user.id]}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    // --- Invitations ---
    const invitee = `new-${randomUUID().slice(0, 6)}@example.test`;
    equal((await request(member, '/workspace/invitations', 'POST', { email: invitee })).status, 403);
    equal(mail.sent.length, 0, 'forbidden invites send nothing');

    const created = await request(admin, '/workspace/invitations', 'POST', { email: invitee, role: 'member' });
    equal(created.status, 201, await created.clone().text());
    const invite = await created.json();
    equal(invite.emailSent, true);
    equal(mail.sent.length, 1);
    equal(mail.sent[0].to, invitee);
    ok(invite.url.startsWith('https://app.example.test/login?invite='), 'link uses WEB_URL');
    ok(mail.sent[0].content.text.includes(invite.url) && mail.sent[0].content.html.includes(invite.url.replaceAll('&', '&amp;')), 'email carries the invitation link');
    doesNotMatch(mail.sent[0].content.html, /<script>|<b>/, 'workspace/inviter names are HTML-escaped');
    match(mail.sent[0].content.html, /&lt;script&gt;/);

    const noEmail = await (await request(admin, '/workspace/invitations', 'POST', { email: `quiet-${randomUUID().slice(0, 6)}@example.test`, sendEmail: false })).json();
    equal(noEmail.emailSent, false); ok(noEmail.url); equal(mail.sent.length, 1, 'sendEmail:false sends nothing');

    mail.configured = false;
    const unconfigured = await (await request(admin, '/workspace/invitations', 'POST', { email: `unconf-${randomUUID().slice(0, 6)}@example.test` })).json();
    equal(unconfigured.emailSent, false); equal(unconfigured.emailError, 'Email is not configured'); ok(unconfigured.url, 'link still returned');
    mail.configured = true; mail.fail = true;
    const failed = await request(admin, '/workspace/invitations', 'POST', { email: `fail-${randomUUID().slice(0, 6)}@example.test` });
    equal(failed.status, 201, 'a mail failure never fails the invitation');
    const failedBody = await failed.json(); equal(failedBody.emailSent, false); ok(failedBody.url);
    mail.fail = false;

    // --- Notification emails are opt-in ---
    const notifications = api.app.get(NotificationsService);
    const before = mail.sent.length;
    await notifications.createForEvent(member.id, { type: 'assignment', title: 'Assigned to ENG-1', body: 'You were assigned to "Fix <login>"', link: '/issues/abc' });
    await new Promise(resolve => setTimeout(resolve, 100));
    equal(mail.sent.length, before, 'no email until the user opts in');

    const prefs = { comments: true, mentions: true, assignments: true, issueUpdates: true, projectUpdates: true, github: true, teamInvites: true };
    equal((await request(member, '/notifications/preferences', 'PUT', { ...prefs, emailNotifications: true })).status, 200);
    equal((await (await request(member, '/notifications/preferences')).json()).emailNotifications, true);
    await notifications.createForEvent(member.id, { type: 'assignment', title: 'Assigned to ENG-2', body: 'You were assigned to "Fix <login>"', link: '/issues/def' });
    await until(() => mail.sent.length > before);
    equal(mail.sent.length, before + 1);
    const notice = mail.sent.at(-1);
    equal(notice.to, member.email); equal(notice.content.subject, 'Assigned to ENG-2');
    match(notice.content.text, /https:\/\/app\.example\.test\/issues\/def/);
    doesNotMatch(notice.content.html, /<login>/); match(notice.content.html, /&lt;login&gt;/);

    // Saving without the flag keeps the choice; a category turned off suppresses the email.
    equal((await request(member, '/notifications/preferences', 'PUT', prefs)).status, 200);
    equal((await (await request(member, '/notifications/preferences')).json()).emailNotifications, true);
    equal((await request(member, '/notifications/preferences', 'PUT', { ...prefs, assignments: false })).status, 200);
    await notifications.createForEvent(member.id, { type: 'assignment', title: 'Assigned to ENG-3', body: 'x', link: '/issues/ghi' });
    await new Promise(resolve => setTimeout(resolve, 100));
    equal(mail.sent.length, before + 1, 'disabled categories send no email');

    // Opting out stops emails; an unconfigured server never throws.
    equal((await request(member, '/notifications/preferences', 'PUT', { ...prefs, emailNotifications: false })).status, 200);
    mail.configured = false;
    await notifications.createForEvent(member.id, { type: 'mention', title: 'Mentioned', body: 'x' });
    await new Promise(resolve => setTimeout(resolve, 100));
    equal(mail.sent.length, before + 1);
  } finally {
    if (previousWebUrl === undefined) delete process.env.WEB_URL; else process.env.WEB_URL = previousWebUrl;
    if (api) await api.close();
    await postgres.close();
  }
});

test('email templates escape content and keep headers single-line', () => {
  const invite = invitationEmail({ inviterName: 'A\r\nBcc: x@evil.test', workspaceName: 'W', role: 'member', url: 'https://x.test/login?invite=a&b=c', expiresAt: new Date('2030-01-01T00:00:00Z') });
  doesNotMatch(invite.subject, /[\r\n]/);
  match(invite.html, /invite=a&amp;b=c/);
  const notice = notificationEmail({ title: 'Line1\nLine2', body: '<img src=x onerror=1>', preferencesUrl: 'https://x.test/inbox' });
  doesNotMatch(notice.subject, /[\r\n]/); doesNotMatch(notice.html, /<img/);
});
