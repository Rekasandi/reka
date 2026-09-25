import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { users, sessions } from '@reka/database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// In-memory or session storage for GitHub OAuth access tokens
export const GITHUB_USER_TOKENS = new Map<string, string>();

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  getGithubAuthUrl(): string {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException('GITHUB_CLIENT_ID is not configured in .env');
    }
    const redirectUri = encodeURIComponent(
      process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback',
    );
    // Request repo scope so we can read and interact with user's real repositories
    const scope = encodeURIComponent('read:user user:email repo');

    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  }

  async handleGithubCallback(code: string) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured in .env');
    }

    // 1. Exchange code for access token with real GitHub API
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (tokenData.error || !tokenData.access_token) {
      throw new UnauthorizedException(tokenData.error_description || 'Failed to exchange GitHub authorization code');
    }

    const githubAccessToken = tokenData.access_token;

    // 2. Fetch real GitHub User profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('Failed to fetch user profile from GitHub API');
    }

    const githubUser = (await userRes.json()) as any;

    // 3. Resolve primary verified email from GitHub
    let email = githubUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as any[];
        const primary = emails.find((e: any) => e.primary && e.verified);
        email = primary?.email || emails[0]?.email;
      }
      if (!email) {
        email = `${githubUser.login}@users.noreply.github.com`;
      }
    }

    const name = githubUser.name || githubUser.login;
    const avatarUrl = githubUser.avatar_url || null;

    // 4. Find or Create User in database
    const existing = await this.database.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    let user = existing[0];

    if (!user) {
      const [created] = await this.database.db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name,
          avatarUrl,
          role: 'member',
        })
        .returning();
      user = created;
    } else {
      await this.database.db
        .update(users)
        .set({
          name,
          avatarUrl: avatarUrl || user.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      user.name = name;
      user.avatarUrl = avatarUrl || user.avatarUrl;
    }

    // 5. Create Session in database
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.database.db.insert(sessions).values({
      id: sessionToken,
      userId: user.id,
      expiresAt,
    });

    // Store GitHub token associated with this user session for repository API calls
    GITHUB_USER_TOKENS.set(user.id, githubAccessToken);
    GITHUB_USER_TOKENS.set(sessionToken, githubAccessToken);

    return { user, token: sessionToken };
  }

  async getCurrentUser(token?: string) {
    if (!token) {
      const [defaultUser] = await this.database.db.select().from(users).limit(1);
      return defaultUser || null;
    }

    const sessionList = await this.database.db.select().from(sessions).where(eq(sessions.id, token));
    if (!sessionList.length || new Date() > new Date(sessionList[0].expiresAt)) {
      const [defaultUser] = await this.database.db.select().from(users).limit(1);
      return defaultUser || null;
    }

    const [user] = await this.database.db.select().from(users).where(eq(users.id, sessionList[0].userId));
    return user || null;
  }

  async logout(token: string) {
    GITHUB_USER_TOKENS.delete(token);
    await this.database.db.delete(sessions).where(eq(sessions.id, token));
    return { success: true };
  }

  async loginOrCreateDemoUser(email: string) {
    const existing = await this.database.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    let user = existing[0];

    if (!user) {
      const [created] = await this.database.db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name: email.split('@')[0],
          role: 'owner',
        })
        .returning();
      user = created;
    }

    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.database.db.insert(sessions).values({
      id: sessionToken,
      userId: user.id,
      expiresAt,
    });

    return { user, token: sessionToken };
  }

  async generateRegistrationOptions(email: string) {
    return {
      challenge: 'mock-challenge-phase-0',
      rp: { name: 'REKA', id: 'localhost' },
      user: { id: 'mock-id', name: email, displayName: email },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    };
  }

  async generateAuthenticationOptions() {
    return {
      challenge: 'mock-challenge-phase-0',
      rpId: 'localhost',
    };
  }
}
