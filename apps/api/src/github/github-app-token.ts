import { sign } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'REKA-Platform-App',
};

export function createGithubAppJwt(): { appId: string; jwt: string } {
  const appId = process.env.GITHUB_APP_ID;
  const rawPrivateKey = process.env.GITHUB_PRIVATE_KEY;
  if (!appId || !rawPrivateKey) {
    throw new ServiceUnavailableException('GitHub App credentials are not configured');
  }
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: issuedAt - 60, exp: issuedAt + 540, iss: appId })}`;
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  return { appId, jwt };
}

export async function installationTokenFor(installationId: number): Promise<string | null> {
  try {
    const { jwt } = createGithubAppJwt();
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { token?: string };
    return typeof body.token === 'string' && body.token ? body.token : null;
  } catch {
    return null;
  }
}

export interface GithubInstallationRepoPayload {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch?: string;
  description?: string | null;
  owner?: { login?: string };
}

export async function listInstallationRepositories(installationId: number): Promise<GithubInstallationRepoPayload[]> {
  const token = await installationTokenFor(installationId);
  if (!token) return [];
  try {
    const response = await fetch('https://api.github.com/installation/repositories?per_page=100', {
      headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { repositories?: GithubInstallationRepoPayload[] };
    return Array.isArray(body.repositories) ? body.repositories : [];
  } catch {
    return [];
  }
}
