const { equal, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { AuthGuard } = require('../dist/auth/auth.guard');

// The session middleware fills userId/workspace; the guard only enforces them.
function context(path, request = {}) {
  return { switchToHttp: () => ({ getRequest: () => ({ path, method: 'GET', cookies: {}, headers: {}, ...request }) }) };
}
const workspace = { userId: 'u1', organizationId: 'o1', role: 'member' };

test('guard: public routes, sign-in, workspace selection, CSRF origin and read-only roles', async () => {
  const guard = new AuthGuard();
  equal(await guard.canActivate(context('/api/health')), true);
  equal(await guard.canActivate(context('/api/auth/sign-in/email', { method: 'POST' })), true);
  equal(await guard.canActivate(context('/api/auth/organization/create', { method: 'POST' })), true);
  equal(await guard.canActivate(context('/api/integrations/github/webhook', { method: 'POST' })), true);
  await rejects(guard.canActivate(context('/api/teams')), (error) => error.getStatus() === 401, 'no session');
  await rejects(guard.canActivate(context('/api/teams', { userId: 'u1' })), (error) => error.getStatus() === 403, 'signed in without a workspace');
  equal(await guard.canActivate(context('/api/teams', { userId: 'u1', workspace })), true);
  await rejects(guard.canActivate(context('/api/teams', { method: 'POST', userId: 'u1', workspace, authViaCookie: true, headers: { origin: 'https://evil.example' } })), (error) => error.getStatus() === 403, 'cookie write from another origin');
  equal(await guard.canActivate(context('/api/teams', { method: 'POST', userId: 'u1', workspace, authViaCookie: true, headers: { origin: 'http://localhost:5173' } })), true);
  equal(await guard.canActivate(context('/api/teams', { method: 'POST', userId: 'u1', workspace })), true, 'bearer writes need no origin');
  await rejects(guard.canActivate(context('/api/teams', { method: 'POST', userId: 'u1', workspace: { ...workspace, role: 'guest' } })), (error) => error.getStatus() === 403, 'read-only role cannot write');
  equal(await guard.canActivate(context('/api/notifications/n1/read', { method: 'PATCH', userId: 'u1', workspace: { ...workspace, role: 'guest' } })), true, 'own inbox stays writable');
});
