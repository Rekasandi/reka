export interface EmailContent { subject: string; text: string; html: string }

export const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function layout({ heading, paragraphs, action, footer }: { heading: string; paragraphs: string[]; action?: { label: string; url: string }; footer: string }) {
  const body = paragraphs.map(text => `<p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#1f2328;">${escapeHtml(text)}</p>`).join('');
  const button = action ? `<p style="margin:22px 0;"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 18px;background:#111111;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 14px;font-size:12px;line-height:18px;color:#57606a;">Or paste this link into your browser:<br><a href="${escapeHtml(action.url)}" style="color:#57606a;word-break:break-all;">${escapeHtml(action.url)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d0d7de;border-radius:8px;padding:28px;">
<p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#111111;">REKA</p>
<h1 style="margin:0 0 16px;font-size:18px;line-height:26px;color:#111111;">${escapeHtml(heading)}</h1>${body}${button}
<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #d0d7de;font-size:12px;line-height:18px;color:#57606a;">${escapeHtml(footer)}</p>
</div></body></html>`;
}

/** Plain-text header values must not contain line breaks (header injection). */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

export function invitationEmail(input: { inviterName: string; workspaceName: string; role: string; url: string; expiresAt: Date }): EmailContent {
  const inviter = oneLine(input.inviterName) || 'A teammate';
  const workspace = oneLine(input.workspaceName) || 'a workspace';
  const expires = input.expiresAt.toUTCString();
  const lines = [
    `${inviter} invited you to join ${workspace} on REKA as a ${input.role}.`,
    'Open the link, sign in or create an account with this email address, and accept the invitation.',
  ];
  const footer = `This invitation expires on ${expires}. If you were not expecting it, you can ignore this email.`;
  return {
    subject: `${inviter} invited you to ${workspace} on REKA`,
    text: `${lines.join('\n\n')}\n\nAccept the invitation: ${input.url}\n\n${footer}`,
    html: layout({ heading: `Join ${workspace} on REKA`, paragraphs: lines, action: { label: 'Accept invitation', url: input.url }, footer }),
  };
}

export function notificationEmail(input: { title: string; body: string; url?: string; preferencesUrl: string }): EmailContent {
  const footer = `You receive this because email notifications are turned on in your REKA notification preferences: ${input.preferencesUrl}`;
  return {
    subject: oneLine(input.title) || 'New REKA notification',
    text: `${input.body}${input.url ? `\n\nOpen in REKA: ${input.url}` : ''}\n\n${footer}`,
    html: layout({ heading: oneLine(input.title), paragraphs: [input.body], action: input.url ? { label: 'Open in REKA', url: input.url } : undefined, footer: 'You receive this because email notifications are turned on in your REKA notification preferences.' }),
  };
}

export function verificationEmail(input: { url: string }): EmailContent {
  const lines = ['Confirm this email address to finish creating your REKA account.', 'The link works once and expires in an hour.'];
  const footer = 'If you did not create a REKA account, you can ignore this email.';
  return { subject: 'Verify your email for REKA', text: `${lines.join('\n\n')}\n\nVerify email: ${input.url}\n\n${footer}`,
    html: layout({ heading: 'Verify your email', paragraphs: lines, action: { label: 'Verify email', url: input.url }, footer }) };
}

export function resetPasswordEmail(input: { url: string }): EmailContent {
  const lines = ['Someone asked to reset the password for your REKA account.', 'The link works once and expires in an hour.'];
  const footer = 'If you did not ask for a reset, your password stays the same and you can ignore this email.';
  return { subject: 'Reset your REKA password', text: `${lines.join('\n\n')}\n\nReset password: ${input.url}\n\n${footer}`,
    html: layout({ heading: 'Reset your password', paragraphs: lines, action: { label: 'Reset password', url: input.url }, footer }) };
}

export function changeEmailEmail(input: { newEmail: string; url: string }): EmailContent {
  const lines = [`Confirm that you want to change the sign-in email of your REKA account to ${input.newEmail}.`, 'The link works once and expires in an hour.'];
  const footer = 'If you did not ask for this, ignore this email; your email address stays the same.';
  return { subject: 'Confirm your new email for REKA', text: `${lines.join('\n\n')}\n\nConfirm email change: ${input.url}\n\n${footer}`,
    html: layout({ heading: 'Confirm your new email', paragraphs: lines, action: { label: 'Confirm email change', url: input.url }, footer }) };
}

export function magicLinkEmail(input: { url: string }): EmailContent {
  const lines = ['Use this link to sign in to REKA. No password needed.', 'The link works once and expires in 15 minutes.'];
  const footer = 'If you did not request this, you can ignore this email.';
  return { subject: 'Your REKA sign-in link', text: `${lines.join('\n\n')}\n\nSign in: ${input.url}\n\n${footer}`,
    html: layout({ heading: 'Sign in to REKA', paragraphs: lines, action: { label: 'Sign in', url: input.url }, footer }) };
}
