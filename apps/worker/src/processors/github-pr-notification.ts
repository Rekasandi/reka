export function getGithubPrRecipients(assigneeId: string | null, reporterId: string | null, senderId?: string): string[] {
  return [...new Set([assigneeId, reporterId].filter((userId): userId is string => Boolean(userId && userId !== senderId)))];
}

export type GithubPrNoticeType = 'status_change' | 'pr_review_requested' | 'pr_approved' | 'pr_changes_requested' | 'pr_closed' | 'pr_merged';

export function buildGithubPrNotification(
  issue: { id: string; identifier: string },
  pullRequest: { number: number; title: string; html_url: string },
  webhookEventId: string,
  type: GithubPrNoticeType,
) {
  const title = type === 'pr_merged' ? `PR #${pullRequest.number} merged for ${issue.identifier}`
    : type === 'pr_closed' ? `PR #${pullRequest.number} closed without merge for ${issue.identifier}`
    : type === 'pr_review_requested' ? `Review requested for PR #${pullRequest.number} on ${issue.identifier}`
    : type === 'pr_approved' ? `PR #${pullRequest.number} approved for ${issue.identifier}`
    : type === 'pr_changes_requested' ? `Changes requested on PR #${pullRequest.number} for ${issue.identifier}`
    : `${issue.identifier} moved to In Review`;
  const body = type === 'pr_merged' ? `Pull request "${pullRequest.title}" was merged.`
    : type === 'pr_closed' ? `Pull request "${pullRequest.title}" was closed without merging. The issue was not marked complete.`
    : type === 'pr_review_requested' ? `You were requested to review "${pullRequest.title}".`
    : type === 'pr_approved' ? `Pull request "${pullRequest.title}" was approved.`
    : type === 'pr_changes_requested' ? `Changes were requested on "${pullRequest.title}".`
    : `Pull request "${pullRequest.title}" was opened and moved this issue to In Review.`;
  return {
    type, title, body, link: pullRequest.html_url,
    metadata: { issueId: issue.id, issueIdentifier: issue.identifier, prNumber: pullRequest.number, prTitle: pullRequest.title, webhookEventId },
  };
}
