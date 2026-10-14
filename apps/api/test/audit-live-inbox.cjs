const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../../../.env') });

const { eq, sql } = require('drizzle-orm');
const { activities, createDbClient, issues, notifications, projects, teams } = require('@reka/database');

const knownFixtureTitles = new Set([
  'PR #142 Merged: Add optimistic UI updates for Kanban board',
  'Sarah Jenkins mentioned you on RS-58',
  'Assigned to RS-64: High-velocity triage inbox',
  'Alex Morgan requested your review on PR #149',
  'RS-49 moved to In Review',
  'Cycle 12 ends in 2 days',
  'Alex Morgan mentioned you on RS-104',
  'PR #182 Merged: Enhance issue query pagination',
]);

async function audit() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the read-only live Inbox audit');
  const db = createDbClient(databaseUrl);
  const [rows, issueRows, teamRows, projectRows, statusActivities, migrations] = await Promise.all([
    db.select().from(notifications),
    db.select({ id: issues.id, identifier: issues.identifier }).from(issues),
    db.select({ id: teams.id }).from(teams),
    db.select({ id: projects.id }).from(projects),
    db.select({ issueId: activities.issueId, metadata: activities.metadata, createdAt: activities.createdAt })
      .from(activities).where(eq(activities.type, 'issue.status_changed')),
    db.execute(sql`select created_at from drizzle.__drizzle_migrations order by created_at`),
  ]);
  const issuesById = new Map(issueRows.map((row) => [row.id, row]));
  const teamIds = new Set(teamRows.map((row) => row.id));
  const projectIds = new Set(projectRows.map((row) => row.id));
  const byType = {};
  const records = [];
  const notificationGroups = new Map();
  let legacyFixtureTitles = 0;
  let unsupportedTypes = 0;
  let missingSource = 0;
  let mismatchedIssueIdentifiers = 0;

  for (const row of rows) {
    byType[row.type] = (byType[row.type] || 0) + 1;
    legacyFixtureTitles += Number(knownFixtureTitles.has(row.title));
    const groupKey = `${row.userId}\\0${row.type}\\0${JSON.stringify(row.metadata)}`;
    const group = notificationGroups.get(groupKey) || [];
    group.push(row);
    notificationGroups.set(groupKey, group);
    let sourceExists = false;
    let issueIdentifierMatches = null;

    if (['assignment', 'comment', 'mention', 'status_change', 'pr_merged'].includes(row.type)) {
      const issue = issuesById.get(row.metadata.issueId);
      sourceExists = Boolean(issue);
      issueIdentifierMatches = Boolean(issue && issue.identifier === row.metadata.issueIdentifier);
      if (!sourceExists) missingSource += 1;
      if (issueIdentifierMatches === false) mismatchedIssueIdentifiers += 1;
      if (row.metadata.webhookEventId && !row.metadata.prNumber) unsupportedTypes += 1;
    } else if (row.type === 'team_invite') {
      sourceExists = teamIds.has(row.metadata.teamId);
      if (!sourceExists) missingSource += 1;
    } else if (row.type === 'project_invite') {
      sourceExists = projectIds.has(row.metadata.projectId);
      if (!sourceExists) missingSource += 1;
    } else {
      unsupportedTypes += 1;
    }

    records.push({
      type: row.type,
      issueIdentifier: row.metadata.issueIdentifier || null,
      sourceExists,
      issueIdentifierMatches,
      notificationFingerprint: createHash('sha256')
        .update(`${row.userId}\0${row.type}\0${JSON.stringify(row.metadata)}`)
        .digest('hex')
        .slice(0, 16),
    });
  }

  const duplicateGroups = [...notificationGroups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      type: group[0].type,
      issueIdentifier: group[0].metadata.issueIdentifier || null,
      count: group.length,
      createdAt: group.map((row) => row.createdAt).sort(),
      notificationTransitions: group.map((row) => ({ from: row.metadata.fromStatus || null, to: row.metadata.toStatus || null })),
      statusTransitions: statusActivities
        .filter((activity) => activity.issueId === group[0].metadata.issueId)
        .map((activity) => ({ from: activity.metadata?.from, to: activity.metadata?.to, createdAt: activity.createdAt }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    }));
  const result = {
    generatedAt: new Date().toISOString(),
    scope: 'Read-only audit of all current Inbox notifications; DATABASE_URL redacted.',
    migrations: migrations.rows.map((row) => String(row.created_at)),
    total: rows.length,
    byType,
    duplicateGroups,
    knownFixtureTitleMatches: legacyFixtureTitles,
    orphanedOrUnverifiableSources: missingSource,
    mismatchedIssueIdentifiers,
    unsupportedTypes,
    records,
  };
  if (legacyFixtureTitles || missingSource || mismatchedIssueIdentifiers || unsupportedTypes) {
    throw new Error(`Inbox audit failed: ${JSON.stringify({ legacyFixtureTitles, missingSource, mismatchedIssueIdentifiers, unsupportedTypes })}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

audit().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
