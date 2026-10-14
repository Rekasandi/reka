// Run against `pnpm dev:web`: node apps/web/test/team-icon-picker.mjs
// API responses are mocked; this checks team-key marks without updating data.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const teams = [
    { id: 't1', name: 'Engineering', key: 'ENG', description: 'Platform team', memberCount: 5, issueCount: 12, icon: 'CodeXml' },
    { id: 't2', name: 'Tools', key: 'T', description: 'Internal tooling', memberCount: 2, issueCount: 3, icon: null },
  ];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/teams' && route.request().method() === 'GET') return route.fulfill({ json: teams });
    throw new Error(`Unexpected API request ${route.request().method()} ${path}`);
  });
  await page.route('**/src/app/main.tsx*', async route => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { TeamsPage } from '/src/features/teams/components/teams-page.tsx';
      import '/src/styles/globals.css';
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(MemoryRouter, { initialEntries: ['/teams'] },
            React.createElement(Routes, null, React.createElement(Route, { path: '/teams', element: React.createElement(TeamsPage) }))
          )
        )
      );
    ` });
  });
  await page.goto(process.env.WEB_URL || 'http://localhost:5173');
  for (const [name, key] of [['Engineering', 'ENG'], ['Tools', 'T']]) {
    const row = page.getByRole('link', { name: `Open team ${name}`, exact: true }).locator('xpath=../..');
    await row.locator('span[aria-hidden="true"]').getByText(key, { exact: true }).waitFor();
  }
  assert.equal(await page.getByRole('button', { name: /Change team icon/ }).count(), 0);
  assert.equal(await page.locator('svg.lucide-building-2').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: Team logo marks display the team key and ignore saved Lucide icon values.');
} finally {
  await browser.close();
}
