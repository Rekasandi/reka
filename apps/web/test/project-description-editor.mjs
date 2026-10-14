// Run against pnpm dev:web. API requests are mocked; no live project data is modified.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const editorCss = fileURLToPath(new URL('../../../packages/ui/src/components/block-editor/style.css', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
  page.on('console', (message) => { if (message.type() === 'error') console.error(message.text()); });
  let project = { id: 'p1', name: 'Editor project', description: 'Existing description\nSecond paragraph' };
  let fail = false;
  const updates = [];
  await page.route('**/api/**', async (route) => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/')) return route.continue();
    if (route.request().method() === 'PATCH') {
      const data = route.request().postDataJSON();
      updates.push(data);
      if (fail) return route.fulfill({ status: 500, json: { message: 'Save failed' } });
      project = { ...project, ...data };
    }
    return route.fulfill({ json: project });
  });
  await page.route('**/src/app/main.tsx*', async (route) => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from '/node_modules/.vite/deps/react.js${version}';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js${version}';
      import { QueryClient, QueryClientProvider, useQuery } from '/node_modules/.vite/deps/@tanstack_react-query.js${version}';
      import ProjectDescriptionEditor from '/src/features/projects/components/project-description-editor.tsx';
      import '/src/styles/globals.css';
      import '/@fs${editorCss}';
      function Harness() {
        const query = useQuery({ queryKey: ['project', 'p1'], queryFn: () => fetch('/api/projects/p1').then(r => r.json()) });
        return React.createElement('main', { style: { padding: '32px', maxWidth: '900px' } },
          query.data && React.createElement(ProjectDescriptionEditor, { projectId: 'p1', description: query.data.description }));
      }
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) },
          React.createElement(Harness)));
    ` });
  });
  await page.goto(process.env.WEB_URL || 'http://localhost:5173');
  const editor = page.getByRole('textbox', { name: 'Project description', exact: true });
  const save = page.getByRole('button', { name: 'Save description', exact: true });
  async function focusEnd() {
    await editor.focus();
    await editor.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }
  await editor.waitFor();
  assert.match(await editor.innerText(), /Existing description\n\nSecond paragraph/);
  assert.equal(await save.isDisabled(), true);
  await focusEnd();
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  const heading = page.getByRole('button', { name: /Heading 1/ });
  await heading.waitFor();
  await heading.click();
  await heading.waitFor({ state: 'hidden' });
  await editor.locator('h1').waitFor();
  await editor.locator('h1').click();
  await page.keyboard.type('Project objectives', { delay: 20 });
  await save.click();
  await page.waitForFunction(() => document.querySelector('button')?.textContent === 'Save description');
  await page.waitForTimeout(300);
  assert.equal(JSON.parse(project.description).content.find(node => node.type === 'heading')?.attrs.level, 1);
  assert.equal(await editor.locator('h1').innerText(), 'Project objectives');
  assert.equal(await save.isDisabled(), true);
  await page.reload();
  await editor.locator('h1').waitFor();
  assert.equal(await editor.locator('h1').innerText(), 'Project objectives');

  await focusEnd();
  await page.keyboard.type(' discarded');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await editor.locator('h1').innerText(), 'Project objectives');
  assert.equal(updates.length, 1);

  fail = true;
  await focusEnd();
  await page.keyboard.type(' retry draft');
  await save.click();
  await page.getByRole('alert').waitFor();
  assert.match(await editor.innerText(), /retry draft/);
  assert.equal(await save.isEnabled(), true);
  fail = false;
  await save.click();
  await page.waitForTimeout(300);
  assert.match(project.description, /retry draft/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/reka-project-editor-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: '/tmp/reka-project-editor-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: Legacy text, slash commands, rich blocks, save/reload, cancel, failed-save retry and mobile layout.');
} finally {
  await browser.close();
}
