// Run against `pnpm dev:web`: node apps/web/test/github-dialogs.mjs
// Controlled API: checks the Link PR and Add repository dialogs built on the shared SelectField/TanStack Form.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const ui = fileURLToPath(new URL('../../../packages/ui/src/index.ts', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; const posts = [];
  page.on('pageerror', error => errors.push(error.message));
  const repos = [
    { id: 'r1', fullName: 'acme/web', isPrivate: false, defaultBranch: 'main' },
    { id: 'r2', fullName: 'acme/api', isPrivate: true, defaultBranch: 'main' },
  ];
  const available = [
    { owner: 'acme', name: 'web', fullName: 'acme/web', isPrivate: false, defaultBranch: 'main', description: 'Web app' },
    { owner: 'acme', name: 'api', fullName: 'acme/api', isPrivate: true, defaultBranch: 'main', description: 'API' },
    { owner: 'solo', name: 'tools', fullName: 'solo/tools', isPrivate: false, defaultBranch: 'main', description: 'Tools' },
  ];
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    if (path === '/api/integrations/github/pull-requests/repositories/by-issue/i1') return route.fulfill({ json: repos });
    if (path === '/api/integrations/github/pull-requests/link' && method === 'POST') { posts.push(['link', request.postDataJSON()]); return route.fulfill({ json: { id: 'pr1' } }); }
    if (path === '/api/integrations/github/repositories/available') return route.fulfill({ json: available });
    if (path === '/api/integrations/github/repositories' && method === 'GET') return route.fulfill({ json: [] });
    if (path === '/api/integrations/github/repositories' && method === 'POST') { posts.push(['repo', request.postDataJSON()]); return route.fulfill({ json: { id: 'r9', ...request.postDataJSON() } }); }
    throw new Error(`Unexpected API request ${method} ${path}`);
  });
  await page.route('**/src/app/main.tsx*', async route => {
    const original = await (await route.fetch()).text();
    const version = original.match(/react\.js(\?v=[\w]+)/)?.[1] ?? '';
    await route.fulfill({ contentType: 'application/javascript', body: `
      import { React, ReactDOM, QueryClient, QueryClientProvider } from '/src/test-support/vendor.ts';
      import { TooltipProvider } from '/@fs${ui}';
      import { LinkPullRequestDialog } from '/src/features/issues/components/link-pr-dialog.tsx';
      import { AddRepositoryDialog } from '/src/features/settings/components/add-repository-dialog.tsx';
      import '/src/styles/globals.css';
      const mode = new URLSearchParams(location.search).get('dialog');
      const dialog = mode === 'repo'
        ? React.createElement(AddRepositoryDialog, { open: true, onOpenChange: () => {} })
        : React.createElement(LinkPullRequestDialog, { issueId: 'i1', issueIdentifier: 'ENG-1', open: true, onOpenChange: () => {} });
      ReactDOM.createRoot(document.getElementById('root')).render(
        React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, React.createElement(TooltipProvider, null, dialog))
      );
    ` });
  });
  const base = process.env.WEB_URL || 'http://localhost:5173';

  await page.goto(`${base}?dialog=link`);
  const link = page.getByRole('dialog');
  await link.waitFor();
  // The first repository is preselected; choose the private one through the Radix select.
  const repoTrigger = link.getByRole('combobox');
  await repoTrigger.waitFor();
  assert.match(await repoTrigger.innerText(), /acme\/web/);
  await repoTrigger.click();
  await page.getByRole('option', { name: /acme\/api/ }).click();
  assert.match(await repoTrigger.innerText(), /acme\/api/);
  await link.getByRole('spinbutton').or(link.getByLabel(/PR number|Pull request number/i)).first().fill('42');
  await link.locator('button[type="submit"]').click();
  await page.waitForFunction(() => true);
  await page.waitForTimeout(400);
  assert.deepEqual(posts.find(post => post[0] === 'link')?.[1], { issueId: 'i1', repositoryId: 'r2', prNumber: 42 });

  await page.goto(`${base}?dialog=repo`);
  const add = page.getByRole('dialog');
  await add.waitFor();
  const ownerTrigger = add.getByRole('combobox');
  await ownerTrigger.waitFor();
  assert.match(await ownerTrigger.innerText(), /acme/, 'first owner is auto-selected');
  assert.equal(await add.getByText('acme/web').count() > 0, true);
  await ownerTrigger.click();
  await page.getByRole('option', { name: /solo/ }).click();
  assert.match(await ownerTrigger.innerText(), /solo/);
  assert.equal(await add.getByText('solo/tools').count() > 0, true);
  assert.equal(await add.getByText('acme/web').count(), 0, 'owner filter hides other owners');
  assert.deepEqual(errors, []);
  console.log('PASS: Link PR and Add repository dialogs use SelectField (preselect, option labels, filtering) and submit via TanStack Form.');
} finally {
  await browser.close();
}
