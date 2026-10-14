const { equal, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { AuthGuard } = require('../dist/auth/auth.guard');

function context(path, request = {}) {
  return { switchToHttp: () => ({ getRequest: () => ({ path, cookies: {}, headers: {}, ...request }) }) };
}

test('auth/me requires a valid session while GitHub OAuth entry points stay public', async () => {
  const guard = new AuthGuard({});
  await rejects(guard.canActivate(context('/api/auth/me')), (error) => error.getStatus() === 401);
  equal(await guard.canActivate(context('/api/auth/github')), true);
  equal(await guard.canActivate(context('/api/auth/github/callback')), true);
});
