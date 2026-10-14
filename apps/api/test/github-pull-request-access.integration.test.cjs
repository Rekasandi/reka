const { equal, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, projects, projectRepositories, issues, githubInstallations, githubRepositories, githubBranches, githubPullRequests, activities } = require('@reka/database');
const { ForbiddenException, NotFoundException, BadRequestException } = require('@nestjs/common');
const { GithubPullRequestsService } = require('../dist/github/pull-requests/pull-requests.service');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');

test('GitHub PR linking verifies remote repository identity and enforces current team access', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  const previousToken = process.env.GITHUB_TOKEN;
  const previousFetch = global.fetch;
  try {
    const db = postgres.db;
    const [org] = await db.insert(organizations).values({ name: 'PR Co', slug: `pr-${randomUUID().slice(0, 8)}` }).returning();
    const [owner, lead, viewer] = await db.insert(users).values([
      { name: 'Owner', email: `pr-owner-${randomUUID()}@example.test`, role: 'owner' },
      { name: 'Lead', email: `pr-lead-${randomUUID()}@example.test`, role: 'member' },
      { name: 'Viewer', email: `pr-viewer-${randomUUID()}@example.test`, role: 'member' },
    ]).returning();
    await db.insert(organizationMembers).values([
      { organizationId: org.id, userId: owner.id, role: 'owner' },
      { organizationId: org.id, userId: lead.id, role: 'member' },
      { organizationId: org.id, userId: viewer.id, role: 'member' },
    ]);
    const [team] = await db.insert(teams).values({ organizationId: org.id, name: 'Private', key: `PR${randomUUID().slice(0, 4)}`, isPrivate: true }).returning();
    await db.insert(teamMembers).values([
      { teamId: team.id, userId: lead.id, role: 'lead' },
      { teamId: team.id, userId: viewer.id, role: 'viewer' },
    ]);
    const [project] = await db.insert(projects).values({ organizationId: org.id, teamId: team.id, ownerId: lead.id, name: 'Linked project', slug: `linked-${randomUUID()}` }).returning();
    const [issue] = await db.insert(issues).values({
      teamId: team.id, projectId: project.id, reporterId: lead.id, assigneeId: viewer.id, identifier: `${team.key.toUpperCase()}-1`, number: 1, title: 'Private work', status: 'todo',
    }).returning();
    const [installation] = await db.insert(githubInstallations).values({ organizationId: org.id, installationId: Date.now(), accountLogin: 'acme' }).returning();
    const [repo, unrelatedRepo] = await db.insert(githubRepositories).values([
      { installationId: installation.id, repoId: Date.now() + 1, owner: 'acme', name: 'app', fullName: 'acme/app' },
      { installationId: installation.id, repoId: Date.now() + 2, owner: 'acme', name: 'unrelated', fullName: 'acme/unrelated' },
    ]).returning();
    await db.insert(projectRepositories).values({ projectId: project.id, repositoryId: repo.id });
    await db.insert(githubBranches).values({ repositoryId: repo.id, issueId: issue.id, name: `feature/${issue.identifier}`, sha: 'a'.repeat(40) });
    const notificationCalls = [];
    const service = new GithubPullRequestsService({ get db() { return db; } }, { async createForEvent(...args) { notificationCalls.push(args); } });
    const actor = (userId, role) => ({ userId, role, organizationId: org.id });
    await rejects(service.findByIssueId(issue.id, actor(owner.id, 'owner')), NotFoundException);
    await rejects(service.branchesByIssueId(issue.id, actor(owner.id, 'owner')), NotFoundException);
    equal((await service.repositoriesForIssue(issue.id, actor(lead.id, 'member'))).length, 1);
    equal((await service.branchesByIssueId(issue.id, actor(viewer.id, 'member'))).length, 1, 'explicit viewers may read associated branches');
    await rejects(service.linkPullRequest({ issueId: issue.id, repositoryId: unrelatedRepo.id, prNumber: 1 }, actor(lead.id, 'member')), NotFoundException);
    await rejects(service.linkPullRequest({ issueId: issue.id, repositoryId: repo.id, prNumber: 1 }, actor(viewer.id, 'member')), ForbiddenException);

    process.env.GITHUB_TOKEN = 'controlled-github-token';
    let mismatch = false;
    global.fetch = async (url) => {
      return Response.json({
        number: url.endsWith('/12') ? 12 : 11, title: 'Verified title from GitHub', state: 'open', merged: false,
        html_url: `https://github.com/acme/app/pull/${url.endsWith('/12') ? 12 : 11}`, head: { ref: `feature/${issue.identifier}` },
        base: { repo: { id: mismatch ? repo.repoId + 1 : repo.repoId } },
      });
    };
    const linked = await service.linkPullRequest({
      issueId: issue.id, repositoryId: repo.id, prNumber: 11,
    }, actor(lead.id, 'member'));
    equal(linked.repositoryId, repo.id);
    equal(linked.title, 'Verified title from GitHub');
    equal(linked.htmlUrl, 'https://github.com/acme/app/pull/11');
    equal((await db.select().from(githubPullRequests).where(eq(githubPullRequests.issueId, issue.id))).length, 1);
    const [updated] = await db.select().from(issues).where(eq(issues.id, issue.id));
    equal(updated.status, 'in_review');
    equal((await db.select().from(activities).where(eq(activities.issueId, issue.id))).length, 1);
    equal(notificationCalls.length, 1, 'newly linked PR notifies eligible recipients');
    equal((await service.linkPullRequest({ issueId: issue.id, repositoryId: repo.id, prNumber: 11 }, actor(lead.id, 'member'))).id, linked.id);
    equal((await db.select().from(activities).where(eq(activities.issueId, issue.id))).length, 1, 're-linking unchanged PR does not duplicate history');
    equal(notificationCalls.length, 1, 're-linking unchanged PR does not duplicate notifications');
    equal((await service.findByIssueId(issue.id, actor(viewer.id, 'member'))).length, 1, 'explicit viewers may read linked PRs');
    mismatch = true;
    await rejects(service.linkPullRequest({
      issueId: issue.id, repositoryId: repo.id, prNumber: 12,
    }, actor(lead.id, 'member')), BadRequestException);
    equal((await db.select().from(activities).where(eq(activities.issueId, issue.id))).length, 1);
  } finally {
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
    global.fetch = previousFetch;
    await postgres.close();
  }
});
