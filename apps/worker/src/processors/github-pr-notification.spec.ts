import { deepEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import { buildGithubPrNotification, getGithubPrRecipients } from './github-pr-notification';

test('GitHub PR events notify assignee and reporter once, excluding sender', () => {
  deepEqual(getGithubPrRecipients('assignee', 'reporter', 'reporter'), ['assignee']);
  deepEqual(getGithubPrRecipients('assignee', 'assignee', undefined), ['assignee']);
});

test('GitHub merge notification carries real PR and issue metadata', () => {
  const event = buildGithubPrNotification(
    { id: 'issue-id', identifier: 'APP-2' },
    { number: 18, title: 'Fix actual bug', html_url: 'https://github.com/acme/app/pull/18' },
    'delivery-1',
    'pr_merged',
  );
  equal(event.type, 'pr_merged');
  equal(event.title, 'PR #18 merged for APP-2');
  equal(event.link, 'https://github.com/acme/app/pull/18');
  deepEqual(event.metadata, {
    issueId: 'issue-id',
    issueIdentifier: 'APP-2',
    prNumber: 18,
    prTitle: 'Fix actual bug',
    webhookEventId: 'delivery-1',
  });
});
