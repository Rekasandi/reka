// Run against pnpm dev:web. API calls are mocked.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  let clients = [
    { id: 'c1', name: 'Acme Financial Services', industry: 'Fintech & Payments', notes: 'Payment infrastructure and delivery coordination.', projectCount: 3, contactCount: 1, contacts: [{ id: 'ct1', name: 'Alex Morgan', email: 'alex@acme.example', role: 'Lead' }], projects: [], createdAt: '2026-10-01' },
    { id: 'c2', name: 'Northstar Health', industry: 'Healthcare & Biotech', notes: 'Secure patient services.', projectCount: 1, contactCount: 0, contacts: [], projects: [], createdAt: '2026-10-02' },
    { id: 'c3', name: 'A very long enterprise client name to verify truncation on narrow screens', industry: null, notes: 'Long account notes that should truncate without causing horizontal scrolling.', projectCount: 0, contactCount: 0, contacts: [], projects: [], createdAt: '2026-10-03' },
  ];
  let fail = false;
  let delay = 400;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/clients') {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return route.fulfill({ status: fail ? 500 : 200, json: fail ? {} : clients });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('**/src/app/main.tsx*', async route => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import { MemoryRouter } from '/node_modules/.vite/deps/react-router-dom.js${version}';
      import { ClientsPage } from '/src/features/clients/components/clients-page.tsx';
      import '/src/styles/globals.css';
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(MemoryRouter, null,
            React.createElement('main', { className: 'p-6' }, React.createElement(ClientsPage)))));
    ` });
  });
  const url = process.env.WEB_URL || 'http://localhost:5173';
  await page.goto(url);
  await page.getByRole('status', { name: 'Loading clients' }).waitFor();
  const list = page.getByRole('list', { name: 'Clients', exact: true });
  await list.waitFor();
  delay = 0;
  assert.equal(await list.getByRole('listitem').count(), 3);
  assert.equal(await page.locator('[data-slot="card"]').count(), 0);
  await page.screenshot({ path: '/tmp/reka-clients-list-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Fintech & Payments', exact: true }).click();
  assert.equal(await list.getByRole('listitem').count(), 1);
  await page.getByRole('button', { name: 'All Industries', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Search clients or contacts' });
  await search.fill('alex@acme');
  assert.equal(await list.getByRole('listitem').count(), 1);
  await page.getByRole('button', { name: 'Clear client search' }).click();
  assert.equal(await list.getByRole('listitem').count(), 3);
  const row = page.getByRole('button', { name: 'Open client Acme Financial Services', exact: true });
  await row.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  await page.getByRole('heading', { name: 'Acme Financial Services', exact: true }).waitFor();
  assert(Math.abs(await page.getByRole('dialog').evaluate(element => element.getBoundingClientRect().width) - 768) < 1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New Client', exact: true }).click();
  await page.getByRole('dialog', { name: 'New Client Account' }).waitFor();
  await page.keyboard.press('Escape');
  await search.fill('not-a-client');
  await page.getByText('No clients found', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear client search' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/reka-clients-list-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  fail = true;
  await page.reload();
  await page.getByText('Could not load clients. Please try again.', { exact: true }).waitFor();
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await list.waitFor();
  clients = [];
  await page.reload();
  await page.getByText('No clients found', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Create Client', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: Client list rows, search/contact search, industry filters, keyboard detail, create dialog, empty/error/retry/loading and mobile.');
} finally { await browser.close(); }
