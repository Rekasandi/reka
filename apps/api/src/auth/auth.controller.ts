import { Controller, Post, Body, Get, Query, Res, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('github')
  githubLogin(@Res() res: Response) {
    const url = this.authService.getGithubAuthUrl();
    return res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';
    try {
      const { user, token } = await this.authService.handleGithubCallback(code);
      // Set session cookie
      res.cookie('reka_session', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect explicitly to Vite frontend URL (port 5173), not backend NestJS (port 3000)
      return res.redirect(`${webUrl}/dashboard?auth=success&userId=${user.id}`);
    } catch (err: any) {
      return res.redirect(`${webUrl}/login?error=${encodeURIComponent(err.message || 'GitHub auth failed')}`);
    }
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const token = req.cookies?.reka_session || (req.headers.authorization?.replace('Bearer ', ''));
    return this.authService.getCurrentUser(token);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.reka_session;
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie('reka_session');
    return res.json({ success: true });
  }

  @Post('demo-login')
  async demoLogin(@Body('email') email?: string) {
    return this.authService.loginOrCreateDemoUser(email || 'owner@rekasandi.com');
  }

  @Post('passkey/register-options')
  getRegistrationOptions(@Body('email') email: string) {
    return this.authService.generateRegistrationOptions(email);
  }

  @Get('passkey/login-options')
  getLoginOptions() {
    return this.authService.generateAuthenticationOptions();
  }
}
