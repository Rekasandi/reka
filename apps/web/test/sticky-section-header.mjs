// Run against `pnpm dev:web`: node apps/web/test/sticky-section-header.mjs
// Requires Playwright or PLAYWRIGHT_MODULE. Uses the real AppLayout with mocked APIs.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    let body = [];
    if (path === '/api/teams') body = [{ id: 't1', name: 'Test Team', key: 'T' }];
    else if (path === '/api/teams/t1') body = { id: 't1', name: 'Test Team', key: 'T' };
    else if (path === '/api/notifications/unread-count') body = { count: 0 };
    else if (path === '/api/workspace') body = { id: 'w1', name: 'Test Workspace', role: 'owner' };
    else if (!['/api/projects', '/api/users', '/api/cycles', '/api/labels', '/api/teams/t1/workflow-states'].includes(path)) throw new Error(`Unexpected API request ${path}`);
    await route.fulfill({ json: body });
  });
  const issues = Array.from({ length: 50 }, (_, index) => ({
    id: `i${index}`, identifier: `T-${index + 1}`, title: `Issue ${index + 1}`,
    type: 'task', status: index < 35 ? 'todo' : 'done', priority: 'medium',
    assigneeId: null, projectId: null, teamId: 't1', createdAt: '2026-10-13',
  }));
  await page.route('**/src/app/main.tsx*', async (route) => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { AppLayout } from '/src/components/layout/app-layout.tsx';
      import { IssueGroupedListView } from '/src/features/issues/components/issue-grouped-list-view.tsx';
      import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
      import { TooltipProvider } from '/@fs${new URL('../../../packages/ui/src/index.ts', import.meta.url).pathname}';
      import '/src/styles/globals.css';
      function Fixture() { return React.createElement('div', null,
        React.createElement('div', { className: 'h-40' }, 'Team Issues'),
        React.createElement(IssueGroupedListView, { issues: ${JSON.stringify(issues)} })); }
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(MemoryRouter, { initialEntries: ['/teams/t1/issues'] },
            React.createElement(ThemeProvider, null,
              React.createElement(TooltipProvider, null,
                React.createElement(Routes, null,
                  React.createElement(Route, { element: React.createElement(AppLayout) },
                    React.createElement(Route, { path: '/teams/t1/issues', element: React.createElement(Fixture) })
                  )
                )
              )
            )
          )
        )
      );
    ` });
  });
  await page.goto(process.env.WEB_URL || 'http://localhost:5173');
  const section = page.locator('.sticky').filter({ hasText: 'Todo' });
  await section.waitFor();
  const header = page.locator('header');
  const initialHeader = await header.boundingBox();
  assert((await section.boundingBox()).y > initialHeader.y + initialHeader.height + 24);
  const scroll = page.locator('main > .overflow-y-auto');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const scrollTop of [300, 600]) {
      await scroll.evaluate((element, top) => { element.scrollTop = top; }, scrollTop);
      await page.waitForFunction(() => {
        const header = document.querySelector('header').getBoundingClientRect();
        const sticky = [...document.querySelectorAll('.sticky')].find((element) => element.textContent.includes('Todo')).getBoundingClientRect();
        return Math.abs(sticky.top - header.bottom) < 1;
      });
      const headerBox = await header.boundingBox();
      const sectionBox = await section.boundingBox();
      assert(Math.abs(sectionBox.y - (headerBox.y + headerBox.height)) < 1);
    }
    await page.screenshot({ path: `/tmp/reka-sticky-section-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: section header sits flush below the app header after scrolling on desktop and mobile; initial page padding is preserved.');
} finally {
  await browser.close();
}
