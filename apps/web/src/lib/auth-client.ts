import { createAuthClient } from 'better-auth/react';

// Better Auth React Client configuration
export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export const { signIn, signOut, useSession } = authClient;
