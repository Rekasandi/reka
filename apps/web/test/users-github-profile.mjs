// Run against `pnpm dev:web`: node apps/web/test/users-github-profile.mjs
// Requires Playwright or PLAYWRIGHT_MODULE; API requests are mocked.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/workspace') return route.fulfill({ json: { id: 'workspace', name: 'Company', slug: 'company', role: 'member' } });
    if (path === '/api/users') return route.fulfill({ json: [
      { id: 'u1', name: 'Gustav', email: 'gustav@example.com', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4', githubUsername: 'gustav-dev', role: 'member' },
      { id: 'u2', name: 'No GitHub', email: 'user@example.com', avatarUrl: null, githubUsername: null, role: 'member' },
    ] });
    throw new Error(`Unexpected API request ${path}`);
  });
  await page.route('**/src/app/main.tsx*', async (route) => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { UsersPage } from '/src/features/users/components/users-page.tsx';
      import '/src/styles/globals.css';
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(MemoryRouter, { initialEntries: ['/users'] },
            React.createElement(Routes, null, React.createElement(Route, { path: '/users', element: React.createElement(UsersPage) }))
          )
        )
      );
    ` });
  });
  await page.goto(process.env.WEB_URL || 'http://localhost:5173/users');
  const profile = page.getByRole('link', { name: 'GitHub profile for Gustav' });
  await profile.waitFor();
  assert.equal(await profile.getAttribute('href'), 'https://github.com/gustav-dev');
  assert.equal(await profile.getAttribute('target'), '_blank');
  assert.equal(await page.locator('img[alt="Gustav"]').getAttribute('src'), 'https://avatars.githubusercontent.com/u/1?v=4');
  assert.equal(await page.getByRole('link', { name: 'GitHub profile for No GitHub' }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: GitHub profile URL and avatar render when available, absent data stays hidden, mobile layout has no horizontal overflow.');
} finally {
  await browser.close();
}
