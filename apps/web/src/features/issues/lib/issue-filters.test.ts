import { deepEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { filterIssues, EMPTY_ISSUE_FILTERS } from './issue-filters';
import type { Issue } from '@reka/types';

const issues = [
  { id: '1', assigneeId: 'u1', projectId: 'p1', priority: 'high', labels: [{ id: 'l1' }] },
  { id: '2', assigneeId: 'u2', projectId: 'p1', priority: 'low', labels: [{ id: 'l2' }] },
  { id: '3', assigneeId: null, projectId: null, priority: 'high', labels: [{ id: 'l2' }] },
].map((issue) => ({ ...issue, labels: issue.labels.map((label) => ({ ...label, name: label.id, color: '#777' })) })) as unknown as Issue[];

test('issue filters combine dimensions with AND and selected values within a dimension with OR', () => {
  deepEqual(filterIssues(issues, {
    ...EMPTY_ISSUE_FILTERS,
    assigneeIds: ['u1', 'u2'],
    priorities: ['high'],
  }).map((issue) => issue.id), ['1']);
});

test('unassigned and unlabeled filters use explicit unassigned buckets', () => {
  deepEqual(filterIssues(issues, {
    ...EMPTY_ISSUE_FILTERS,
    assigneeIds: ['unassigned'],
    projectIds: ['unassigned'],
  }).map((issue) => issue.id), ['3']);
});

test('label filtering keeps issues with any selected label', () => {
  deepEqual(filterIssues(issues, {
    ...EMPTY_ISSUE_FILTERS,
    labelIds: ['l1', 'l2'],
  }).map((issue) => issue.id), ['1', '2', '3']);
});
