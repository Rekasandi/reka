export const REACTION_EMOJIS = ['👍', '👎', '❤️', '🎉', '😄', '😕', '🚀', '👀'] as const;
export interface ReactionSummary { emoji: string; count: number; reacted: boolean }
export interface IssueReactions { issue: ReactionSummary[]; comments: Record<string, ReactionSummary[]> }

export async function getIssueReactions(issueId: string): Promise<IssueReactions> {
  const response = await fetch(`/api/reactions/by-issue/${issueId}`);
  if (!response.ok) throw new Error('Failed to load reactions');
  return response.json();
}

export async function toggleReaction(target: { issueId?: string; commentId?: string }, emoji: string): Promise<{ active: boolean }> {
  const response = await fetch('/api/reactions/toggle', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...target, emoji }) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Could not update reaction');
  return response.json();
}
