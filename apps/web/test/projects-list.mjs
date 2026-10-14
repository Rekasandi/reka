// Run against `pnpm dev:web`: node apps/web/test/projects-list.mjs
// Requires Playwright or PLAYWRIGHT_MODULE; all APIs are mocked.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
  const statuses = ['in_progress', 'planned', 'paused', 'completed', 'canceled'];
  const projects = statuses.map((status, index) => ({
    id: `p${index}`, teamId: 't1', ownerId: 'u1', icon: index === 0 ? 'Building2' : null, name: `${status} project`,
    description: 'Project description with enough detail to check truncation on smaller screens.',
    status, health: ['on_track', 'at_risk', 'off_track'][index % 3],
    progress: index * 25, completedIssues: index, totalIssues: 4,
    targetDate: index ? null : '2026-12-15',
    repositories: index ? [] : [{ name: 'reka-platform', fullName: 'team/reka-platform' }, { name: 'web', fullName: 'team/web' }],
  }));
  projects[0].description = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Structured project summary', marks: [{ type: 'bold' }] }] }] });
  projects.push({ ...projects[0], id: 'other', teamId: 'other-team', name: 'Outside team scope' });
  const updates = [];
  let fail = false;
  let delay = 0;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/users') return route.fulfill({ json: [{ id: 'u1', name: 'Test Owner', avatarUrl: null }] });
    if (path === '/api/projects' && route.request().method() === 'GET') {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return route.fulfill({ status: fail ? 500 : 200, json: fail ? {} : projects });
    }
    if (path.startsWith('/api/projects/') && route.request().method() === 'PATCH') {
      const id = path.split('/').at(-1);
      const data = route.request().postDataJSON();
      updates.push({ id, data });
      const updated = { ...projects.find((project) => project.id === id), ...data };
      Object.assign(projects.find((project) => project.id === id), data);
      return route.fulfill({ json: updated });
    }
    if (path === '/api/teams') return route.fulfill({ json: [{ id: 't1', name: 'Test Team', key: 'T' }] });
    throw new Error(`Unexpected request ${path}`);
  });
  await page.route('**/src/app/main.tsx*', async (route) => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route, useLocation } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { ProjectsPage } from '/src/features/projects/components/projects-page.tsx';
      import '/src/styles/globals.css';
      function Detail() { const location = useLocation(); return React.createElement('p', null, location.pathname + location.search); }
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(MemoryRouter, { initialEntries: ['/projects?teamId=t1'] },
            React.createElement('div', { className: 'p-6' },
              React.createElement(Routes, null,
                React.createElement(Route, { path: '/projects', element: React.createElement(ProjectsPage) }),
                React.createElement(Route, { path: '/projects/:id', element: React.createElement(Detail) })
              )
            )
          )
        )
      );
    ` });
  });
  const url = process.env.WEB_URL || 'http://localhost:5173';
  delay = 700;
  await page.goto(url);
  await page.getByRole('status', { name: 'Loading projects' }).waitFor();
  await page.getByRole('link', { name: 'Open project in_progress project', exact: true }).waitFor();
  delay = 0;
  assert.equal(await page.getByRole('table').count(), 1);
  assert.equal(await page.getByRole('rowgroup').nth(1).getByRole('row').count(), 5);
  assert.deepEqual(await page.getByRole('columnheader').allTextContents(), ['Name', 'Health', 'Lead', 'Target date', 'Issues', 'Status']);
  assert.equal(await page.getByText('Structured project summary', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Project description with enough detail to check truncation on smaller screens.', { exact: true }).count(), 0);
  assert.equal(await page.getByText('"type":"doc"', { exact: false }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Open project Outside team scope' }).count(), 0);
  assert.equal(await page.locator('[data-slot="card"]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Change project icon', exact: true }).count(), 0);
  assert.equal(await page.locator('svg[class*="lucide-building"]').count(), 0);
  for (const [label, name] of [['Active', 'in_progress'], ['Planned', 'planned'], ['Completed', 'completed']]) {
    const filter = page.getByRole('button', { name: new RegExp(`^${label}`) });
    await filter.click();
    assert.equal(await page.getByRole('link').count(), 1);
    assert.equal(await filter.getAttribute('aria-pressed'), 'true');
    await page.getByRole('link', { name: `Open project ${name} project`, exact: true }).waitFor();
  }
  await page.getByRole('button', { name: /^All/ }).click();
  assert.equal(await page.getByRole('link').count(), 5);
  await page.screenshot({ path: '/tmp/reka-projects-list-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '/tmp/reka-projects-list-mobile.png' });
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await page.getByRole('dialog', { name: 'New Project' }).waitFor();
  await page.keyboard.press('Escape');
  const project = page.getByRole('link', { name: 'Open project in_progress project', exact: true });
  await project.focus();
  await page.keyboard.press('Enter');
  await page.getByText('/projects/p0?teamId=t1', { exact: true }).waitFor();

  fail = true;
  await page.goto(url);
  await page.getByRole('alert').filter({ hasText: 'Failed to load projects' }).waitFor();
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('link', { name: 'Open project in_progress project', exact: true }).waitFor();
  projects.length = 0;
  await page.goto(url);
  await page.getByText(/No matching projects/).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: project table, filters, team scope, detail navigation, creation dialog, loading/error/retry/empty states and responsive mobile layout.');
} finally {
  await browser.close();
}
