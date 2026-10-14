export interface MentionCandidate {
  id: string;
  name: string;
  email: string;
  githubUsername?: string | null;
}

export function getCommentNotificationRecipients(
  content: string,
  candidates: MentionCandidate[],
  issue: { assigneeId: string | null; reporterId: string | null },
  authorId: string,
) {
  const handles = [...content.matchAll(/(?:^|\s)@([\w.-]+)/g)].map((match) => match[1].toLowerCase());
  const recipients = new Set<string>();

  if (handles.length) {
    for (const user of candidates) {
      const emailHandle = user.email.split('@')[0].toLowerCase();
      const nameHandle = user.name.toLowerCase().replace(/\s+/g, '');
      const githubHandle = user.githubUsername?.toLowerCase();
      if (handles.some((handle) => handle === emailHandle || handle === nameHandle || handle === githubHandle)) {
        recipients.add(user.id);
      }
    }
  } else {
    if (issue.assigneeId) recipients.add(issue.assigneeId);
    if (issue.reporterId) recipients.add(issue.reporterId);
  }

  recipients.delete(authorId);
  return { recipients: [...recipients], isMention: handles.length > 0 };
}
