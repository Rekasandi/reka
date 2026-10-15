// Run against pnpm dev:web. APIs/auth are controlled fixtures; no application data is changed.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  const statuses = ['in_progress', 'planned', 'paused', 'completed', 'canceled'];
  const projects = statuses.map((status, index) => ({
    id: `p${index}`, teamId: 't1', ownerId: 'u1', icon: index === 0 ? 'Building2' : null, name: `${status} project`,
    description: 'Project description with enough detail to check truncation on smaller screens.',
    status, health: ['on_track', 'at_risk', 'off_track'][index % 3], priority: ['high', 'medium', 'low', 'urgent', 'no_priority'][index],
    progress: index * 25, completedIssues: index, totalIssues: 4,
    targetDate: index ? null : '2026-12-15',
  }));
  projects[0].description = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Structured project summary' }] }] });
  const longName = 'Another active project with a long name that must truncate without pushing properties outside the viewport';
  projects.push({ ...projects[0], id: 'p5', name: longName, progress: null, targetDate: 'invalid', ownerId: 'missing', totalIssues: undefined });
  projects.push({ ...projects[0], id: 'other', teamId: 'other-team', name: 'Outside team scope' });
  const creations = [];
  let fail = false;
  let delay = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/users') return route.fulfill({ json: [{ id: 'u1', name: 'Test Owner', avatarUrl: null }] });
    if (path === '/api/projects' && request.method() === 'GET') {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return route.fulfill({ status: fail ? 500 : 200, json: fail ? {} : projects });
    }
    if (path === '/api/projects' && request.method() === 'POST') {
      const data = request.postDataJSON();
      creations.push(data);
      const created = { ...projects[0], ...data, id: `created-${creations.length}`, progress: 0, totalIssues: 0 };
      projects.push(created);
      return route.fulfill({ json: created });
    }
    if (path === '/api/teams') return route.fulfill({ json: [
      { id: 't1', name: 'Test Team', key: 'T', canWrite: true },
      { id: 'other-team', name: 'Read-only Team', key: 'RO', canWrite: false },
    ] });
    throw new Error(`Unexpected request ${request.method()} ${path}`);
  });
  await page.route('**/src/app/main.tsx*', async route => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter, Routes, Route, useLocation } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { ProjectsPage } from '/src/features/projects/components/projects-page.tsx';
      import { useAuthStore } from '/src/stores/auth.store.ts';
      import '/src/styles/globals.css';
      const params = new URLSearchParams(window.location.search);
      document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
      const user = { id: 'u1', name: 'Test Owner', email: 'owner@example.test', role: params.get('role') || 'owner' };
      useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
      function Detail() { const location = useLocation(); return React.createElement('p', null, location.pathname + location.search); }
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(MemoryRouter, { initialEntries: [params.get('route') || '/projects?teamId=t1'] },
            React.createElement('div', { className: 'p-4 sm:p-6' },
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
  const rows = () => page.locator('tr[data-project-id]');
  const goto = async (route = '/projects?teamId=t1', theme = 'dark', role = 'owner') => {
    await page.goto(`${url}?${new URLSearchParams({ route, theme, role })}`);
  };
  delay = 700;
  await goto();
  await page.getByRole('status', { name: 'Loading projects' }).waitFor();
  await page.getByRole('link', { name: 'Open project in_progress project', exact: true }).waitFor();
  delay = 0;
  assert.equal(await page.getByRole('table', { name: 'Projects', exact: true }).count(), 1);
  assert.equal(await rows().count(), 6);
  assert.deepEqual(await page.getByRole('columnheader').allTextContents(), ['Name', 'Health', 'Priority', 'Lead', 'Target date', 'Issues', 'Status']);
  assert.equal(await page.getByRole('columnheader').first().getAttribute('aria-sort'), 'ascending');
  assert.equal(await page.getByText('Structured project summary', { exact: true }).count(), 0);
  assert.equal(await page.getByText('"type":"doc"', { exact: false }).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Open project Outside team scope' }).count(), 0);
  assert.equal(await page.locator('[data-slot="card"]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Change project icon', exact: true }).count(), 0);
  assert.equal(await rows().filter({ hasText: 'in_progress project' }).locator('svg.lucide-building-2').count(), 1);
  assert.equal(await page.locator('tr[data-project-id="p5"]').getByRole('meter').count(), 0, 'Missing progress is not fabricated');
  assert.equal(await page.getByText('Invalid Date', { exact: true }).count(), 0);
  assert.equal(await page.locator('[data-slot="work-page-header"] [data-slot="badge"]').innerText(), '6');
  await page.getByText('Projects owned by this team.', { exact: true }).waitFor();
  assert.equal(await page.locator('[aria-label="Project toolbar"]').count(), 0);
  assert.equal(await page.getByText(/^All projects/).count(), 0);
  assert.equal(await page.getByRole('searchbox', { name: 'Filter projects' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Project filters', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Project display options' }).count(), 0);

  const collapse = page.getByRole('button', { name: 'Collapse In progress projects', exact: true });
  const contentId = await collapse.getAttribute('aria-controls');
  assert.equal(await collapse.getAttribute('aria-expanded'), 'true');
  await collapse.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: 'Expand In progress projects' }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator(`#${contentId}`).isVisible(), false);
  assert.equal(await page.getByRole('link').count(), 4);
  await page.getByRole('button', { name: 'Expand In progress projects' }).click();
  assert.equal(await page.getByRole('link').count(), 6);

  assert.equal(await rows().first().getAttribute('data-project-id'), 'p5');
  await page.getByRole('button', { name: 'Sort projects by name descending' }).click();
  assert.equal(await rows().first().getAttribute('data-project-id'), 'p0');
  assert.equal(await page.getByRole('columnheader').first().getAttribute('aria-sort'), 'descending');
  await page.getByRole('button', { name: 'Sort projects by name ascending' }).click();
  assert.equal(await rows().first().getAttribute('data-project-id'), 'p5');

  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
    await page.waitForTimeout(250); // Capture settled theme colors, not the button transitions.
    for (const width of [1440, 1024, 900, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.waitForTimeout(180);
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        clippedControls: [...document.querySelectorAll('button,input')].filter(element => element.checkVisibility() && (element.getBoundingClientRect().right > innerWidth + 1 || element.getBoundingClientRect().left < -1)).map(element => element.getAttribute('aria-label') || element.textContent),
      }));
      assert.equal(layout.overflow, false, `${theme} ${width}: overflow`);
      assert.deepEqual(layout.clippedControls, [], `${theme} ${width}: controls`);
      assert.equal(await page.getByRole('columnheader').count(), width >= 944 ? 7 : 2, `${theme} ${width}: responsive columns`);
      const firstRow = rows().first();
      const nameBounds = await firstRow.getByRole('link').boundingBox();
      const statusBounds = await firstRow.locator('td').last().boundingBox();
      assert.ok(nameBounds.width >= 160, `${theme} ${width}: name retains useful width`);
      assert.ok(nameBounds.x + nameBounds.width <= statusBounds.x + 1, `${theme} ${width}: name does not overlap progress`);
      const design = await page.evaluate(() => {
        const style = element => getComputedStyle(element);
        const heading = style(document.querySelector('h1'));
        const primary = style([...document.querySelectorAll('button')].find(element => element.textContent.trim() === 'New project'));
        const link = style(document.querySelector('tr[data-project-id] a'));
        const disclosure = [...document.querySelectorAll('button[aria-controls^="project-group-"]')].find(element => element.checkVisibility());
        const group = style(disclosure.parentElement);
        const priority = style(document.querySelector('tr[data-project-id="p0"] td:nth-child(3) svg'));
        const channels = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
        const luminance = color => channels(color).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
        const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
        return {
          heading: [heading.fontSize, heading.lineHeight, heading.fontWeight, heading.letterSpacing], font: heading.fontFamily,
          row: [link.fontSize, link.lineHeight], primary: [primary.borderRadius, primary.backgroundColor],
          group: [group.borderTopLeftRadius, group.borderBottomWidth],
          groupLabel: [style(disclosure.querySelector('[data-slot="work-list-group-label"]')).fontSize, style(disclosure.querySelector('[data-slot="work-list-group-label"]')).fontWeight],
          name: [style(document.querySelector('.project-row-title')).fontSize, style(document.querySelector('.project-row-title')).lineHeight],
          touchTarget: parseFloat(primary.height),
          rowBorder: style(document.querySelector('tr[data-project-id="p5"]')).borderBottomWidth,
          neutralPriority: priority.color === style(document.querySelector('tr[data-project-id="p0"] svg.lucide-building-2')).color,
          primaryContrast: contrast(primary.color, primary.backgroundColor),
          textContrast: contrast(link.color, style(document.body).backgroundColor),
        };
      });
      assert.deepEqual(design.heading, width >= 640 ? ['24px', '32px', '600', '-0.72px'] : ['20px', '28px', '600', '-0.6px'], 'Shared My issues page heading');
      assert.match(design.font, /Geist/);
      assert.deepEqual(design.row, ['12px', '16px'], 'Compact list metadata matches My issues');
      assert.deepEqual(design.name, width <= 848 ? ['14px', '22px'] : ['13px', '20px'], 'Issue title scale and responsive treatment');
      assert.deepEqual(design.primary, ['6px', theme === 'dark' ? 'rgb(237, 237, 237)' : 'rgb(23, 23, 23)'], 'App primary button uses ink and 6px radius');
      assert.deepEqual(design.group, ['6px', '1px'], 'Shared hairline group header, not a filled status band');
      assert.deepEqual(design.groupLabel, ['12px', '600'], 'Shared My issues group label');
      assert.equal(design.rowBorder, '1px', 'Hairline row separators');
      assert.equal(design.neutralPriority, true, 'Non-urgent priorities use neutral ink, not decorative colors');
      assert.ok(design.primaryContrast >= 4.5 && design.textContrast >= 4.5, 'Readable primary and body text contrast');
      if (width < 640) assert.ok(design.touchTarget >= 44, 'Mobile primary action retains a 44px target');
      if ([1440, 900, 390, 320].includes(width)) await page.screenshot({ path: `/tmp/reka-projects-consistent-${theme}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'New project in Canceled', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Project', exact: true });
  await dialog.waitFor();
  assert.match(await dialog.getByRole('combobox', { name: 'Status', exact: true }).innerText(), /Canceled/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await dialog.waitFor();
  assert.match(await dialog.getByRole('combobox', { name: 'Status', exact: true }).innerText(), /In Progress/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New project in Planned', exact: true }).click();
  await dialog.waitFor();
  assert.match(await dialog.getByRole('combobox', { name: 'Team', exact: true }).innerText(), /Test Team/);
  await dialog.getByRole('combobox', { name: 'Team', exact: true }).click();
  assert.equal(await page.getByRole('option', { name: 'Read-only Team', exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  await dialog.getByRole('textbox', { name: 'Project Name', exact: true }).fill('Created from planned group');
  await dialog.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByRole('link', { name: 'Open project Created from planned group', exact: true }).waitFor();
  assert.equal(creations.length, 1);
  assert.equal(creations[0].status, 'planned');
  assert.equal(creations[0].teamId, 't1');
  const project = page.getByRole('link', { name: 'Open project in_progress project', exact: true });
  await project.focus();
  await page.keyboard.press('Enter');
  await page.getByText('/projects/p0?teamId=t1', { exact: true }).waitFor();

  for (const role of ['guest', 'client']) {
    await goto('/projects?teamId=t1', 'dark', role);
    await page.getByRole('link', { name: 'Open project in_progress project', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^New project/ }).count(), 0);
  }
  await goto('/projects?teamId=other-team');
  await page.getByRole('link', { name: 'Open project Outside team scope' }).waitFor();
  assert.equal(await page.getByRole('link').count(), 1);
  assert.equal(await page.getByRole('button', { name: /^New project/ }).count(), 0, 'No create control for read-only team');
  await goto('/projects');
  await page.getByRole('link', { name: 'Open project Outside team scope' }).waitFor();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await dialog.waitFor();
  assert.match(await dialog.getByRole('combobox', { name: 'Team', exact: true }).innerText(), /Test Team/);
  await page.keyboard.press('Escape');

  fail = true;
  await goto();
  await page.getByRole('alert').filter({ hasText: 'Failed to load projects' }).waitFor();
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('link', { name: 'Open project in_progress project', exact: true }).waitFor();
  projects.length = 0;
  await goto();
  await page.getByText('No projects yet.', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: project toolbar removed, grouped table, keyboard collapse/sorting/navigation, group-create payload, permissions, team scope, states, shared My issues header/list styles and 12 responsive light/dark layouts.');
} finally {
  await browser.close();
}
