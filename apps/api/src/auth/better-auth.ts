import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, magicLink, organization } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, memberAc, ownerAc } from 'better-auth/plugins/organization/access';
import {
  accounts, organizationMembers, organizations, sessions, users, verifications, workspaceInvitations, type DbClient,
} from '@reka/database';
import type { EmailContent } from '../mail/mail-templates';
import { changeEmailEmail, invitationEmail, magicLinkEmail, resetPasswordEmail, verificationEmail } from '../mail/mail-templates';

export interface AuthMailer { isConfigured(): boolean; send(to: string, content: EmailContent): Promise<{ sent: boolean; error?: string }> }

/** Workspace roles: owner/admin manage the workspace; member works; guest/client are read-only (checked by the API guard). */
const ac = createAccessControl({ ...defaultStatements, workspace: ['manage'] } as const);
export const workspaceRoles = {
  owner: ac.newRole({ ...ownerAc.statements, workspace: ['manage'] }),
  admin: ac.newRole({ ...adminAc.statements, workspace: ['manage'] }),
  member: ac.newRole({ ...memberAc.statements }),
  guest: ac.newRole({}),
  client: ac.newRole({}),
};

export const webUrl = () => process.env.WEB_URL || 'http://localhost:5173';

/**
 * Better Auth owns sign-up/sign-in (email + password with verification, magic links, GitHub), sessions and
 * workspace (organization) membership/invitations. It runs on REKA's existing tables through field mapping.
 */
export function createAuth(db: DbClient, mail?: AuthMailer) {
  const logger = new Logger('Auth');
  const deliver = async (to: string, content: EmailContent, url: string, what: string) => {
    if (!mail?.isConfigured()) { logger.warn(`Email is not configured; ${what} link for ${to}: ${url}`); return; }
    const result = await mail.send(to, content);
    if (!result.sent) logger.warn(`Could not send ${what} email to ${to}: ${result.error}`);
  };
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('BETTER_AUTH_SECRET is required in production');

  return betterAuth({
    appName: 'REKA',
    baseURL: webUrl(),
    basePath: '/api/auth',
    secret: secret || 'reka-development-secret-change-me-0123456789',
    trustedOrigins: [webUrl(), process.env.API_URL || 'http://localhost:3000'],
    database: drizzleAdapter(db, {
      provider: 'pg', transaction: false,
      schema: { users, sessions, accounts, verifications, organizations, organization_members: organizationMembers, workspace_invitations: workspaceInvitations },
    }),
    advanced: { database: { generateId: () => randomUUID() } },
    user: {
      modelName: 'users',
      fields: { image: 'avatarUrl' },
      additionalFields: {
        githubUsername: { type: 'string', required: false, input: false },
        githubId: { type: 'string', required: false, input: false },
      },
      // The current address must confirm the change; the new one is then verified like a sign-up.
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => deliver(user.email, changeEmailEmail({ newEmail, url }), url, 'email change'),
      },
    },
    // No cookie cache: the active workspace must be current on every request after a switch or a join.
    session: { modelName: 'sessions', expiresIn: 7 * 86400, updateAge: 86400 },
    account: {
      modelName: 'accounts',
      // GitHub sign-in with a verified email joins the existing account instead of creating a second one.
      accountLinking: { enabled: true, trustedProviders: ['github'] },
    },
    verification: { modelName: 'verifications' },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => deliver(user.email, resetPasswordEmail({ url }), url, 'password reset'),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => deliver(user.email, verificationEmail({ url }), url, 'email verification'),
    },
    socialProviders: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        redirectURI: process.env.GITHUB_CALLBACK_URL || `${webUrl()}/api/auth/callback/github`,
        // `repo` lets REKA create GitHub issues and verify repositories on the user's behalf.
        scope: ['read:user', 'user:email', 'repo'],
        mapProfileToUser: (profile) => ({ githubUsername: profile.login, githubId: String(profile.id) }),
        overrideUserInfoOnSignIn: true,
      },
    } : {},
    plugins: [
      bearer(),
      magicLink({
        expiresIn: 15 * 60,
        sendMagicLink: async ({ email, url }) => deliver(email, magicLinkEmail({ url }), url, 'magic link'),
      }),
      organization({
        ac, roles: workspaceRoles,
        creatorRole: 'owner',
        allowUserToCreateOrganization: true,
        organizationLimit: 25,
        invitationExpiresIn: 7 * 86400,
        cancelPendingInvitationsOnReInvite: true,
        schema: {
          organization: { modelName: 'organizations', fields: { logo: 'logoUrl' } },
          member: { modelName: 'organization_members' },
          invitation: { modelName: 'workspace_invitations', fields: { inviterId: 'invitedById' } },
        },
        sendInvitationEmail: async (data) => {
          const url = `${webUrl()}/accept-invitation/${data.id}`;
          await deliver(data.email, invitationEmail({ inviterName: data.inviter.user.name, workspaceName: data.organization.name, role: data.role, url, expiresAt: new Date(Date.now() + 7 * 86400000) }), url, 'invitation');
        },
      }),
    ],
    databaseHooks: {
      account: {
        // Linking a GitHub account (first sign-in or re-link) records the GitHub identity on the user.
        create: { after: async (account) => syncGithubIdentity(db, account, logger) },
        update: { after: async (account) => syncGithubIdentity(db, account, logger) },
        // Unlinking GitHub (Settings → Connected accounts) clears the identity again.
        delete: { after: async (account) => { if (account.providerId === 'github') await db.update(users).set({ githubId: null, githubUsername: null, updatedAt: new Date() }).where(eq(users.id, account.userId)); } },
      },
      session: {
        create: {
          // A new session opens in the workspace joined most recently, so sign-in lands somewhere useful.
          before: async (session) => {
            const [membership] = await db.select({ organizationId: organizationMembers.organizationId }).from(organizationMembers)
              .where(and(eq(organizationMembers.userId, session.userId), eq(organizationMembers.isActive, true)))
              .orderBy(desc(organizationMembers.createdAt)).limit(1);
            return { data: { ...session, activeOrganizationId: (session as { activeOrganizationId?: string | null }).activeOrganizationId ?? membership?.organizationId ?? null } };
          },
        },
      },
    },
    rateLimit: { enabled: process.env.NODE_ENV === 'production' },
  });
}

async function syncGithubIdentity(db: DbClient, account: { userId: string; providerId: string; accountId: string; accessToken?: string | null }, logger: Logger) {
  if (account.providerId !== 'github') return;
  let login: string | undefined;
  if (account.accessToken) {
    try {
      const response = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${account.accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'REKA' }, signal: AbortSignal.timeout(10000) });
      if (response.ok) login = String((await response.json() as { login?: string }).login || '') || undefined;
    } catch (error) { logger.warn(`Could not read the GitHub profile: ${(error as Error).message}`); }
  }
  await db.update(users).set({ githubId: account.accountId, ...(login ? { githubUsername: login } : {}), updatedAt: new Date() }).where(eq(users.id, account.userId));
}

export type Auth = ReturnType<typeof createAuth>;
export const AUTH = Symbol('BETTER_AUTH');
