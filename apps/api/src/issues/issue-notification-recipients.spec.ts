import { deepEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { getIssueNotificationRecipients } from './issue-notification-recipients';

test('assignment and status notifications exclude actor and deduplicate recipients', () => {
  deepEqual(getIssueNotificationRecipients('assignee', 'actor', 'actor'), ['assignee']);
  deepEqual(getIssueNotificationRecipients('actor', 'actor', 'actor'), []);
  deepEqual(getIssueNotificationRecipients('assignee', 'reporter', 'actor'), ['assignee', 'reporter']);
});
