export function getIssueNotificationRecipients(
  assigneeId: string | null,
  reporterId: string | null,
  actorId: string,
  subscribers: string[] = [],
): string[] {
  return [...new Set([assigneeId, reporterId, ...subscribers].filter((userId): userId is string => Boolean(userId && userId !== actorId)))];
}
