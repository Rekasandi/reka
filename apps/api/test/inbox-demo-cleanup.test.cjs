const { deepEqual, doesNotMatch, equal, throws } = require('node:assert/strict');
const { test } = require('node:test');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const migration = readFileSync(resolve(__dirname, '../../../packages/database/drizzle/0002_robust_mole_man.sql'), 'utf8');
const inboxPage = readFileSync(resolve(__dirname, '../../../apps/web/src/features/notifications/components/inbox-page.tsx'), 'utf8');
const inboxApi = readFileSync(resolve(__dirname, '../../../apps/web/src/features/notifications/api/notifications.api.ts'), 'utf8');
const inboxHooks = readFileSync(resolve(__dirname, '../../../apps/web/src/features/notifications/hooks/use-notifications.ts'), 'utf8');
const notificationService = readFileSync(resolve(__dirname, '../src/notifications/notifications.service.ts'), 'utf8');
const authController = readFileSync(resolve(__dirname, '../src/auth/auth.controller.ts'), 'utf8');
const authService = readFileSync(resolve(__dirname, '../src/auth/auth.service.ts'), 'utf8');
const loginPage = readFileSync(resolve(__dirname, '../../../apps/web/src/features/auth/components/login-page.tsx'), 'utf8');
const clientsController = readFileSync(resolve(__dirname, '../src/clients/clients.controller.ts'), 'utf8');
const clientsService = readFileSync(resolve(__dirname, '../src/clients/clients.service.ts'), 'utf8');
const clientsApi = readFileSync(resolve(__dirname, '../../../apps/web/src/features/clients/api/clients.api.ts'), 'utf8');
const clientsHooks = readFileSync(resolve(__dirname, '../../../apps/web/src/features/clients/hooks/use-clients.ts'), 'utf8');
const clientsPage = readFileSync(resolve(__dirname, '../../../apps/web/src/features/clients/components/clients-page.tsx'), 'utf8');
const rootPackage = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'));
const databasePackage = JSON.parse(readFileSync(resolve(__dirname, '../../../packages/database/package.json'), 'utf8'));
const workerModule = readFileSync(resolve(__dirname, '../../../apps/worker/src/worker.module.ts'), 'utf8');
const queueConstants = readFileSync(resolve(__dirname, '../../../apps/worker/src/queues/queue.constants.ts'), 'utf8');
const legacyItems = [
  ['PR #142 Merged: Add optimistic UI updates for Kanban board', 'Gustam merged pull request #142 into main branch. Linked issue RS-42 status has been transitioned to Done automatically.'],
  ['Sarah Jenkins mentioned you on RS-58', '@gustam Could you check the proposed notification preferences schema in the planning doc? We want to support email/in-app toggles.'],
  ['Assigned to RS-64: High-velocity triage inbox', 'You were assigned to RS-64: Build Linear-grade triage inbox with keyboard shortcuts by David Chen.'],
  ['Alex Morgan requested your review on PR #149', 'Implement WebAuthn passkey registration flow and browser biometric credentials support.'],
  ['RS-49 moved to In Review', 'Optimize PostgreSQL egress on cycle queries was transitioned from In Progress to In Review by Gustam.'],
  ['Cycle 12 ends in 2 days', 'Sprint 12 cycle has 4 remaining open issues scheduled before Friday 18:00 UTC.'],
  ['Alex Morgan mentioned you on RS-104', '@gustam Can you check if the optimistic triage shortcuts feel fast?'],
  ['PR #182 Merged: Enhance issue query pagination', 'Pull request #182 was merged by Gustam. Linked issue RS-88 moved to Done.'],
];

test('Inbox has no demo controls or seed fallback', () => {
  doesNotMatch(inboxPage, /demo|dummy|simulate|sample inbox|Alex Morgan|Gustam/i);
  doesNotMatch(inboxApi, /seedDemo|seed-demo|createNotification|simulate/i);
  doesNotMatch(inboxHooks, /seedDemo|useSeedDemo|useCreateNotification/i);
  doesNotMatch(notificationService, /seedDemo|seed-demo|auto-seed/i);
  // Legacy URLs remain explicit but cannot impersonate users or fabricate
  // passkey challenges. HTTP denial is also covered by workspace-identity tests.
  const { AuthController } = require('../dist/auth/auth.controller');
  const legacyAuth = new AuthController(null);
  throws(() => legacyAuth.demoLogin(), error => error.getStatus() === 403);
  throws(() => legacyAuth.getRegistrationOptions(), error => error.getStatus() === 501);
  throws(() => legacyAuth.getLoginOptions(), error => error.getStatus() === 501);
  doesNotMatch(authController, /mock-challenge|loginOrCreateDemoUser/i);
  doesNotMatch(authService, /loginOrCreateDemoUser|mock-challenge/i);
  doesNotMatch(loginPage, /demo-login|Continue with Email|Simulate/i);
  doesNotMatch(clientsController, /seed-demo|seedDemo/i);
  doesNotMatch(clientsService, /seedDemo|sampleClients|auto-seed|fallback default organization/i);
  doesNotMatch(clientsApi, /seed-demo|seedDemo/i);
  doesNotMatch(clientsHooks, /SeedDemo|seedDemo/i);
  doesNotMatch(clientsPage, /Seed Demo|Seed Sample|sample data|generating sample/i);
  equal(existsSync(resolve(__dirname, '../../../packages/database/src/seed/index.ts')), false);
  equal(rootPackage.scripts['db:seed'], undefined);
  equal(databasePackage.scripts['db:seed'], undefined);
  doesNotMatch(workerModule, /NotificationProcessor/);
  doesNotMatch(queueConstants, /NOTIFICATIONS/);
});

test('migration removes known historical Inbox fixture titles and preserves unmatched rows', () => {
  const deleteStatement = migration.split('DELETE FROM "notifications" WHERE')[1];
  if (!deleteStatement) throw new Error('Missing legacy Inbox cleanup.');
  const cleanupTitles = [...deleteStatement.matchAll(/'([^']+)'/g)].map(([, title]) => title);
  deepEqual(cleanupTitles, legacyItems.map(([title]) => title));

  const historicalRows = legacyItems.flatMap(([title, body]) => [
    [title, body],
    [title, `${body} (legacy body variant)`],
  ]);
  historicalRows.push(['Assigned to APP-9', 'Real task assigned by a teammate.']);
  const remaining = historicalRows.filter(([title]) => !cleanupTitles.includes(title));
  deepEqual(remaining, [['Assigned to APP-9', 'Real task assigned by a teammate.']]);
  deepEqual(/\bAND\s+"body"/i.test(deleteStatement), false);
  deepEqual(/\bLIMIT\b/i.test(deleteStatement), false);
});
