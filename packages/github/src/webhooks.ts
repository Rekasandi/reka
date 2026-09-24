import * as crypto from 'node:crypto';
import type { ParsedIssueReference } from './types';

/**
 * Verify GitHub webhook HMAC-SHA256 signature
 */
export function verifyGithubWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * Parse issue references like "RS-123", "feat(RS-123): ...", "branch: feature/RS-123-title"
 */
export function parseIssueIdentifiers(text: string): ParsedIssueReference[] {
  if (!text) return [];
  const regex = /([A-Z]{2,10})-(\d+)/g;
  const matches: ParsedIssueReference[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      raw: match[0],
      teamKey: match[1],
      number: parseInt(match[2], 10),
    });
  }

  return matches;
}
