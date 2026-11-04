import { createAuthClient } from 'better-auth/react';
import { magicLinkClient, organizationClient } from 'better-auth/client/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, memberAc, ownerAc } from 'better-auth/plugins/organization/access';

// Mirrors the API's workspace roles so the client types accept guest/client invitations.
const ac = createAccessControl({ ...defaultStatements, workspace: ['manage'] } as const);
const roles = {
  owner: ac.newRole({ ...ownerAc.statements, workspace: ['manage'] }),
  admin: ac.newRole({ ...adminAc.statements, workspace: ['manage'] }),
  member: ac.newRole({ ...memberAc.statements }),
  guest: ac.newRole({}),
  client: ac.newRole({}),
};

/** Better Auth client: sign-in/sign-up, magic links, GitHub and workspaces (organizations). Same-origin via /api/auth. */
// @ts-ignore TS2742: declaration emit cannot name better-auth's nested zod types; the value type is still fully inferred.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
  plugins: [organizationClient({ ac, roles }), magicLinkClient()],
});

/** Human-readable message from a Better Auth error response. */
export function authErrorMessage(error: { message?: string; code?: string } | null | undefined, fallback = 'Something went wrong. Try again.') {
  return error?.message || fallback;
}

/** URL-safe workspace slug from a name, like "Acme Labs" → "acme-labs". */
export function slugify(name: string) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}
