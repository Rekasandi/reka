import { deepEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import { getCommentNotificationRecipients } from './mention-recipients';

const users = [
  { id: 'author', name: 'Sam Sender', email: 'sam@example.com', githubUsername: 'samsender' },
  { id: 'mentioned', name: 'Pat Person', email: 'pat@example.com', githubUsername: 'pat-dev' },
  { id: 'assignee', name: 'Alex Assignee', email: 'alex@example.com', githubUsername: 'alex' },
];

test('mentions notify exact GitHub user and email handles once, excluding author', () => {
  const result = getCommentNotificationRecipients(
    'Hi @pat-dev and @pat-dev',
    users,
    { assigneeId: 'assignee', reporterId: 'author' },
    'author',
  );
  deepEqual(result.recipients, ['mentioned']);
  equal(result.isMention, true);
});

test('non-mention comments notify assignee and reporter, excluding author', () => {
  const result = getCommentNotificationRecipients(
    'A real comment',
    users,
    { assigneeId: 'assignee', reporterId: 'author' },
    'author',
  );
  deepEqual(result.recipients, ['assignee']);
  equal(result.isMention, false);
});
