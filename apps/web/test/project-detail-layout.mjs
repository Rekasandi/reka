// Run against pnpm dev:web; project APIs are mocked and no live data is changed.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const css = fileURLToPath(new URL('../../../packages/ui/src/components/block-editor/style.css', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  const project = {
    id: 'p1', teamId: 't1', ownerId: 'u1', name: 'Enterprise Identity & Access Controls', slug: 'enterprise-identity', icon: 'UsersRound',
    status: 'planned', health: 'at_risk', priority: 'no_priority', startDate: '2024-07-01', targetDate: '2027-02-27', updatedAt: '2026-10-13',
    description: JSON.stringify({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: "Elevate security and user experience. We’re building robust user authentication infrastructure for seamless, secure access across our website and mobile app." }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Problem' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Enterprise finance teams need centralized control over who can access spend, payment, and reporting workflows. Existing permissions are hard to audit and manage at scale.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Project objectives' }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Introduce role-based access and secure authentication.' }] }] }] },
    ] }),
  };
  const users = [{ id: 'u1', name: 'Sebastian Kutch', email: 'sebastian@example.com', role: 'owner' }];
  const teams = [{ id: 't1', name: 'Engineering', key: 'ENG', icon: 'Workflow' }];
  const repos = [{ id: 'r1', name: 'User Authentication', fullName: 'reka/authentication', defaultBranch: 'main', isPrivate: true }];
  const issues = Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, identifier: `ENG-${i+1}`, number: i+1, title: `Authentication task ${i+1}`, projectId: 'p1', teamId: 't1', type: 'task', priority: 'medium', status: i === 0 ? 'done' : i === 1 ? 'in_progress' : 'todo', assigneeId: i < 6 ? 'u1' : null, reporterId: 'u1', labels: i < 3 ? [{ id: 'l1', name: 'Security', color: '#50a2ff' }] : [], createdAt: '2026-10-13', updatedAt: '2026-10-13', sortOrder: i }));
  const updates = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/projects/p1' && route.request().method() === 'PATCH') { const data = route.request().postDataJSON(); updates.push(data); Object.assign(project, data); return route.fulfill({ json: project }); }
    const data = path === '/api/projects/p1' ? project : path === '/api/projects' ? [project] : path === '/api/users' ? users : path === '/api/teams' ? teams : path === '/api/teams/t1' ? teams[0] : path === '/api/issues' ? issues : path === '/api/projects/p1/repositories' ? repos : path === '/api/notifications/unread-count' ? { count: 0 } : [];
    return route.fulfill({ json: data });
  });
  await page.route('**/src/app/main.tsx*', async route => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { AppLayout } from '/src/components/layout/app-layout.tsx';
      import { ThemeProvider } from '/src/components/theme/theme-provider.tsx';
      import { TooltipProvider } from '/@fs${css.replace('/components/block-editor/style.css', '/index.ts')}';
      import { ProjectDetailPage } from '/src/features/projects/components/project-detail-page.tsx';
      import '/src/styles/globals.css';
      import '/@fs${css}';
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(TooltipProvider, null, React.createElement(ThemeProvider, { defaultTheme: 'dark' },
          React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) },
            React.createElement(MemoryRouter, { initialEntries: ['/projects/p1?teamId=t1'] },
              React.createElement(Routes, null, React.createElement(Route, { element: React.createElement(AppLayout) },
                React.createElement(Route, { path: '/projects/:id', element: React.createElement(ProjectDetailPage) }))))))));
    ` });
  });
  await page.goto(process.env.WEB_URL || 'http://localhost:5173');
  const editor = page.getByRole('textbox', { name: 'Project description', exact: true });
  await editor.waitFor();
  await page.getByRole('heading', { name: project.name, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Change project icon', exact: true }).count(), 0);
  const aside = page.getByRole('complementary', { name: 'Project properties' });
  const intro = page.locator('.project-overview');
  const introBox = await intro.boundingBox();
  const asideBox = await aside.boundingBox();
  assert(asideBox.x > introBox.x + introBox.width, 'Properties are in the right column on desktop');
  const viewTabs = await page.getByRole('tablist', { name: 'Project views' }).boundingBox();
  assert(viewTabs.y + viewTabs.height <= introBox.y, 'View tabs sit above, not beside, project content');
  assert.equal(await page.getByRole('progressbar', { name: 'Project completion' }).getAttribute('aria-valuenow'), '5');
  assert.equal(await page.getByRole('tab', { name: 'Overview', exact: true }).getAttribute('aria-selected'), 'true');
  await page.screenshot({ path: '/tmp/reka-project-reference-desktop.png', fullPage: true });
  // Give the overview enough height to verify stickiness in the actual app scrollport.
  await intro.evaluate(element => { element.style.minHeight = '1800px'; });
  await aside.evaluate(async element => {
    let scroller = element.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== 'auto') scroller = scroller.parentElement;
    if (!scroller) throw new Error('App scrollport not found');
    scroller.scrollTop = 400;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const stickyBox = await aside.boundingBox();
  assert(Math.abs(stickyBox.y - asideBox.y) <= 2, 'Properties stay below the view toolbar while scrolling');
  assert(stickyBox.y + stickyBox.height <= 1100, 'The sidebar fits within the desktop viewport');
  await aside.evaluate(element => {
    let scroller = element.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== 'auto') scroller = scroller.parentElement;
    scroller.scrollTop = 0;
  });
  await intro.evaluate(element => { element.style.minHeight = ''; });

  await page.getByRole('combobox', { name: 'Project status' }).click();
  await page.getByRole('option', { name: 'In Progress', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Project status"]')?.textContent.includes('In Progress'));
  assert(updates.some(data => data.status === 'in_progress'));
  await page.getByRole('combobox', { name: 'Project priority' }).click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await page.waitForTimeout(150);
  assert(updates.some(data => data.priority === 'high'));
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await aside.getByText('Security', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('button', { name: 'Manage members', exact: true }).click();
  await page.getByRole('dialog', { name: 'Project members' }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();

  // Keep the description editor mounted when switching views so drafts aren't discarded.
  await editor.locator('p').first().click();
  await page.keyboard.type('Draft ');
  await page.getByText('Unsaved changes', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Issues', exact: true }).click();
  await page.getByRole('heading', { name: 'Project issues', exact: true }).waitFor();
  assert.equal(await editor.isVisible(), false);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByText('Authentication task 1', { exact: true }).waitFor();
  assert.equal(await page.getByText('Authentication task 2', { exact: true }).count(), 0);
  await page.getByRole('tab', { name: 'Repositories', exact: true }).click();
  await page.getByRole('link', { name: 'reka/authentication', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await editor.waitFor();
  assert.match(await editor.innerText(), /Draft /);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await editor.innerText().then(text => text.includes('Draft ')), false);
  await page.getByRole('button', { name: 'Toggle project properties' }).click();
  assert.equal(await aside.count(), 0);
  await page.getByRole('button', { name: 'Toggle project properties' }).click();
  await aside.waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/reka-project-reference-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const mobileIntro = await intro.boundingBox();
  const mobileAside = await aside.boundingBox();
  assert(mobileAside.y > mobileIntro.y + mobileIntro.height, 'Properties stack below the overview on mobile');
  assert(mobileIntro.x >= 0 && mobileIntro.x + mobileIntro.width <= 390, 'Overview is fully inside the mobile viewport');
  assert(mobileAside.x >= 0 && mobileAside.x + mobileAside.width <= 390, 'Properties are fully inside the mobile viewport');
  assert.deepEqual(errors, []);
  console.log('PASS: Reference layout, desktop/mobile, editable status/priority, progress grouping, members, issue filters, repositories, persistent editor drafts and sidebar toggle.');
} finally { await browser.close(); }
