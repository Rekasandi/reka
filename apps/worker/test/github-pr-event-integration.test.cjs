const { deepEqual, equal } = require('node:assert/strict');
const { test } = require('node:test');
const { getTableName } = require('drizzle-orm');
const { processGithubPrEvent } = require('../dist/processors/github-pr-event');

function params(value) {
  if (!value) return [];
  if (value.constructor?.name === 'Param') return [value.value];
  if (Array.isArray(value)) return value.flatMap(params);
  return params(value.queryChunks);
}

function database() {
  const tables = {
    issues: [{ id: 'issue-1', identifier: 'APP-1', status: 'todo', assigneeId: 'assignee', reporterId: 'reporter' }],
    users: [{ id: 'sender', email: 'sender@example.com' }],
    notifications: [],
  };
  let id = 0;
  return {
    tables,
    db: {
      select: () => {
        let name;
        let rows = [];
        const query = {
          from(table) { name = getTableName(table); rows = tables[name] || []; return this; },
          where(condition) {
            const values = params(condition);
            if (name === 'issues') rows = rows.filter((row) => row.identifier === values[0]);
            if (name === 'notifications') rows = rows.filter((row) =>
              row.userId === values[0] && row.type === values[1] &&
              Boolean(row.metadata.webhookEventId) && row.metadata.issueId === 'issue-1');
            return this;
          },
          orderBy() { return this; },
          limit: async (count) => rows.slice(0, count),
          then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
        };
        return query;
      },
      insert: (table) => {
        const name = getTableName(table);
        let value;
        const commit = () => {
          const row = { id: `notification-${++id}`, read: false, ...value };
          tables[name].push(row);
          return [row];
        };
        const query = {
          values(next) { value = next; return this; },
          returning: async () => commit(),
          then: (resolve, reject) => Promise.resolve(commit()).then(resolve, reject),
        };
        return query;
      },
      update: (table) => ({
        set: (changes) => ({
          where: () => {
            const name = getTableName(table);
            tables[name] = (tables[name] || []).map((row) => ({ ...row, ...changes }));
            return { then: (resolve, reject) => Promise.resolve().then(resolve, reject) };
          },
        }),
      }),
    },
  };
}

test('GitHub PR processor fails closed when installation/repository scope is missing', async () => {
  const memory = database();
  const event = {
    eventId: 'evt-1', installationId: 0, repositoryId: 0, senderLogin: 'sender', issueIdentifiers: ['APP-1'],
    pullRequest: { number: 7, title: 'Ship feature', html_url: 'https://github.com/acme/repo/pull/7' },
    nextStatus: 'in_review',
  };

  await processGithubPrEvent(memory.db, event);
  equal(memory.tables.notifications.length, 0);
  equal(memory.tables.issues[0].status, 'todo');
});
