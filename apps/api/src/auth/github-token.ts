import { and, eq } from 'drizzle-orm';
import { accounts, type DbClient } from '@reka/database';

/** The user's GitHub OAuth token (stored by Better Auth when they sign in with GitHub), else the server token. */
export async function githubTokenFor(db: DbClient, userId: string | undefined) {
  if (userId) {
    const [account] = await db.select({ token: accounts.accessToken }).from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'github')));
    if (account?.token) return account.token;
  }
  return process.env.GITHUB_TOKEN;
}
