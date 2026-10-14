import { Controller, Get, Post, Query, Res, Req, HttpException, ForbiddenException, NotImplementedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { authCookieOptions, oauthCookieName, sessionCookieName, sessionToken } from './session-cookie';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('github')
  async githubLogin(@Query('invite') invite: string | undefined, @Res() res: Response) {
    const { url, state } = await this.authService.getGithubAuthUrl(invite);
    res.cookie(oauthCookieName(), state, authCookieOptions(10 * 60000));
    return res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';
    const browserState = req.cookies?.[oauthCookieName()];
    res.clearCookie(oauthCookieName(), authCookieOptions());
    try {
      const { user, token } = await this.authService.handleGithubCallback(code, state, browserState);
      res.cookie(sessionCookieName(), token, authCookieOptions(7 * 86400000));
      return res.redirect(`${webUrl}/dashboard?auth=success&userId=${user.id}`);
    } catch (error) {
      // Do not put provider payloads/SQL parameters/codes/secrets in redirect URLs.
      const message = error instanceof HttpException ? error.message : 'GitHub sign-in failed; start again';
      return res.redirect(`${webUrl}/login?error=${encodeURIComponent(message)}`);
    }
  }

  // Keep legacy routes explicit, without preserving passwordless impersonation
  // or returning the former fabricated WebAuthn challenges.
  @Post('demo-login')
  demoLogin() { throw new ForbiddenException('Demo sign-in is disabled. Use verified GitHub sign-in and workspace invitations.'); }

  @Post('passkey/register-options')
  getRegistrationOptions() { throw new NotImplementedException('Passkey registration is not supported. Use GitHub sign-in.'); }

  @Get('passkey/login-options')
  getLoginOptions() { throw new NotImplementedException('Passkey sign-in is not supported. Use GitHub sign-in.'); }

  @Get('me')
  getMe(@Req() req: Request) { return this.authService.getCurrentUser(sessionToken(req)); }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = sessionToken(req);
    if (token) await this.authService.logout(token);
    res.clearCookie(sessionCookieName(), authCookieOptions());
    return res.json({ success: true });
  }
}
