/**
 * Automated End-to-End Audit Test Suite for Deployed REKA Application
 * 
 * Target: Deployed REKA app (default: https://reka.rekasandi.com)
 * Email flows: Mailinator public inbox automation
 * Framework: Playwright (Chromium)
 * Safety: Uses isolated, timestamped test data without modifying existing production accounts.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const TARGET_URL = process.env.TARGET_URL || 'https://reka.rekasandi.com';
const IGNORE_HTTPS_ERRORS = process.env.IGNORE_HTTPS_ERRORS !== 'false';
const HEADLESS = process.env.HEADLESS !== 'false';

const runId = Date.now().toString(36);
const testPassword = 'Password123!';
const ownerEmail = `audit_user_${runId}@mailinator.com`;
const memberEmail = `audit_member_${runId}@mailinator.com`;
const workspaceName = `Audit WS ${runId}`;
const workspaceSlug = `audit-${runId}`;
const teamName = `Team ${runId}`;
const teamKey = `T${runId.slice(-3).toUpperCase()}`;

console.log('='.repeat(70));
console.log(`Starting REKA Deployed End-to-End Audit`);
console.log(`Target URL: ${TARGET_URL}`);
console.log(`Run ID: ${runId}`);
console.log(`Owner: ${ownerEmail}`);
console.log(`Member: ${memberEmail}`);
console.log('='.repeat(70));

async function fetchMailinatorEmail(context, username, subjectKeyword, maxRetries = 10) {
  const mailPage = await context.newPage();
  const inboxUrl = `https://www.mailinator.com/v4/public/inboxes.jsp?to=${encodeURIComponent(username)}`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mailPage.goto(inboxUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await mailPage.waitForTimeout(3000);
      
      const emailRow = await mailPage.$('tr[ng-repeat*="email"]');
      if (emailRow) {
        await emailRow.click();
        await mailPage.waitForTimeout(3000);
        const iframe = await mailPage.$('#html_msg_body');
        if (iframe) {
          const frame = await iframe.contentFrame();
          if (frame) {
            const links = await frame.$$eval('a', as => as.map(a => a.href));
            await mailPage.close();
            return { links, subjectKeyword };
          }
        }
      }
    } catch (err) {
      console.log(`  [Mailinator] Retry on error: ${err.message}`);
    }
    console.log(`  [Mailinator] Waiting for "${subjectKeyword}" in inbox ${username} (attempt ${attempt}/${maxRetries})...`);
    await mailPage.waitForTimeout(3000);
  }
  await mailPage.close();
  throw new Error(`Email with subject "${subjectKeyword}" not found in Mailinator for ${username}`);
}

async function runAudit() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const results = [];

  async function step(name, fn) {
    const start = Date.now();
    process.stdout.write(`• ${name}... `);
    try {
      await fn();
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`PASSED (${duration}s)`);
      results.push({ name, status: 'PASSED', duration });
    } catch (err) {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`FAILED (${duration}s)`);
      console.error(`  Error: ${err.message}`);
      results.push({ name, status: 'FAILED', duration, error: err.message });
      throw err;
    }
  }

  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS });
  const ownerPage = await ownerContext.newPage();

  try {
    // -------------------------------------------------------------
    // Journey 1: Health & Landing Check
    // -------------------------------------------------------------
    await step('API & Web Health Check', async () => {
      const resp = await ownerPage.goto(`${TARGET_URL}/api/health`);
      assert.equal(resp.status(), 200, 'API health endpoint should return 200');
      const body = await resp.json();
      assert.equal(body.status, 'ok', 'API health status should be ok');
    });

    // -------------------------------------------------------------
    // Journey 2: User Registration & Email Verification (Mailinator)
    // -------------------------------------------------------------
    let verifyLink = '';
    await step('Owner Registration via Signup Form', async () => {
      await ownerPage.goto(`${TARGET_URL}/signup`, { waitUntil: 'networkidle' });
      await ownerPage.fill('#signup-name', 'Audit Owner');
      await ownerPage.fill('#signup-email', ownerEmail);
      await ownerPage.fill('#signup-password', testPassword);
      await ownerPage.click('button[type="submit"]');
      await ownerPage.waitForTimeout(3000);
      
      const statusText = await ownerPage.innerText('[role="status"]').catch(() => '');
      assert.ok(statusText.includes(ownerEmail), 'Status message should confirm verification email was sent');
    });

    await step('Fetch Verification Email from Mailinator', async () => {
      const username = ownerEmail.split('@')[0];
      const mail = await fetchMailinatorEmail(ownerContext, username, 'Verify your email');
      assert.ok(mail.links.length > 0, 'Should find verification link in email');
      verifyLink = mail.links[0];
      assert.ok(verifyLink.includes('/api/auth/verify-email'), 'Link must be verification URL');
    });

    await step('Email Verification & Redirect to Onboarding', async () => {
      await ownerPage.goto(verifyLink, { waitUntil: 'networkidle' });
      await ownerPage.waitForTimeout(3000);
      assert.ok(ownerPage.url().includes('/onboarding'), `Expected redirect to /onboarding, got ${ownerPage.url()}`);
    });

    // -------------------------------------------------------------
    // Journey 3: Onboarding & Workspace Creation
    // -------------------------------------------------------------
    await step('Create Workspace on Onboarding', async () => {
      await ownerPage.fill('#workspace-name', workspaceName);
      const slugInput = await ownerPage.$('#workspace-slug');
      if (slugInput) await slugInput.fill(workspaceSlug);
      
      await ownerPage.click('button[type="submit"]');
      await ownerPage.waitForTimeout(4000);
      
      assert.ok(ownerPage.url().includes('/dashboard'), `Expected redirect to /dashboard, got ${ownerPage.url()}`);
      const bodyText = await ownerPage.innerText('body');
      assert.ok(bodyText.includes(workspaceName), `Page body should display workspace name "${workspaceName}"`);
    });

    // -------------------------------------------------------------
    // Journey 4: Team Creation & Management
    // -------------------------------------------------------------
    let teamId = '';
    await step('Create Public Team', async () => {
      await ownerPage.goto(`${TARGET_URL}/teams`, { waitUntil: 'networkidle' });
      const createBtn = await ownerPage.$('button:has-text("Create team"), button:has-text("New team")');
      assert.ok(createBtn, 'Create team button should be present');
      await createBtn.click();
      await ownerPage.waitForTimeout(1000);

      const nameInput = await ownerPage.$('input[placeholder*="Engineering"], input[name="name"], #team-name');
      assert.ok(nameInput, 'Team name input must exist');
      await nameInput.fill(teamName);

      const keyInput = await ownerPage.$('input[placeholder*="ENG"], input[name="key"], #team-key');
      if (keyInput) await keyInput.fill(teamKey);

      const submitBtn = await ownerPage.$('button[type="submit"]:has-text("Create"), button:has-text("Save")');
      assert.ok(submitBtn, 'Submit button must exist');
      await submitBtn.click();
      await ownerPage.waitForTimeout(3000);

      const url = ownerPage.url();
      assert.ok(url.includes('/teams/'), `Expected team URL after creation, got ${url}`);
      teamId = url.split('/teams/')[1].split('?')[0];
    });

    await step('Configure Custom Workflow State ("QA Testing")', async () => {
      await ownerPage.goto(`${TARGET_URL}/teams/${teamId}?tab=settings`, { waitUntil: 'networkidle' });
      await ownerPage.waitForTimeout(1000);

      const addStateBtn = await ownerPage.$('button:has-text("Add state")');
      assert.ok(addStateBtn, 'Add state button must be present in workflow settings');
      await addStateBtn.click();
      await ownerPage.waitForTimeout(1000);

      const inputs = await ownerPage.$$('input[id*="workflow-"][id*="-name"]');
      let targetInput = null;
      for (const inp of inputs) {
        if ((await inp.inputValue()) === 'New state') {
          targetInput = inp;
          break;
        }
      }
      assert.ok(targetInput, 'New state input must be generated in workflow list');
      await targetInput.fill('QA Testing');

      const saveBtn = await ownerPage.$('button:has-text("Save changes")');
      assert.ok(saveBtn, 'Save changes button must exist');
      await saveBtn.click();
      await ownerPage.waitForTimeout(3000);

      const stateQuery = await ownerPage.request.get(`${TARGET_URL}/api/teams/${teamId}/workflow-states`);
      const states = await stateQuery.json();
      assert.ok(states.some(s => s.name === 'QA Testing'), 'New custom state "QA Testing" must be persisted in API');
    });

    // -------------------------------------------------------------
    // Journey 5: Member Invitation & Mailinator Acceptance
    // -------------------------------------------------------------
    let inviteAcceptLink = '';
    await step('Invite New Member via Email', async () => {
      await ownerPage.goto(`${TARGET_URL}/users`, { waitUntil: 'networkidle' });
      const inviteBtn = await ownerPage.$('button:has-text("Invite"), button:has-text("Invite User")');
      assert.ok(inviteBtn, 'Invite user button should exist');
      await inviteBtn.click();
      await ownerPage.waitForTimeout(1000);

      const emailInput = await ownerPage.$('input[type="email"], input[placeholder*="email"], #invite-email');
      assert.ok(emailInput, 'Invite email input must exist');
      await emailInput.fill(memberEmail);

      const submitInvite = await ownerPage.$('button[type="submit"]:has-text("Invite"), button:has-text("Send invitation")');
      assert.ok(submitInvite, 'Submit invite button must exist');
      await submitInvite.click();
      await ownerPage.waitForTimeout(3000);
    });

    await step('Fetch Invitation Email from Mailinator', async () => {
      const username = memberEmail.split('@')[0];
      const mail = await fetchMailinatorEmail(ownerContext, username, 'invited you');
      assert.ok(mail.links.length > 0, 'Should find invitation link in email');
      inviteAcceptLink = mail.links[0];
      assert.ok(inviteAcceptLink.includes('/accept-invitation/'), 'Link must be invitation acceptance URL');
    });

    // Test in an isolated member context
    const memberContext = await browser.newContext({ ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS });
    const memberPage = await memberContext.newPage();

    await step('Invited Member Signup & Invitation Acceptance', async () => {
      await memberPage.goto(`${TARGET_URL}/signup?redirect=${encodeURIComponent(new URL(inviteAcceptLink).pathname)}`, { waitUntil: 'networkidle' });
      await memberPage.fill('#signup-name', 'Audit Member');
      await memberPage.fill('#signup-email', memberEmail);
      await memberPage.fill('#signup-password', testPassword);
      await memberPage.click('button[type="submit"]');
      await memberPage.waitForTimeout(3000);

      const username = memberEmail.split('@')[0];
      const verifyMail = await fetchMailinatorEmail(memberContext, username, 'Verify your email');
      const memberVerifyLink = verifyMail.links[0];

      await memberPage.goto(memberVerifyLink, { waitUntil: 'networkidle' });
      await memberPage.waitForTimeout(3000);
      assert.ok(memberPage.url().includes('/accept-invitation/'), `Expected accept invitation page, got ${memberPage.url()}`);

      const acceptBtn = await memberPage.$('button:has-text("Accept invitation")');
      assert.ok(acceptBtn, 'Accept invitation button should be visible');
      await acceptBtn.click();
      await memberPage.waitForTimeout(4000);
      assert.ok(memberPage.url().includes('/dashboard'), `Expected dashboard after acceptance, got ${memberPage.url()}`);
    });

    await step('Verify Role-Based Access Control (RBAC) Restrictions', async () => {
      await memberPage.goto(`${TARGET_URL}/settings`, { waitUntil: 'networkidle' });
      const settingsContent = await memberPage.innerText('body');
      assert.ok(!settingsContent.includes('Administrations'), 'Member should not see Administrations section');
      
      // Attempt direct URL access to workspace administration
      await memberPage.goto(`${TARGET_URL}/settings/workspace`, { waitUntil: 'networkidle' });
      const wsAccessText = await memberPage.innerText('body');
      assert.ok(wsAccessText.includes('Only workspace owners and admins can manage these settings'), 'Direct admin access must be blocked with an informative message');
    });

    await memberContext.close();

    // -------------------------------------------------------------
    // Journey 6: Issues Full CRUD & Workflow
    // -------------------------------------------------------------
    const issueTitle = `Audit Automated Issue ${runId}`;
    await step('Create Issue with Team & Details', async () => {
      await ownerPage.goto(`${TARGET_URL}/issues`, { waitUntil: 'networkidle' });
      const newIssueBtn = await ownerPage.$('button:has-text("New Issue"), button:has-text("New issue")');
      assert.ok(newIssueBtn, 'New Issue button must be visible');
      await newIssueBtn.click();
      await ownerPage.waitForTimeout(1000);

      const titleInput = await ownerPage.$('input[placeholder*="Issue title"], input[placeholder*="Title"], #issue-title');
      assert.ok(titleInput, 'Issue title input must exist');
      await titleInput.fill(issueTitle);

      const submitBtn = await ownerPage.$('button[type="submit"]:has-text("Create issue"), button:has-text("Create Issue")');
      assert.ok(submitBtn, 'Submit issue button must exist');
      await submitBtn.click();
      await ownerPage.waitForTimeout(3000);

      await ownerPage.goto(`${TARGET_URL}/issues`, { waitUntil: 'networkidle' });
      const pageText = await ownerPage.innerText('main');
      assert.ok(pageText.includes(issueTitle), `Issue "${issueTitle}" should be listed in issues view`);
    });

    // -------------------------------------------------------------
    // Journey 7: Projects & Milestones
    // -------------------------------------------------------------
    const projectName = `Audit Project ${runId}`;
    await step('Create Project & Verify Details', async () => {
      await ownerPage.goto(`${TARGET_URL}/projects`, { waitUntil: 'networkidle' });
      const newProjBtn = await ownerPage.$('button:has-text("New project"), button:has-text("Create project")');
      assert.ok(newProjBtn, 'New project button must exist');
      await newProjBtn.click();
      await ownerPage.waitForTimeout(1000);

      const nameInput = await ownerPage.$('input[placeholder*="Project name"], input[name="name"], #project-name');
      assert.ok(nameInput, 'Project name input must exist');
      await nameInput.fill(projectName);

      const submitBtn = await ownerPage.$('button[type="submit"]:has-text("Create"), button:has-text("Create Project")');
      if (submitBtn) await submitBtn.click();
      await ownerPage.waitForTimeout(3000);

      await ownerPage.goto(`${TARGET_URL}/projects`, { waitUntil: 'networkidle' });
      const projectsText = await ownerPage.innerText('main');
      assert.ok(projectsText.includes(projectName), `Project "${projectName}" should be listed in projects view`);
    });

    // -------------------------------------------------------------
    // Journey 8: Clients & Contact Management
    // -------------------------------------------------------------
    const clientName = `Audit Client ${runId}`;
    await step('Create Client Record', async () => {
      await ownerPage.goto(`${TARGET_URL}/clients`, { waitUntil: 'networkidle' });
      const newClientBtn = await ownerPage.$('button:has-text("New Client"), button:has-text("New client")');
      assert.ok(newClientBtn, 'New client button must exist');
      await newClientBtn.click();
      await ownerPage.waitForTimeout(1000);

      const nameInput = await ownerPage.$('input[placeholder*="Acme"], input[name="name"], #client-name');
      assert.ok(nameInput, 'Client name input must exist');
      await nameInput.fill(clientName);

      const submitBtn = await ownerPage.$('button[type="submit"]:has-text("Create"), button:has-text("Save")');
      if (submitBtn) await submitBtn.click();
      await ownerPage.waitForTimeout(3000);

      await ownerPage.goto(`${TARGET_URL}/clients`, { waitUntil: 'networkidle' });
      const clientsText = await ownerPage.innerText('main');
      assert.ok(clientsText.includes(clientName), `Client "${clientName}" should be listed in clients view`);
    });

    // -------------------------------------------------------------
    // Journey 9: Triage, Cycles, Documents, Insights, Inbox
    // -------------------------------------------------------------
    await step('Verify Triage Workbench View', async () => {
      await ownerPage.goto(`${TARGET_URL}/triage`, { waitUntil: 'networkidle' });
      assert.equal(ownerPage.url(), `${TARGET_URL}/triage`);
      const text = await ownerPage.innerText('main');
      assert.ok(text.includes('Triage') || text.includes('intake'), 'Triage queue page must load properly');
    });

    await step('Verify Cycles Planning View', async () => {
      await ownerPage.goto(`${TARGET_URL}/cycles`, { waitUntil: 'networkidle' });
      assert.equal(ownerPage.url(), `${TARGET_URL}/cycles`);
      const text = await ownerPage.innerText('main');
      assert.ok(text.includes('Cycles') || text.includes('cadence'), 'Cycles page must load properly');
    });

    await step('Verify Documents Knowledge Base View', async () => {
      await ownerPage.goto(`${TARGET_URL}/documents`, { waitUntil: 'networkidle' });
      assert.equal(ownerPage.url(), `${TARGET_URL}/documents`);
      const text = await ownerPage.innerText('main');
      assert.ok(text.includes('Documents'), 'Documents page must load properly');
    });

    await step('Verify Insights Delivery Metrics View', async () => {
      await ownerPage.goto(`${TARGET_URL}/insights`, { waitUntil: 'networkidle' });
      assert.equal(ownerPage.url(), `${TARGET_URL}/insights`);
      const text = await ownerPage.innerText('main');
      assert.ok(text.includes('Insights') || text.includes('Throughput'), 'Insights metrics page must load properly');
    });

    await step('Verify Personal Inbox View', async () => {
      await ownerPage.goto(`${TARGET_URL}/inbox`, { waitUntil: 'networkidle' });
      assert.equal(ownerPage.url(), `${TARGET_URL}/inbox`);
      const text = await ownerPage.innerText('main');
      assert.ok(text.includes('Inbox') || text.includes('Notifications') || text.includes('All caught up'), 'Inbox view must load properly');
    });

    // -------------------------------------------------------------
    // Journey 10: Edge Cases & Error Boundaries
    // -------------------------------------------------------------
    await step('Verify 404 Route Error Boundary', async () => {
      await ownerPage.goto(`${TARGET_URL}/non-existent-route-${runId}`, { waitUntil: 'networkidle' });
      const text = await ownerPage.innerText('body');
      assert.ok(text.includes('Page not found'), 'Non-existent route should display Page Not Found error page');
    });

    await step('Verify Non-Existent Issue Error Handling', async () => {
      await ownerPage.goto(`${TARGET_URL}/issues/00000000-0000-0000-0000-000000000000`, { waitUntil: 'domcontentloaded' });
      await ownerPage.waitForSelector('text=Issue unavailable', { timeout: 10000 });
      const text = await ownerPage.innerText('body');
      assert.ok(text.includes('Issue unavailable'), 'Invalid issue ID should display graceful unavailable alert');
    });

  } finally {
    await ownerContext.close();
    await browser.close();
  }

  console.log('\n' + '='.repeat(70));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(70));
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  console.log(`Total Steps: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('\nAudit execution encountered fatal error:', err);
  process.exit(1);
});
