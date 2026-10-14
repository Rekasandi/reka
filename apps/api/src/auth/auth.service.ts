import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { users, sessions, oauthLoginAttempts } from '@reka/database';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isEmail } from 'class-validator';
import { requireWorkspace, membershipScope } from '../common/access/workspace-access';
import { WorkspaceService, secretHash, type VerifiedGithubIdentity } from '../workspace/workspace.service';

// Existing integration consumers keep their own-user/session cache contract.
export const GITHUB_USER_TOKENS = new Map<string, string>();
export const GITHUB_USERNAMES = new Map<string, string>();
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function verifiedGithubIdentity(profile: unknown, emails: unknown): VerifiedGithubIdentity {
  const p = record(profile);
  const id = typeof p.id === 'number' && Number.isSafeInteger(p.id) && p.id > 0 ? String(p.id) : '';
  const login = typeof p.login === 'string' && /^[a-z\d-]{1,39}$/i.test(p.login) ? p.login : '';
  const verifiedEmails = Array.isArray(emails) ? [...new Set(emails.map(record)
    .filter(email => email.verified === true && typeof email.email === 'string' && isEmail(email.email))
    .map(email => String(email.email).trim().toLowerCase()))] : [];
  if (!id || !login || !verifiedEmails.length) throw new UnauthorizedException('A verified GitHub email is required');
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 255) : login;
  let avatarUrl: string | null = null;
  if (typeof p.avatar_url === 'string') {
    try { if (new URL(p.avatar_url).protocol === 'https:') avatarUrl = p.avatar_url; } catch { /* no unsafe avatar fallback */ }
  }
  return { id, login, name, avatarUrl, verifiedEmails };
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService, private readonly workspace: WorkspaceService) {}

  async getGithubAuthUrl(inviteToken?: string) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) throw new UnauthorizedException('GITHUB_CLIENT_ID is not configured');
    let invitationHash: string | null = null;
    if (inviteToken !== undefined) {
      if (typeof inviteToken !== 'string' || !/^[a-f\d]{64}$/i.test(inviteToken)) throw new UnauthorizedException('Invalid invitation link');
      invitationHash = secretHash(inviteToken);
      await this.workspace.requirePendingInvitation(invitationHash);
    }
    const state = randomBytes(32).toString('hex');
    await this.database.db.delete(oauthLoginAttempts).where(lt(oauthLoginAttempts.expiresAt, new Date()));
    await this.database.db.insert(oauthLoginAttempts).values({
      stateHash: secretHash(state), invitationHash, expiresAt: new Date(Date.now() + 10 * 60000),
    });
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback');
    url.searchParams.set('scope', 'read:user user:email repo');
    url.searchParams.set('state', state);
    return { url: url.toString(), state };
  }

  async handleGithubCallback(code: string, state: string, browserState?: string) {
    if (typeof code !== 'string' || !code || code.length > 1024 || typeof state !== 'string' ||
      !/^[a-f\d]{64}$/i.test(state) || typeof browserState !== 'string' || browserState.length !== state.length ||
      !/^[a-f\d]{64}$/i.test(browserState) || !timingSafeEqual(Buffer.from(state), Buffer.from(browserState))) {
      throw new UnauthorizedException('GitHub sign-in state is invalid; start again');
    }
    // Atomically consume the nonce before contacting GitHub; cookie replay,
    // concurrent callbacks and expired attempts cannot produce another session.
    const [attempt] = await this.database.db.delete(oauthLoginAttempts)
      .where(and(eq(oauthLoginAttempts.stateHash, secretHash(state)), gt(oauthLoginAttempts.expiresAt, new Date())))
      .returning();
    if (!attempt) throw new UnauthorizedException('GitHub sign-in expired or already used; start again');
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new UnauthorizedException('GitHub sign-in is not configured');
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback' }),
    });
    const tokenData = record(await tokenResponse.json());
    if (!tokenResponse.ok || typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
      throw new UnauthorizedException('GitHub authorization failed; start again');
    }
    const githubToken = tokenData.access_token;
    const headers = { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'REKA' };
    const [profileResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(15000) }),
      fetch('https://api.github.com/user/emails', { headers, signal: AbortSignal.timeout(15000) }),
    ]);
    if (!profileResponse.ok || !emailsResponse.ok) throw new UnauthorizedException('Cannot verify the GitHub account and email');
    const identity = verifiedGithubIdentity(await profileResponse.json(), await emailsResponse.json());
    let signedIn;
    if (attempt.invitationHash) {
      signedIn = await this.workspace.acceptGithubInvitation(attempt.invitationHash, identity);
    } else {
      const existing = await this.workspace.findGithubAccount(identity);
      if (!existing) throw new UnauthorizedException('A workspace invitation is required');
      const actor = await requireWorkspace(this.database.db, existing.id);
      const [user] = await this.database.db.update(users).set({
        githubId: identity.id, githubUsername: identity.login, name: identity.name,
        avatarUrl: identity.avatarUrl ?? existing.avatarUrl, updatedAt: new Date(),
      }).where(and(eq(users.id, existing.id), or(isNull(users.githubId), eq(users.githubId, identity.id)), membershipScope(this.database.db, actor))).returning();
      if (!user) throw new UnauthorizedException('GitHub identity or workspace access changed');
      const token = randomUUID();
      // A guard rechecks membership on every request, including immediately after sign-in.
      await this.database.db.insert(sessions).values({ id: token, userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) });
      signedIn = { user: { ...user, role: actor.role }, token };
    }
    GITHUB_USER_TOKENS.set(signedIn.user.id, githubToken);
    GITHUB_USER_TOKENS.set(signedIn.token, githubToken);
    GITHUB_USERNAMES.set(signedIn.user.id, identity.login);
    GITHUB_USERNAMES.set(signedIn.token, identity.login);
    return signedIn;
  }

  async getCurrentUser(token?: string) {
    if (!token) return null;
    const [session] = await this.database.db.select().from(sessions).where(eq(sessions.id, token));
    if (!session || Date.now() >= session.expiresAt.getTime()) return null;
    const actor = await requireWorkspace(this.database.db, session.userId);
    const [user] = await this.database.db.select().from(users).where(eq(users.id, session.userId));
    if (!user) return null;
    return { ...user, role: actor.role, githubUsername: user.githubUsername || GITHUB_USERNAMES.get(token) || null };
  }

  async logout(token: string) {
    const [session] = await this.database.db.select().from(sessions).where(eq(sessions.id, token));
    if (session && GITHUB_USER_TOKENS.get(session.userId) === GITHUB_USER_TOKENS.get(token)) {
      GITHUB_USER_TOKENS.delete(session.userId);
      GITHUB_USERNAMES.delete(session.userId);
    }
    GITHUB_USER_TOKENS.delete(token);
    GITHUB_USERNAMES.delete(token);
    await this.database.db.delete(sessions).where(eq(sessions.id, token));
    return { success: true };
  }
}
