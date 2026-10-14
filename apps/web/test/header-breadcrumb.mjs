// Run against `pnpm dev:web`: node apps/web/test/header-breadcrumb.mjs
// Requires Playwright or PLAYWRIGHT_MODULE; all resource requests are mocked.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
  const requests = [];
  const teamName = 'Engineering Platform Team';
  const projectName = 'A project name long enough to exercise header truncation without moving the search or profile controls';
  let unavailable = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    requests.push(path);
    if (unavailable) return route.fulfill({ status: 404, json: {} });
    if (path === '/api/teams/t1') return route.fulfill({ json: { id: 't1', name: teamName } });
    if (path === '/api/projects/p1') return route.fulfill({ json: { id: 'p1', name: projectName } });
    if (path === '/api/cycles/c1') return route.fulfill({ json: { id: 'c1', number: 12, name: null } });
    if (path === '/api/documents/d1') return route.fulfill({ json: { id: 'd1', title: 'Delivery decisions' } });
    if (path === '/api/initiatives/in1') return route.fulfill({ json: { id: 'in1', name: 'Customer experience' } });
    throw new Error(`Unexpected API request ${path}`);
  });
  const uiPath = new URL('../../../packages/ui/src/index.ts', import.meta.url).pathname;
  await page.route('**/src/app/main.tsx*', async (route) => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { SidebarProvider } from '/@fs${uiPath}';
      import { Header } from '/src/components/layout/header.tsx';
      import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
      import { useUiStore } from '/src/stores/ui.store.ts';
      import '/src/styles/globals.css';
      window.paletteIsOpen = () => useUiStore.getState().isCommandPaletteOpen;
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(MemoryRouter, { initialEntries: [location.pathname + location.search] },
            React.createElement(ThemeProvider, null,
              React.createElement(SidebarProvider, null,
                React.createElement('div', { className: 'min-w-0 flex-1' }, React.createElement(Header))
              )
            )
          )
        )
      );
    ` });
  });
  const url = process.env.WEB_URL || 'http://localhost:5173';
  const cases = [
    ['/dashboard', 'Dashboard'], ['/inbox', 'Inbox'], ['/my-issues', 'My Issues'],
    ['/issues', 'Issues'], ['/projects', 'Projects'], ['/cycles', 'Cycles'],
    ['/teams', 'Teams'], ['/users', 'Users'], ['/clients', 'Clients'], ['/settings', 'Settings'],
    ['/triage', 'Triage'], ['/favorites', 'Favorites'], ['/documents', 'Documents'], ['/views', 'Views'],
    ['/triage?teamId=t1', 'Triage'], ['/initiatives?teamId=t1', 'Initiatives'], ['/views?teamId=t1', 'Views'],
    ['/initiatives', 'Initiatives'], ['/roadmap', 'Roadmap'], ['/insights', 'Insights'],
    ['/documents/d1', 'Delivery decisions'], ['/initiatives/in1', 'Customer experience'],
    ['/teams/t1', teamName], ['/teams/t1/issues', 'Issues'],
    ['/projects?teamId=t1', 'Projects'], ['/cycles?teamId=t1', 'Cycles'],
    ['/projects/p1?teamId=t1', projectName], ['/cycles/c1?teamId=t1', 'Cycle 12'],
  ];
  for (const [path, label] of cases) {
    requests.length = 0;
    await page.goto(url + path);
    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' });
    await breadcrumb.locator('[aria-current="page"]').filter({ hasText: label }).waitFor();
    assert.equal(await breadcrumb.locator('[aria-current="page"]').count(), 1);
    assert.equal(await breadcrumb.locator('a a').count(), 0);
    if (!path.includes('/t1') && !path.includes('/p1') && !path.includes('/c1') && !path.includes('/d1') && !path.includes('/in1') && !path.includes('teamId')) {
      assert.deepEqual(requests, [], 'Top-level breadcrumb must not fetch unrelated resources');
    }
    if (path === '/projects/p1?teamId=t1') {
      assert.equal(await breadcrumb.getByRole('link', { name: 'Projects', exact: true }).getAttribute('href'), '/projects?teamId=t1');
      await page.screenshot({ path: '/tmp/reka-breadcrumb-desktop.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: '/tmp/reka-breadcrumb-mobile.png' });
      await page.getByRole('button', { name: 'Search or jump to...', exact: true }).click();
      assert.equal(await page.evaluate(() => window.paletteIsOpen()), true);
      await page.setViewportSize({ width: 1280, height: 800 });
      await breadcrumb.getByRole('link', { name: 'Projects', exact: true }).focus();
      await page.keyboard.press('Enter');
      await breadcrumb.locator('[aria-current="page"]').filter({ hasText: 'Projects' }).waitFor();
      assert.equal(await breadcrumb.getByRole('link', { name: teamName, exact: true }).getAttribute('href'), '/teams/t1');
    }
  }
  unavailable = true;
  await page.goto(url + '/projects/p1');
  await page.getByRole('navigation', { name: 'breadcrumb' }).locator('[aria-current="page"]').filter({ hasText: 'Project' }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'breadcrumb' }).getByText('p1', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: breadcrumb labels for all routes, resource names, team context, parent navigation, search, mobile, accessibility and unavailable-resource fallback.');
} finally {
  await browser.close();
}
