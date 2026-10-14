import type { Request, CookieOptions } from 'express';

export const sessionCookieName = () => process.env.NODE_ENV === 'production' ? '__Host-reka_session' : 'reka_session';
export const oauthCookieName = () => process.env.NODE_ENV === 'production' ? '__Host-reka_oauth_state' : 'reka_oauth_state';
export const authCookieOptions = (maxAge?: number): CookieOptions => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  ...(maxAge !== undefined ? { maxAge } : {}),
});
export function sessionToken(request: Request): string | undefined {
  const cookie = request.cookies?.[sessionCookieName()];
  return typeof cookie === 'string' ? cookie : request.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
}
