const { equal, deepEqual, rejects } = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { and, eq } = require('drizzle-orm');
const { organizations, organizationMembers, users, teams, teamMembers, projects, projectRepositories, githubInstallations, githubRepositories, webhookEvents, automationRules } = require('@reka/database');
const { ForbiddenException, NotFoundException } = require('@nestjs/common');
const { GithubInstallationsService } = require('../dist/github/installations/installations.service');
const { GithubRepositoriesService } = require('../dist/github/repositories/repositories.service');
const { AutomationsService } = require('../dist/automations/automations.service');
const { createPersistentPostgres } = require('./support/persistent-postgres.cjs');

test('GitHub installations and repositories are company- and private-project-scoped', { timeout: 90000 }, async () => {
  const postgres = await createPersistentPostgres();
  try {
    const db = postgres.db;
    const [company, otherCompany] = await db.insert(organizations).values([
      { name: 'GitHub Co', slug: `gh-${randomUUID().slice(0, 8)}` },
      { name: 'Other Co', slug: `gh-other-${randomUUID().slice(0, 8)}` },
    ]).returning();
    const [owner, lead, member, other] = await db.insert(users).values([
      { name: 'Owner', email: `gh-owner-${randomUUID()}@example.test`, role: 'owner' },
      { name: 'Lead', email: `gh-lead-${randomUUID()}@example.test`, role: 'member' },
      { name: 'Member', email: `gh-member-${randomUUID()}@example.test`, role: 'member' },
      { name: 'Other', email: `gh-other-${randomUUID()}@example.test`, role: 'owner' },
    ]).returning();
    await db.insert(organizationMembers).values([
      { organizationId: company.id, userId: owner.id, role: 'owner' },
      { organizationId: company.id, userId: lead.id, role: 'member' },
      { organizationId: company.id, userId: member.id, role: 'member' },
      { organizationId: otherCompany.id, userId: other.id, role: 'owner' },
    ]);
    const [privateTeam] = await db.insert(teams).values({ organizationId: company.id, name: 'Private', key: `P${randomUUID().slice(0, 5)}`, isPrivate: true }).returning();
    await db.insert(teamMembers).values({ teamId: privateTeam.id, userId: lead.id, role: 'lead' });
    const [privateProject] = await db.insert(projects).values({ organizationId: company.id, teamId: privateTeam.id, ownerId: lead.id, name: 'Private', slug: `private-${randomUUID()}` }).returning();
    const [installation, foreignInstallation] = await db.insert(githubInstallations).values([
      { organizationId: company.id, installationId: Date.now(), accountLogin: 'acme', accountType: 'Organization' },
      { organizationId: otherCompany.id, installationId: Date.now() + 1, accountLogin: 'other', accountType: 'Organization' },
    ]).returning();
    const [publicRepo, privateRepo, foreignRepo] = await db.insert(githubRepositories).values([
      { installationId: installation.id, repoId: Date.now() + 10, owner: 'acme', name: 'public', fullName: 'acme/public', isPrivate: false },
      { installationId: installation.id, repoId: Date.now() + 11, owner: 'acme', name: 'private', fullName: 'acme/private', isPrivate: true },
      { installationId: foreignInstallation.id, repoId: Date.now() + 12, owner: 'other', name: 'secret', fullName: 'other/secret', isPrivate: true },
    ]).returning();
    await db.insert(projectRepositories).values({ projectId: privateProject.id, repositoryId: privateRepo.id });
    await db.insert(webhookEvents).values([
      { deliveryId: `company-${randomUUID()}`, event: 'push', payload: { installation: { id: installation.installationId } }, error: 'controlled test failure' },
      { deliveryId: `other-${randomUUID()}`, event: 'push', payload: { installation: { id: foreignInstallation.installationId } } },
      { deliveryId: `unscoped-${randomUUID()}`, event: 'push', payload: { repository: { id: publicRepo.repoId } } },
    ]);
    await db.insert(automationRules).values([
      { organizationId: company.id, name: 'Workspace rule', trigger: 'issue.updated', conditions: [], actions: [] },
      { organizationId: company.id, teamId: privateTeam.id, name: 'Private team rule', trigger: 'issue.updated', conditions: [], actions: [] },
      { organizationId: company.id, projectId: privateProject.id, name: 'Private project rule', trigger: 'issue.updated', conditions: [], actions: [] },
      { organizationId: otherCompany.id, name: 'Other company rule', trigger: 'issue.updated', conditions: [], actions: [] },
    ]);

    const installations = new GithubInstallationsService({ get db() { return db; } });
    const repositories = new GithubRepositoriesService({ get db() { return db; } });
    const automations = new AutomationsService({ get db() { return db; } });
    const as = (userId, role, organizationId) => ({ userId, role, organizationId });
    const ownerActor = as(owner.id, 'owner', company.id);
    const memberActor = as(member.id, 'member', company.id);
    const leadActor = as(lead.id, 'member', company.id);
    const otherActor = as(other.id, 'owner', otherCompany.id);
    equal((await installations.findAll(ownerActor)).length, 1);
    equal((await installations.findAll(ownerActor))[0].repositories.length, 2);
    const companyDeliveries = await installations.webhookDeliveries(ownerActor);
    equal(companyDeliveries.length, 1); equal(companyDeliveries[0].error, 'controlled test failure');
    await rejects(installations.webhookDeliveries(memberActor), ForbiddenException);
    equal((await installations.webhookDeliveries(otherActor)).length, 1, 'workspace admins cannot see another installation’s delivery payload/status');
    equal((await installations.findAll(otherActor))[0].repositories[0].fullName, 'other/secret');
    deepEqual((await repositories.findAll(memberActor)).map(({ fullName }) => fullName), ['acme/public']);
    deepEqual((await repositories.findAll(leadActor)).map(({ fullName }) => fullName).sort(), ['acme/private', 'acme/public']);
    await rejects(installations.delete(installation.id, otherActor), NotFoundException);
    await rejects(repositories.delete(privateRepo.id, memberActor), NotFoundException);
    equal((await repositories.findAll(ownerActor)).some(({ id }) => id === foreignRepo.id), false);
    deepEqual((await automations.findAll(memberActor)).map(({ name }) => name), ['Workspace rule']);
    deepEqual((await automations.findAll(leadActor)).map(({ name }) => name).sort(), ['Private project rule', 'Private team rule', 'Workspace rule']);
  } finally {
    await postgres.close();
  }
});

test('workspace integration management rejects member elevation attempts', async () => {
  const { requireAdmin } = require('../dist/common/access/workspace-access');
  await rejects(Promise.resolve().then(() => requireAdmin({ role: 'member' })), ForbiddenException);
  requireAdmin({ role: 'admin' });
});
