import type { CookieOptions } from 'express';

/** Options for REKA's own short-lived cookies (GitHub App install state); sign-in cookies belong to Better Auth. */
export const authCookieOptions = (maxAge?: number): CookieOptions => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  ...(maxAge !== undefined ? { maxAge } : {}),
});
